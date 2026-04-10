import fs from 'fs';
let content = fs.readFileSync('src/services/blueskyService.js', 'utf8');

const regex = /async postReply\(parent, text, options = \{\}\) \{[\s\S]*?async getProfile/;
const replacement = `async postReply(parent, text, options = {}) {
    if (!this.did) return null;
    try {
      const maxGraphemes = 300;
      const chunks = this.splitIntoGraphemeChunks(text, maxGraphemes);

      let root = parent.record?.reply?.root || { uri: parent.uri, cid: parent.cid };
      let currentParent = { uri: parent.uri, cid: parent.cid };

      for (let i = 0; i < chunks.length; i++) {
        const record = {
          $type: 'app.bsky.feed.post',
          text: chunks[i],
          reply: { root, parent: currentParent },
          createdAt: new Date().toISOString(),
        };

        if (i === 0 && options.embed) record.embed = options.embed;

        const response = await this.agent.post(record);
        currentParent = { uri: response.uri, cid: response.cid };

        if (chunks.length > 1 && i < chunks.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
        }
      }
      return { uri: currentParent.uri, cid: currentParent.cid };
    } catch (error) {
      console.error('[BlueskyService] Error creating reply:', error);
      return null;
    }
  }

  async getProfile`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('src/services/blueskyService.js', content);
    console.log('Successfully added chunking to postReply');
} else {
    console.error('Regex not matched');
}
