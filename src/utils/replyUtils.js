import { blueskyService } from '../services/blueskyService.js';

/**
 * Posts a reply with a YouTube video embed.
 * This is a two-step process:
 * 1. Post the text part of the reply.
 * 2. Post a second reply to the original post with the YouTube embed.
 * This is necessary to ensure the YouTube link card renders correctly on Bluesky.
 * @param {object} notif - The notification object from the Bluesky API.
 * @param {object} youtubeResult - The YouTube video result object from youtubeService.
 * @param {string} text - The text to include in the reply.
 */
export const postYouTubeReply = async (notif, youtubeResult, text) => {
  if (!youtubeResult) {
    console.error('[replyUtils] postYouTubeReply called with no youtubeResult.');
    // Fallback to a simple text reply if there's no video
    await blueskyService.postReply(notif, text);
    return;
  }

  const videoUrl = `https://www.youtube.com/watch?v=${youtubeResult.videoId}`;
  console.log(`[replyUtils] Posting YouTube reply for: ${videoUrl}`);

  // 1. Post the text-only reply first.
  // The LLM should have already generated text that mentions the video.
  await blueskyService.postReply(notif, text);

  // 2. Post the embed-only reply to the *same original post*.
  // This creates the link card. We send an empty string for the text.
  await blueskyService.postReply(notif, '', {
    embed: {
      $type: 'app.bsky.embed.external',
      external: {
        uri: videoUrl,
        title: youtubeResult.title,
        description: `A video by ${youtubeResult.channel}.`,
      },
    }
  });

  console.log('[replyUtils] Successfully posted YouTube reply and embed.');
};
