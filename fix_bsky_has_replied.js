import fs from 'fs';
let content = fs.readFileSync('src/services/blueskyService.js', 'utf8');

const search = `  async hasBotRepliedTo(uri) {
      try {
          const { data } = await this.agent.getPostThread({ uri });
          const replies = data.thread.replies || [];
          return replies.some(r => r.post.author.did === this.did);
      } catch (e) { return false; }
  }`;

const replace = `  async hasBotRepliedTo(uri) {
      try {
          const { data } = await this.agent.getPostThread({ uri });
          if (!data.thread || !data.thread.replies) return false;
          return data.thread.replies.some(r => r.post.author.did === this.did);
      } catch (e) {
          console.warn('[BlueskyService] Error checking if replied to:', uri, e.message);
          return false;
      }
  }`;

if (content.includes(search)) {
    content = content.replace(search, replace);
    fs.writeFileSync('src/services/blueskyService.js', content);
    console.log('Successfully updated hasBotRepliedTo');
} else {
    console.error('Search string not found');
}
