import { AtpAgent, RichText } from '@atproto/api';
import fetch from 'node-fetch';
import config from '../../config.js';
import { splitText } from '../utils/textUtils.js';

class BlueskyService {
  constructor() {
    this.agent = new AtpAgent({
      service: 'https://bsky.social',
    });
  }

  async authenticate() {
    await this.agent.login({
      identifier: config.BLUESKY_IDENTIFIER,
      password: config.BLUESKY_APP_PASSWORD,
    });
    console.log('[BlueskyService] Authenticated successfully');
  }

  async getNotifications(cursor) {
    try {
      const params = { limit: 50 };
      if (cursor) {
        params.cursor = cursor;
      }
      const { data } = await this.agent.listNotifications(params);
      return data;
    } catch (error) {
      console.error('[BlueskyService] Error fetching notifications:', error);
      return { notifications: [], cursor: cursor };
    }
  }

  async getDetailedThread(uri) {
    try {
      const { data } = await this.agent.getPostThread({
        uri,
        depth: 20,
        parentHeight: 20,
      });
      return data.thread;
    } catch (error) {
      console.error('[BlueskyService] Error fetching detailed thread:', error);
      return null;
    }
  }

  async postReply(parentPost, text, embed = null) {
    console.log(`[BlueskyService] LLM Response: "${text}"`);
    console.log('[BlueskyService] Posting reply...');
    const textChunks = splitText(text);
    let currentParent = parentPost;
    let rootPost = parentPost.record.reply?.root || { uri: parentPost.uri, cid: parentPost.cid };

    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];
      const rt = new RichText({ text: chunk });
      await rt.detectFacets(this.agent);

      const reply = {
        root: rootPost,
        parent: { uri: currentParent.uri, cid: currentParent.cid },
      };

      const postData = {
        $type: 'app.bsky.feed.post',
        text: rt.text,
        facets: rt.facets,
        reply,
        createdAt: new Date().toISOString(),
      };

      // Only add the embed to the first post in the chain
      if (i === 0) {
        let finalEmbed = embed;
        if (!finalEmbed) {
          const firstUrl = rt.facets?.find(f => f.features.some(feat => feat.$type === 'app.bsky.richtext.facet#link'))
            ?.features.find(feat => feat.$type === 'app.bsky.richtext.facet#link')?.uri;
          
          if (firstUrl) {
            finalEmbed = await this.getExternalEmbed(firstUrl);
          }
        }
        if (finalEmbed) {
          postData.embed = finalEmbed;
        }
      }

      const { uri, cid } = await this.agent.post(postData);
      console.log(`[BlueskyService] Posted chunk ${i + 1}/${textChunks.length}: ${uri}`);

      // The new post becomes the parent for the next chunk
      currentParent = { uri, cid };
      if (i === 0) {
        // After the first post, the root remains the same
        rootPost = reply.root;
      }
    }
    console.log('[BlueskyService] Finished posting reply chain.');
  }

  async getProfile(actor) {
    const { data } = await this.agent.getProfile({ actor });
    return data;
  }

  async getUserPosts(actor) {
    try {
      const { data } = await this.agent.getAuthorFeed({
        actor,
        limit: 15,
      });
      return data.feed.map(item => item.post.record.text);
    } catch (error) {
      console.error(`[BlueskyService] Error fetching posts for ${actor}:`, error);
      return [];
    }
  }

  async postAlert(text) {
    console.log('[BlueskyService] Posting alert to admin...');
    try {
      await this.agent.post({
        $type: 'app.bsky.feed.post',
        text: `@${config.ADMIN_BLUESKY_HANDLE} ${text}`,
        createdAt: new Date().toISOString(),
      });
      console.log('[BlueskyService] Alert posted successfully.');
    } catch (error) {
      console.error('[BlueskyService] Error posting alert:', error);
    }
  }

  async likePost(uri, cid) {
    try {
      await this.agent.like(uri, cid);
      console.log(`[BlueskyService] Liked post: ${uri}`);
    } catch (error) {
      console.error('[BlueskyService] Error liking post:', error);
    }
  }

  async uploadImage(url, altText = '') {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      const { data } = await this.agent.uploadBlob(uint8Array, {
        encoding: response.headers.get('content-type') || 'image/jpeg',
      });
      
      return {
        $type: 'app.bsky.embed.images',
        images: [{
          image: data.blob,
          alt: altText,
        }],
      };
    } catch (error) {
      console.error('[BlueskyService] Error uploading image:', error);
      return null;
    }
  }

  async post(text, embed = null) {
    console.log('[BlueskyService] Creating new post...');
    try {
      const rt = new RichText({ text });
      await rt.detectFacets(this.agent);

      const postData = {
        $type: 'app.bsky.feed.post',
        text: rt.text,
        facets: rt.facets,
        createdAt: new Date().toISOString(),
      };

      // If no embed is provided, try to generate a link card from the first URL in the text
      let finalEmbed = embed;
      if (!finalEmbed) {
        const firstUrl = rt.facets?.find(f => f.features.some(feat => feat.$type === 'app.bsky.richtext.facet#link'))
          ?.features.find(feat => feat.$type === 'app.bsky.richtext.facet#link')?.uri;
        
        if (firstUrl) {
          finalEmbed = await this.getExternalEmbed(firstUrl);
        }
      }

      if (finalEmbed) {
        postData.embed = finalEmbed;
      }

      await this.agent.post(postData);
      console.log('[BlueskyService] New post created successfully.');
    } catch (error) {
      console.error('[BlueskyService] Error creating new post:', error);
    }
  }

  async getExternalEmbed(url) {
    try {
      console.log(`[BlueskyService] Generating external embed for: ${url}`);
      // In a real scenario, we'd fetch the page metadata (title, description, thumb)
      // For now, we'll use a simple implementation or a helper if available
      // Since we don't have a full metadata scraper here, we'll provide a basic structure
      // or just return null if we can't get good metadata.
      // However, to make it "work properly" as requested, let's try a simple fetch.
      
      const response = await fetch(url);
      const html = await response.text();
      
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : url;
      
      const descMatch = html.match(/<meta name="description" content="(.*?)"/i) || 
                        html.match(/<meta property="og:description" content="(.*?)"/i);
      const description = descMatch ? descMatch[1] : '';

      return {
        $type: 'app.bsky.embed.external',
        external: {
          uri: url,
          title: title,
          description: description,
        }
      };
    } catch (error) {
      console.error('[BlueskyService] Error generating external embed:', error);
      return null;
    }
  }
}

export const blueskyService = new BlueskyService();
