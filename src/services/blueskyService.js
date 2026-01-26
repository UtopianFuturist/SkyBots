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

  get did() {
    return this.agent.session.did;
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
      const params = { limit: 10 };
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

  async updateSeen() {
    try {
      await this.agent.updateSeenNotifications();
      console.log('[BlueskyService] Updated notification seen status.');
    } catch (error) {
      console.error('[BlueskyService] Error updating notification seen status:', error);
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

  async getPostDetails(uri) {
    try {
      const { data } = await this.agent.getPosts({ uris: [uri] });
      return data.posts[0];
    } catch (error) {
      console.error('[BlueskyService] Error fetching post details:', error);
      return null;
    }
  }

  async postReply(parentPost, text, options = {}) {
    const { maxChunks = 2 } = options;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 3000; // 3 seconds

    console.log(`[BlueskyService] LLM Response: "${text}"`);
    console.log('[BlueskyService] Posting reply...');
    let textChunks = splitText(text);

    if (textChunks.length > maxChunks) {
        console.warn(`[BlueskyService] Warning: LLM generated a response with ${textChunks.length} chunks. Truncating to ${maxChunks}.`);
        textChunks = textChunks.slice(0, maxChunks);
    }

    let currentParent = parentPost;
    let rootPost = parentPost.record.reply?.root || { uri: parentPost.uri, cid: parentPost.cid };
    let firstPostUri = null;

    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];

      // Per-chunk validation to prevent trivial posts
      const hasAlphanumeric = /[a-zA-Z0-9]/.test(chunk);
      if (!chunk || chunk.trim().length < 2 || !hasAlphanumeric) {
        console.log(`[BlueskyService] Aborted reply chunk due to trivial content: "${chunk}"`);
        if (i === 0) {
          // If the very first chunk is invalid, abort the whole reply
          return null;
        }
        // Otherwise, just stop the chain here
        break;
      }

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
        let finalEmbed = null;

        // Precedence: explicit embed > image URLs/buffers > automatic link card
        if (options.embed) {
          finalEmbed = options.embed;
        } else if (options.imageUrl && options.imageAltText) {
          try {
            console.log(`[BlueskyService] Uploading image from URL: ${options.imageUrl}`);
            const response = await fetch(options.imageUrl);
            if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
            const arrayBuffer = await response.arrayBuffer();
            const imageBuffer = new Uint8Array(arrayBuffer);

            const contentType = response.headers.get('content-type') || 'image/gif';
            const { data: uploadData } = await this.agent.uploadBlob(imageBuffer, {
              encoding: contentType,
            });

            finalEmbed = {
              $type: 'app.bsky.embed.images',
              images: [{ image: uploadData.blob, alt: options.imageAltText }],
            };
            console.log('[BlueskyService] Image from URL uploaded successfully.');
          } catch (uploadError) {
            console.error('[BlueskyService] Error uploading image from URL:', uploadError);
          }
        } else if (options.imageBuffer && options.imageAltText) {
          try {
            console.log('[BlueskyService] Uploading image from buffer...');
            const { data: uploadData } = await this.agent.uploadBlob(options.imageBuffer, { encoding: 'image/jpeg' });
            finalEmbed = {
              $type: 'app.bsky.embed.images',
              images: [{ image: uploadData.blob, alt: options.imageAltText }],
            };
            console.log('[BlueskyService] Image buffer uploaded successfully.');
          } catch (uploadError) {
            console.error('[BlueskyService] Error uploading image blob from buffer:', uploadError);
          }
        } else if (options.imagesToEmbed && options.imagesToEmbed.length > 0) {
          finalEmbed = await this.uploadImages(options.imagesToEmbed);
        } else {
          // Fallback to automatic link card detection if no other embed is provided
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

      let postResult = null;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          console.log(`[BlueskyService] Posting chunk ${i + 1}/${textChunks.length} (Attempt ${attempt + 1})`);
          postResult = await this.agent.post(postData);
          break; // Success, exit retry loop
        } catch (error) {
          if ((error.name === 'XRPCError' || error.status === 1) && attempt < MAX_RETRIES - 1) {
            console.warn(`[BlueskyService] XRPCError on chunk ${i + 1}. Retrying in ${RETRY_DELAY / 1000}s...`, error.message);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          } else {
            console.error(`[BlueskyService] Failed to post chunk ${i + 1} after ${MAX_RETRIES} attempts. Aborting reply chain.`, error);
            throw error; // Re-throw the error to stop the whole process
          }
        }
      }

      const { uri, cid } = postResult;
      if (i === 0) {
        firstPostUri = uri;
      }
      console.log(`[BlueskyService] Posted chunk ${i + 1}/${textChunks.length}: ${uri}`);

      // The new post becomes the parent for the next chunk
      currentParent = { uri, cid };
      if (i === 0) {
        // After the first post, the root remains the same
        rootPost = reply.root;
      }
    }
    console.log('[BlueskyService] Finished posting reply chain.');
    return currentParent;
  }

  async deletePost(postUri) {
    try {
      const rkey = postUri.split('/').pop();
      await this.agent.api.app.bsky.feed.post.delete({
        repo: this.agent.session.did,
        rkey: rkey,
      });
      console.log(`[BlueskyService] Deleted post: ${postUri}`);
      return true;
    } catch (error) {
      console.error('[BlueskyService] Error deleting post:', error);
      return false;
    }
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

  async getPastInteractions(handle, days = 7) {
    try {
      const botHandle = config.BLUESKY_IDENTIFIER;
      // Search for posts between the user and the bot
      const query = `(from:${handle} @${botHandle}) OR (from:${botHandle} @${handle})`;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      console.log(`[BlueskyService] Searching for past interactions: ${query} since ${since}`);

      const { data } = await this.agent.app.bsky.feed.searchPosts({
        q: query,
        limit: 25,
      });

      return data.posts.filter(post => post.indexedAt >= since);
    } catch (error) {
      console.error(`[BlueskyService] Error fetching past interactions for ${handle}:`, error);
      return [];
    }
  }

   async getTimeline(limit = 30) {
     try {
       const { data } = await this.agent.getTimeline({ limit });
       return data.feed;
     } catch (error) {
       console.error('[BlueskyService] Error fetching timeline:', error);
       return [];
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

  async uploadImages(imagesToUpload) {
    try {
      const uploadedImages = [];
      for (const image of imagesToUpload) {
        try {
          const response = await fetch(image.link);
          if (!response.ok) {
            console.error(`[BlueskyService] Failed to fetch image ${image.link}: ${response.statusText}`);
            continue; // Skip this image
          }
          const arrayBuffer = await response.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          const { data } = await this.agent.uploadBlob(uint8Array, {
            encoding: response.headers.get('content-type') || 'image/jpeg',
          });

          uploadedImages.push({
            image: data.blob,
            alt: image.title || '',
          });
        } catch (fetchError) {
          console.error(`[BlueskyService] Error fetching or uploading image ${image.link}:`, fetchError);
        }
      }

      if (uploadedImages.length > 0) {
        return {
          $type: 'app.bsky.embed.images',
          images: uploadedImages,
        };
      }
      return null;
    } catch (error) {
      console.error('[BlueskyService] Error in uploadImages:', error);
      return null;
    }
  }

  async submitAutonomyDeclaration() {
    console.log('[BlueskyService] Submitting AI autonomy declaration record...');
    try {
      const repo = this.agent.session.did;
      if (!repo) throw new Error('Not logged in - no DID available');

      const responsiblePartyBsky = config.RESPONSIBLE_PARTY_BSKY;
      let responsiblePartyDid = '';

      if (responsiblePartyBsky) {
        if (responsiblePartyBsky.startsWith('did:')) {
          responsiblePartyDid = responsiblePartyBsky;
        } else {
          try {
            const profile = await this.getProfile(responsiblePartyBsky);
            responsiblePartyDid = profile.did;
          } catch (e) {
            console.warn(`[BlueskyService] Could not resolve DID for responsible party: ${responsiblePartyBsky}`);
          }
        }
      }

      const record = {
        $type: 'studio.voyager.account.autonomy',
        usesGenerativeAI: true,
        automationLevel: 'automated',
        createdAt: new Date().toISOString(),
        description: config.TEXT_SYSTEM_PROMPT,
        disclosureUrl: 'https://github.com/UtopianFuturist/SkyBots',
      };

      if (responsiblePartyDid) {
        record.responsibleParty = {
          type: 'person',
          did: responsiblePartyDid,
        };
      }

      await this.agent.api.com.atproto.repo.putRecord({
        repo,
        collection: 'studio.voyager.account.autonomy',
        rkey: 'self',
        record,
      });

      console.log('[BlueskyService] Autonomy declaration submitted successfully.');
    } catch (error) {
      console.error('[BlueskyService] Error submitting autonomy declaration:', error);
    }
  }

  async post(text, embed = null, options = { maxChunks: 3 }) {
    console.log('[BlueskyService] Creating new post (potentially threaded)...');
    try {
      let textChunks = splitText(text);
      if (textChunks.length > options.maxChunks) {
        console.warn(`[BlueskyService] Post content exceeds ${options.maxChunks} chunks. Truncating.`);
        textChunks = textChunks.slice(0, options.maxChunks);
      }

      let currentParent = null;
      let rootPost = null;
      let firstPostResult = null;

      for (let i = 0; i < textChunks.length; i++) {
        const chunk = textChunks[i];
        const rt = new RichText({ text: chunk });
        await rt.detectFacets(this.agent);

        const postData = {
          $type: 'app.bsky.feed.post',
          text: rt.text,
          facets: rt.facets,
          createdAt: new Date().toISOString(),
        };

        // If no embed is provided for the first post, try to generate a link card
        let finalEmbed = i === 0 ? embed : null;
        if (i === 0 && !finalEmbed) {
          const firstUrl = rt.facets?.find(f => f.features.some(feat => feat.$type === 'app.bsky.richtext.facet#link'))
            ?.features.find(feat => feat.$type === 'app.bsky.richtext.facet#link')?.uri;

          if (firstUrl) {
            finalEmbed = await this.getExternalEmbed(firstUrl);
          }
        }

        if (finalEmbed) {
          postData.embed = finalEmbed;
        }

        if (currentParent) {
          postData.reply = {
            root: rootPost,
            parent: currentParent,
          };
        }

        const postResult = await this.agent.post(postData);
        const { uri, cid } = postResult;

        if (i === 0) {
          rootPost = { uri, cid };
          firstPostResult = postResult;
        }
        currentParent = { uri, cid };
        console.log(`[BlueskyService] Created post ${i + 1}/${textChunks.length}: ${uri}`);
      }
      console.log('[BlueskyService] Finished creating post thread.');
      return firstPostResult; // Returning the first post so replies can be attached to it if needed
    } catch (error) {
      console.error('[BlueskyService] Error creating new post(s):', error);
      return null;
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
