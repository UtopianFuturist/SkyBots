import { blueskyService } from './services/blueskyService.js';
import { llmService } from './services/llmService.js';
import { dataStore } from './services/dataStore.js';
import { googleSearchService } from './services/googleSearchService.js';
import { imageService } from './services/imageService.js';
import { youtubeService } from './services/youtubeService.js';
import { giphyService } from './services/giphyService.js';
import { handleCommand } from './utils/commandHandler.js';
import { postYouTubeReply } from './utils/replyUtils.js';
import { sanitizeDuplicateText, sanitizeThinkingTags } from './utils/textUtils.js';
import config from '../config.js';
import fs from 'fs/promises';
import { spawn } from 'child_process';

export class Bot {
  constructor() {
    this.readmeContent = '';
    this.paused = false;
    this.proposedPosts = [];
    this.firehoseProcess = null;
  }

  async init() {
    await dataStore.init();
    await blueskyService.authenticate();
    try {
      this.readmeContent = await fs.readFile('README.md', 'utf-8');
      console.log('[Bot] README.md loaded for self-awareness.');
    } catch (error) {
      console.error('[Bot] Error loading README.md:', error);
    }
  }

  startFirehose() {
    console.log('[Bot] Starting Firehose monitor...');
    const command = 'python3 -m pip install --break-system-packages -r requirements.txt && python3 firehose_monitor.py';
    this.firehoseProcess = spawn(command, { shell: true });

    this.firehoseProcess.stdout.on('data', async (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === 'firehose_mention') {
            console.log(`[Bot] Firehose mention detected: ${event.uri}`);
            if (dataStore.hasReplied(event.uri)) continue;
            
            // Resolve handle for the author DID
            const profile = await blueskyService.getProfile(event.author.did);
            const notif = {
              uri: event.uri,
              cid: event.cid,
              author: profile,
              record: event.record,
              reason: event.reason,
              indexedAt: new Date().toISOString()
            };
            
            await this.processNotification(notif);
            await dataStore.addRepliedPost(notif.uri);
          }
        } catch (e) {
          // Ignore non-JSON output
        }
      }
    });

    this.firehoseProcess.stderr.on('data', (data) => {
      console.error(`[Firehose Monitor] ${data.toString().trim()}`);
    });

    this.firehoseProcess.on('close', (code) => {
      console.log(`[Bot] Firehose monitor exited with code ${code}. Restarting in 10s...`);
      setTimeout(() => this.startFirehose(), 10000);
    });
  }

  async run() {
    console.log('[Bot] Starting main loop...');

    this.setupGracefulShutdown();

    // Start Firehose for real-time DID mentions, which now handles catch-up.
    this.startFirehose();

    // Proactive post proposal on a timer
    setInterval(() => this.proposeNewPost(), 3600000); // Every hour

    console.log('[Bot] Startup complete. Listening for real-time events via Firehose.');
  }

  async processNotification(notif) {
    const handle = notif.author.handle;
    const text = notif.record.text || "";
    const threadRootUri = notif.record.reply?.root?.uri || notif.uri;

    // Time-Based Reply Filter
    const postDate = new Date(notif.indexedAt);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (postDate < thirtyDaysAgo) {
      console.log(`[Bot] Skipping notification older than 30 days.`);
      return;
    }

    // 1. Thread History Fetching (Centralized)
    const threadContext = await this._getThreadHistory(notif.uri);

    // Prompt injection filter removed per user request.


    // 2. Refined Reply Trigger Logic
    const botMentioned = text.includes(config.BLUESKY_IDENTIFIER) || config.BOT_NICKNAMES.some(nick => text.includes(nick));
    const isQuoteRepost = notif.reason === 'quote';

    // Check if the reply is to one of the bot's own posts.
    const parentPost = threadContext.length > 1 ? threadContext[threadContext.length - 2] : null;
    const isReplyToBot = parentPost && parentPost.author === config.BLUESKY_IDENTIFIER;

    if (!botMentioned && !isReplyToBot && !isQuoteRepost) {
      console.log(`[Bot] Not a mention, reply to self, or quote repost. Skipping.`);
      return;
    }

    // 2. Check Blocklist
    if (dataStore.isBlocked(handle)) {
      console.log(`[Bot] User ${handle} is blocked. Skipping.`);
      return;
    }

    // 2. Check Muted Thread
    if (dataStore.isThreadMuted(threadRootUri)) {
      console.log(`[Bot] Thread ${threadRootUri} is muted. Skipping.`);
      return;
    }

    // 3. Pre-reply safety and relevance checks
    const postSafetyCheck = await llmService.isPostSafe(text);
    if (!postSafetyCheck.safe) {
      console.log(`[Bot] Post by ${handle} failed safety check. Reason: ${postSafetyCheck.reason}. Skipping.`);
      return;
    }

    // 4. Handle Commands
    const commandResponse = await handleCommand(this, notif, text);
    if (commandResponse !== null) {
      // A command was matched. Check if the handler returned a simple string to post.
      if (typeof commandResponse === 'string') {
        await blueskyService.postReply(notif, commandResponse);
      }
      // If not a string, the handler managed its own reply (e.g., for embeds).
      // In either case, command processing is done.
      return;
    }

    // 5. Pre-reply LLM check to avoid unnecessary responses
    const historyText = threadContext.map(h => `${h.author === config.BLUESKY_IDENTIFIER ? 'Assistant' : 'User'}: ${h.text}`).join('\n');

    // 6. Bot-to-Bot Loop Prevention
    const profile = await blueskyService.getProfile(handle);
    const isBot = handle.includes('bot') || profile.description?.toLowerCase().includes('bot');
    const convLength = dataStore.getConversationLength(threadRootUri);

    if (isBot && convLength >= 5) {
      await blueskyService.postReply(notif, "This conversation has been great, but I'll step away now to avoid looping! Feel free to tag me elsewhere.");
      await dataStore.muteThread(threadRootUri);
      return;
    }

    // 5. Conversational Image Generation
    const conversationHistoryForImageCheck = threadContext.map(h => `${h.author === config.BLUESKY_IDENTIFIER ? 'Assistant' : 'User'}: ${h.text}`).join('\n');
    const imageGenCheckPrompt = `You are an intent detection AI. Analyze the latest user post in the context of the conversation to determine if they are asking for an image to be generated. Respond with only "yes" or "no".\n\nConversation History:\n${conversationHistoryForImageCheck}`;
    const imageGenCheckMessages = [{ role: 'system', content: imageGenCheckPrompt }];
    const imageGenCheckResponse = await llmService.generateResponse(imageGenCheckMessages, { max_tokens: 5, preface_system_prompt: false });

    if (imageGenCheckResponse && imageGenCheckResponse.toLowerCase().includes('yes')) {
      const imagePromptExtractionPrompt = `You are an AI assistant that extracts image prompts. Based on the conversation, create a concise, literal, and descriptive prompt for an image generation model. The user's latest post is the primary focus. Conversation:\n${conversationHistoryForImageCheck}\n\nRespond with only the prompt.`;
      const imagePromptExtractionMessages = [{ role: 'system', content: imagePromptExtractionPrompt }];
      const prompt = await llmService.generateResponse(imagePromptExtractionMessages, { max_tokens: 100, preface_system_prompt: false });

      if (prompt && prompt.toLowerCase() !== 'null' && prompt.toLowerCase() !== 'no') {
        console.log(`[Bot] Final image generation prompt: "${prompt}"`);
        const imageBuffer = await imageService.generateImage(prompt);
        if (imageBuffer) {
          console.log('[Bot] Image generation successful, posting reply...');
          await blueskyService.postReply(notif, `Here's an image of "${prompt}":`, {
            imageBuffer,
            imageAltText: prompt,
          });
          return;
        }
        console.log(`[Bot] Image generation failed for prompt: "${prompt}", continuing with text-based response.`);
      }
    }

    // 5. Fact-Checking
    if (await llmService.isFactCheckNeeded(text)) {
      console.log(`[Bot] Fact-check needed for post by ${handle}.`);
      const claim = await llmService.extractClaim(text);
      if (claim) {
        const searchResults = await googleSearchService.search(claim);
        if (searchResults.length > 0) {
          const topResult = searchResults[0];
          console.log(`[Bot] Top search result for "${claim}": ${topResult.title}`);

          const snippet = topResult.snippet.substring(0, 500);
          const summaryPrompt = `
            You are a helpful assistant that summarizes information from trusted sources.
            A user is asking about: "${claim}".
            The most relevant article found is titled "${topResult.title}".
            Here is a snippet from the article: "${snippet}".

            Based on this, provide a concise and conversational summary of the key information.
            Do not link to the article in your summary; the link will be added automatically.
          `;
          const messages = [
            { role: 'system', content: summaryPrompt },
            ...threadContext.map(h => ({ role: h.author === config.BLUESKY_IDENTIFIER ? 'assistant' : 'user', content: h.text }))
          ];

          const summaryText = await llmService.generateResponse(messages);

          if (summaryText) {
            console.log(`[Bot] Generated summary for "${claim}": ${summaryText}`);
            const embed = await blueskyService.getExternalEmbed(topResult.link);
            await blueskyService.postReply(notif, summaryText, { embed });
            return;
          }
        } else {
            console.log(`[Bot] Could not find a relevant page from trusted sources for "${claim}".`);
        }
      }
    }

    // 6. YouTube Search Integration (Streamlined)
    let youtubeResult = null;
    const ytSearchAnalysis = await llmService.getYoutubeSearchQuery(threadContext);

    if (ytSearchAnalysis.search && ytSearchAnalysis.query) {
      console.log(`[Bot] Extracted YouTube search query: "${ytSearchAnalysis.query}"`);
      const youtubeResults = await youtubeService.search(ytSearchAnalysis.query);

      if (youtubeResults.length > 0) {
        youtubeResult = youtubeResults[0];
        console.log(`[Bot] Found YouTube video: https://www.youtube.com/watch?v=${youtubeResult.videoId}`);
      } else {
        console.log(`[Bot] YouTube search for "${ytSearchAnalysis.query}" yielded no results.`);
      }
    } else {
      console.log('[Bot] No video intent detected.');
    }

    // 6. Image Recognition
    let imageAnalysisResult = '';
    const embed = notif.record.embed;
    if (embed && embed.$type === 'app.bsky.embed.images') {
      for (const image of embed.images) {
        const imageUrl = `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${notif.author.did}&cid=${image.image.ref.$link}`;
        console.log(`[Bot] Image detected: ${image.image.ref.$link}`);
        console.log(`[Bot] Alt text: ${image.alt}`);
        imageAnalysisResult += await llmService.analyzeImage(imageUrl, image.alt) + ' ';
      }
    }

    // 6. Generate Response with User Context and Memory
    console.log(`[Bot] Responding to post from ${handle}: "${text}"`);

    const contextIntentSystemPrompt = `You are an intent detection AI. Analyze the user's post to determine if they are asking a question that requires their own profile or post history as context. This includes questions like "give me recommendations", "summarize my profile", "what do you think of me?", etc. Your answer must be a single word: "yes" or "no".`;
    const contextIntentMessages = [
      { role: 'system', content: contextIntentSystemPrompt },
      { role: 'user', content: `The user's post is: "${text}"` }
    ];
    const contextIntentResponse = await llmService.generateResponse(contextIntentMessages, { max_tokens: 5 });
    let useContext = contextIntentResponse && contextIntentResponse.toLowerCase().includes('yes');

    console.log(`[Bot] Generating response for ${handle}...`);
    const userMemory = dataStore.getInteractionsByUser(handle);
    
    const userProfile = await blueskyService.getProfile(handle);
    const userPosts = await blueskyService.getUserPosts(handle);

    const userIntent = await llmService.analyzeUserIntent(userProfile, userPosts);

    if (userIntent.highRisk) {
      console.log(`[Bot] High-risk intent detected from ${handle}. Reason: ${userIntent.reason}. Pausing bot and alerting admin.`);
      this.paused = true;
      const alertMessage = `🚨 High-risk intent detected from @${handle}. Reason: ${userIntent.reason}. Bot is now paused. Post URI: https://bsky.app/profile/${handle}/post/${notif.uri.split('/').pop()}`;
      await blueskyService.postAlert(alertMessage);
      return;
    }

    const userContext = `
      ---
      User Profile:
      - Bio: ${userProfile.description?.replace(/\n/g, ' ') || 'Not available.'}
      - Recent Posts:
        ${userPosts.length > 0 ? userPosts.map(p => `- "${p.substring(0, 80)}..."`).join('\n') : 'No recent posts found.'}
      ---
    `;

    const crossPostMemory = userPosts
      .filter(p => (p.includes(config.BLUESKY_IDENTIFIER) || config.BOT_NICKNAMES.some(nick => p.includes(nick))) && p !== text)
      .map(p => `- (Previous mention in a DIFFERENT thread) "${p.substring(0, 100)}..."`)
      .join('\n');

    const fullContext = `
      ${useContext ? userContext : ''}
      ---
      Cross-Post Memory (Recent mentions of the bot by this user):
      ${crossPostMemory || 'No recent cross-post mentions found.'}
      ---
      User Intent Analysis: ${userIntent.reason || 'Could not be determined.'}
      ---
      Image Analysis: ${imageAnalysisResult || 'No image provided.'}
      ---
      ${
        youtubeResult
          ? `YouTube Search Result for "${youtubeResult.title}": A video will be embedded in the reply.`
          : (ytSearchAnalysis.search ? 'The user may have asked for a video, but no relevant YouTube video was found. Please inform the user that you could not find a video for their request.' : '')
      }
    `;

    const messages = [
      { role: 'system', content: `You are replying to ${handle}. Use the following context to tailor your response. Your tone should be influenced by the user's intent, but do not state the analysis directly.${fullContext}` },
      ...userMemory.slice(-3).map(m => ({ role: 'user', content: `(Past interaction) ${m.text}` })),
      ...threadContext.map(h => ({ role: h.author === config.BLUESKY_IDENTIFIER ? 'assistant' : 'user', content: h.text }))
    ];

    // Persona Consistency Reinforcement for long threads
    if (threadContext.length >= 10) {
      messages.unshift({ role: 'system', content: `Reminder: Maintain your core persona. ${config.TEXT_SYSTEM_PROMPT}` });
    }

    let responseText = await llmService.generateResponse(messages);

    const recentBotReplies = threadContext.filter(h => h.author === config.BLUESKY_IDENTIFIER).map(h => h.text);

    // 6. Semantic Loop and Safety Check for Bot's Response
    if (responseText) {
      if (await llmService.checkSemanticLoop(responseText, recentBotReplies)) {
        console.log('[Bot] Semantic loop detected. Generating a new response.');
        responseText = await llmService.generateResponse([...messages, { role: 'system', content: "Your previous response was too similar to a recent one. Please provide a fresh, different perspective." }]);
      }

      if (responseText) {
        const responseSafetyCheck = await llmService.isResponseSafe(responseText);
        if (!responseSafetyCheck.safe) {
          console.log(`[Bot] Bot's response failed safety check. Reason: ${responseSafetyCheck.reason}. Aborting reply.`);
          return;
        }
      }
    }

    if (responseText) {
      // Remove thinking tags and any leftover fragments
      responseText = sanitizeThinkingTags(responseText);
      responseText = responseText.replace(/<\/think>/gi, '').trim();
      
      responseText = sanitizeDuplicateText(responseText);
      
      if (!responseText) {
        console.log('[Bot] Response was empty after sanitization. Aborting reply.');
        return;
      }
      
      console.log(`[Bot] Replying to @${handle} with: "${responseText}"`);
      let replyUri;
      if (youtubeResult) {
        replyUri = await postYouTubeReply(notif, youtubeResult, responseText);
      } else {
        const gifDecisionPrompt = `You are a social media AI. Your generated response is: "${responseText}". Would adding a culturally relevant GIF (e.g., from a movie, TV show, or meme) enhance this response? Your answer must be a single word: "yes" or "no".`;
        const gifDecisionMessages = [{ role: 'system', content: gifDecisionPrompt }];
        const gifDecision = await llmService.generateResponse(gifDecisionMessages, { max_tokens: 5 });

        if (gifDecision && gifDecision.toLowerCase().includes('yes')) {
          console.log('[Bot] Decided to add a GIF. Generating culturally relevant query...');
          const gifQueryPrompt = `You are a pop culture expert AI. Based on the following conversation and the bot's final response, generate a short, iconic quote from a movie, TV show, song lyric, or meme that captures the vibe of the bot's response. The quote should be suitable as a Giphy search query.

Conversation History:
${historyText}

Bot's Response: "${responseText}"

Your answer must be only the quote itself.`;
          const gifQueryMessages = [{ role: 'system', content: gifQueryPrompt }];
          const gifQuery = await llmService.generateResponse(gifQueryMessages, { max_tokens: 20 });

          if (gifQuery && gifQuery.trim()) {
            console.log(`[Bot] Generated GIF query: "${gifQuery}"`);
            const gifResult = await giphyService.search(gifQuery);
            if (gifResult) {
              console.log(`[Bot] Posting with GIF: ${gifResult.url}`);
              replyUri = await blueskyService.postReply(notif, responseText, {
                imageUrl: gifResult.url,
                imageAltText: gifResult.alt,
              });
            } else {
              console.log('[Bot] Giphy search failed. Posting text only.');
              replyUri = await blueskyService.postReply(notif, responseText);
            }
          } else {
            console.log('[Bot] Could not generate a GIF query. Posting text only.');
            replyUri = await blueskyService.postReply(notif, responseText);
          }
        } else {
          console.log('[Bot] Decided not to add a GIF. Posting text only.');
          replyUri = await blueskyService.postReply(notif, responseText);
        }
      }
      await dataStore.updateConversationLength(threadRootUri, convLength + 1);
      await dataStore.saveInteraction({ userHandle: handle, text, response: responseText });

      if (await llmService.shouldLikePost(text)) {
        console.log(`[Bot] Post by ${handle} matches persona. Liking...`);
        await blueskyService.likePost(notif.uri, notif.cid);
      }

      const interactionHistory = dataStore.getInteractionsByUser(handle);
      const rating = await llmService.rateUserInteraction(interactionHistory);
      await dataStore.updateUserRating(handle, rating);

      // Self-moderation check
      const isTrivial = responseText.length < 2;
      const isRepetitive = await llmService.checkSemanticLoop(responseText, recentBotReplies);
      const isCoherent = await llmService.isReplyCoherent(threadContext, responseText);

      if (isTrivial || isRepetitive || !isCoherent) {
        let reason = 'incoherent';
        if (isTrivial) reason = 'trivial';
        if (isRepetitive) reason = 'repetitive';

        console.warn(`[Bot] Deleting own post (${reason}). URI: ${replyUri}. Content: "${responseText}"`);
        await blueskyService.deletePost(replyUri);
      }
    }
  }

  async _getThreadHistory(uri) {
    try {
      const thread = await blueskyService.getDetailedThread(uri);
      if (!thread) return [];

      const history = [];
      let current = thread;

      while (current && current.post) {
        history.unshift({
          author: current.post.author.handle,
          text: current.post.record.text
        });
        current = current.parent;
      }
      return history;
    } catch (error) {
      console.error('[Bot] Error fetching thread history:', error);
      return [];
    }
  }

  async proposeNewPost() {
    if (this.paused) return;
    console.log('[Bot] Proposing new post...');
    const interactions = dataStore.db.data.interactions.slice(-10);
    if (interactions.length < 3) return;

    const topics = interactions.map(i => i.text).join('\n');
    const systemPrompt = `
      Based on the following recent topics of conversation, synthesize 3 interesting and relevant topics for a new post.
      The topics should be in line with the bot's persona: friendly, inquisitive, and occasionally witty.
      Format the topics as a numbered list.
    `;
    const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: topics }];
    const proposedTopics = await llmService.generateResponse(messages);

    if (proposedTopics) {
      this.proposedPosts = proposedTopics.split('\n').map(t => t.replace(/^\d+\.\s*/, ''));
      const approvalMessage = `I've come up with a few ideas for a new post. Please review and approve one:\n${this.proposedPosts.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\nTo approve, reply with \`!approve-post [number]\`.`;
      await blueskyService.postAlert(approvalMessage);
    }
  }

  async createApprovedPost(topicIndex) {
    if (this.paused || topicIndex < 0 || topicIndex >= this.proposedPosts.length) return;

    const topic = this.proposedPosts[topicIndex];
    const systemPrompt = `
      Create a new, standalone Bluesky post about the following topic: "${topic}".
      The post should be engaging, under 300 characters, and in line with a friendly, inquisitive persona.
    `;
    const messages = [{ role: 'system', content: systemPrompt }];
    const postContent = await llmService.generateResponse(messages);

    if (postContent) {
      // 50% chance of adding an image
      if (Math.random() < 0.5) {
        const imageResults = await googleSearchService.searchImages(topic);
        if (imageResults.length > 0) {
          const image = imageResults[0];
          const embed = await blueskyService.uploadImage(image.link, image.title || topic);
          await blueskyService.post(postContent, embed);
        } else {
          await blueskyService.post(postContent);
        }
      } else {
        await blueskyService.post(postContent);
      }
    }
    this.proposedPosts = []; // Clear proposals after posting
  }

  setupGracefulShutdown() {
    const shutdown = async () => {
      console.log('[Bot] Received shutdown signal. Cleaning up...');
      if (this.firehoseProcess) {
        // Send SIGINT to the Python process so it can shut down cleanly
        this.firehoseProcess.kill('SIGINT');
        console.log('[Bot] Firehose monitor process terminated.');
      }
      await dataStore.db.write(); // Ensure data is saved
      console.log('[Bot] Database flushed.');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
}
