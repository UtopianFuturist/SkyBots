import { dataStore } from '../services/dataStore.js';
import { googleSearchService } from '../services/googleSearchService.js';
import { youtubeService } from '../services/youtubeService.js';
import { imageService } from '../services/imageService.js';
import { blueskyService } from '../services/blueskyService.js';
import { llmService } from '../services/llmService.js';
import config from '../../config.js';

export const handleCommand = async (bot, post, text) => {
  const lowerText = text.toLowerCase().trim();
  const handle = post.author.handle;
  const threadRootUri = post.record.reply?.root?.uri || post.uri;

  if (lowerText.includes('!stop')) {
    await dataStore.blockUser(handle);
    return "You have been added to my blocklist. Use `!resume` to receive messages again.";
  }

  if (lowerText.includes('!unblock')) {
    await dataStore.unblockUser(handle);
    return "Welcome back! You've been removed from my blocklist.";
  }

  // Admin-only commands
  if (handle === config.ADMIN_BLUESKY_HANDLE) {
    if (lowerText === '!resume') {
      bot.paused = false;
      console.log('[Bot] Bot has been resumed by admin.');
      return 'Bot operations have been resumed.';
    }
  }

  if (lowerText.includes('!mute')) {
    await dataStore.muteThread(threadRootUri);
    return "I've muted this thread and won't reply here anymore.";
  }

  if (lowerText === '!help') {
    return "I'm an AI assistant! Commands: `!stop` (block me), `!resume` (unblock), `!mute` (mute thread), `!about` (learn about me). I can also chat, search the web, and generate images!";
  }

  if (lowerText === '!about') {
    const userQuestion = "Tell me about yourself."; // Generic question
    const messages = [
      { role: 'system', content: config.ABOUT_BOT_SYSTEM_PROMPT },
      { role: 'user', content: `My question is: "${userQuestion}"\n\nHere is your README.md to help you answer:\n\n${bot.readmeContent}` }
    ];
    return await llmService.generateResponse(messages);
  }

  if (lowerText.startsWith('!search') || lowerText.startsWith('!google')) {
    const query = lowerText.replace('!search', '').replace('!google', '').trim();
    if (!query) {
      return "Please provide a search term. Example: `!search Bluesky status`";
    }

    console.log(`[CommandHandler] Received !search command with query: "${query}"`);
    const results = await googleSearchService.search(query);

    if (results && results.length > 0) {
      const topResults = results.slice(0, 3);
      const searchContext = topResults.map((r, i) => `${i + 1}. ${r.title}: ${r.snippet}`).join('\n');

      // 1. Generate and post the summary
      const summaryPrompt = `Based on the following search results for "${query}", write a concise summary of the findings.\n\n${searchContext}`;
      const summary = await llmService.generateResponse([{ role: 'system', content: summaryPrompt }]);

      let lastPost = post;
      if (summary) {
        lastPost = await blueskyService.postReply(lastPost, summary, { maxChunks: 1 });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 2. Post each of the top 3 results as a separate, nested reply
      for (const result of topResults) {
        if (!lastPost) break; // Stop if a post in the chain fails
        const headlineText = `${result.title}\n${result.link}`;
        const embed = await blueskyService.getExternalEmbed(result.link);
        lastPost = await blueskyService.postReply(lastPost, headlineText, { embed, maxChunks: 1 });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return; // Command handled, no further reply needed
    }

    return `I couldn't find anything for "${query}".`;
  }

  if (lowerText.startsWith('!video') || lowerText.startsWith('!youtube')) {
    const query = lowerText.replace('!video', '').replace('!youtube', '').trim();
    const results = await youtubeService.search(query);
    if (results.length > 0) {
      const topResult = results[0];
      const videoUrl = `https://www.youtube.com/watch?v=${topResult.videoId}`;

      // First, post the text-only reply
      const replyText = `Here's a video I found for "${query}":\n\n${topResult.title}`;
      await blueskyService.postReply(post, replyText);

      // Then, post the embed-only reply to the same original post
      await blueskyService.postReply(post, '', {
        embed: {
          $type: 'app.bsky.embed.external',
          external: {
            uri: videoUrl,
            title: topResult.title,
            description: `A video by ${topResult.channel}.`,
          },
        }
      });
      return; // Command handled
    }
    return `I couldn't find any videos for "${query}".`;
  }

  if (lowerText.startsWith('!generate-image')) {
    const prompt = lowerText.replace('!generate-image', '').trim();
    console.log(`[CommandHandler] Received !generate-image command with prompt: "${prompt}"`);
    const imageBuffer = await imageService.generateImage(prompt);
    if (imageBuffer) {
      console.log('[CommandHandler] Image generation successful, uploading to Bluesky...');
      const { data: uploadData } = await blueskyService.agent.uploadBlob(imageBuffer, { encoding: 'image/jpeg' });
      const embed = {
        $type: 'app.bsky.embed.images',
        images: [{ image: uploadData.blob, alt: prompt }],
      };
      await blueskyService.postReply(post, `Here's an image of "${prompt}":`, { embed });
      return; // Command handled
    }
    return "I wasn't able to create an image for that. Please try another prompt.";
  }

  if (lowerText.startsWith('!image-search')) {
    const imageQuery = lowerText.replace('!image-search', '').trim();
    if (!imageQuery) {
      return "Please provide a search term. Example: `!image-search cute cats`";
    }
    const imageResults = await googleSearchService.searchImages(imageQuery);

    if (imageResults && imageResults.length > 0) {
      const imagesToEmbed = imageResults.slice(0, 4); // Always get top 4

      const replyText = `Here are the top images I found for "${imageQuery}":`;

      const embed = await blueskyService.uploadImages(imagesToEmbed);
      await blueskyService.postReply(post, replyText, { embed });
      return; // Command handled
    }
    return `I couldn't find any images for "${imageQuery}".`;
  }

  return null;
};
