import sys

file_path = 'src/services/blueskyService.js'
with open(file_path, 'r') as f:
    content = f.read()

threadgate_method = """  async upsertThreadgate(uri, rules = {}) {
    if (!this.did) return;
    try {
      const { allowMentions = true, allowFollowing = false } = rules;
      const allow = [];
      if (allowMentions) allow.push({ $type: 'app.bsky.feed.threadgate#mentionRule' });
      if (allowFollowing) allow.push({ $type: 'app.bsky.feed.threadgate#followingRule' });

      await this._withRetry(() => this.agent.api.com.atproto.repo.putRecord({
        repo: this.did,
        collection: 'app.bsky.feed.threadgate',
        rkey: uri.split('/').pop(),
        record: {
          $type: 'app.bsky.feed.threadgate',
          post: uri,
          allow: allow,
          createdAt: new Date().toISOString(),
        }
      }), "upsertThreadgate");
    } catch (error) {
      console.error('[BlueskyService] Error upserting threadgate:', error.message);
    }
  }

"""

# Insert before end of class
if 'export const blueskyService' in content:
    content = content.replace('export const blueskyService', threadgate_method + 'export const blueskyService')

with open(file_path, 'w') as f:
    f.write(content)
print("Successfully added upsertThreadgate to BlueskyService")
