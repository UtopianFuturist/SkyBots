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

  if (lowerText.startsWith('search for') || lowerText.startsWith('google')) {
    const query = lowerText.replace('search for', '').replace('google', '').trim();
    const results = await googleSearchService.search(query);
    if (results.length > 0) {
      const topResult = results[0];
      const replyText = `Here's what I found for "${query}":\n\n${topResult.title}\n${topResult.snippet}`;
      // This is a simplified version. A full implementation would create a card embed.
      await blueskyService.postReply(post, replyText, {
        $type: 'app.bsky.embed.external',
        external: {
          uri: topResult.link,
          title: topResult.title,
          description: topResult.snippet,
        },
      });
      return; // Command handled
    }
    return `I couldn't find anything for "${query}".`;
  }

  if (lowerText.startsWith('find a video about') || lowerText.startsWith('youtube')) {
    const query = lowerText.replace('find a video about', '').replace('youtube', '').trim();
    const results = await youtubeService.search(query);
    if (results.length > 0) {
      const topResult = results[0];
      const videoUrl = `https://www.youtube.com/watch?v=${topResult.videoId}`;
      const replyText = `Here's a video I found for "${query}":\n\n${topResult.title}`;
      await blueskyService.postReply(post, replyText, {
        $type: 'app.bsky.embed.external',
        external: {
          uri: videoUrl,
          title: topResult.title,
          description: `A video by ${topResult.channel}.`,
        },
      });
      return; // Command handled
    }
    return `I couldn't find any videos for "${query}".`;
  }

  if (lowerText.startsWith('generate image') || lowerText.startsWith('create a picture of')) {
    const prompt = lowerText.replace('generate image', '').replace('create a picture of', '').trim();
    const imageBuffer = await imageService.generateImage(prompt);
    if (imageBuffer) {
      const { data: uploadData } = await blueskyService.agent.uploadBlob(imageBuffer, { encoding: 'image/jpeg' });
      await blueskyService.postReply(post, `Here's an image of "${prompt}":`, {
        $type: 'app.bsky.embed.images',
        images: [{ image: uploadData.blob, alt: prompt }],
      });
      return; // Command handled
    }
    return "I wasn't able to create an image for that. Please try another prompt.";
  }

  if (lowerText.startsWith('find image') || lowerText.startsWith('search for image')) {
    const query = lowerText.replace('find image', '').replace('search for image', '').trim();
    const results = await googleSearchService.searchImages(query);
    if (results.length > 0) {
      const topResult = results[0];
      const replyText = `Here's an image I found for "${query}":\n\n${topResult.title}`;
      await blueskyService.postReply(post, replyText, {
        $type: 'app.bsky.embed.external',
        external: {
          uri: topResult.link,
          title: topResult.title,
          description: topResult.snippet,
        },
      });
      return; // Command handled
    }
    return `I couldn't find any images for "${query}".`;
  }

  return null;
};
