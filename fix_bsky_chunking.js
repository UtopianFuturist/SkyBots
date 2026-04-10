import fs from 'fs';
let content = fs.readFileSync('src/services/blueskyService.js', 'utf8');

const regex = /async post\(text, embed = null, options = \{\}\) \{[\s\S]*?async postReply/;
const replacement = `async post(text, embed = null, options = {}) {
    if (!this.did) return null;
    try {
      const maxGraphemes = 300;
      const chunks = this.splitIntoGraphemeChunks(text, maxGraphemes);

      let root = null;
      let parent = null;

      for (let i = 0; i < chunks.length; i++) {
        const record = {
          $type: 'app.bsky.feed.post',
          text: chunks[i],
          createdAt: new Date().toISOString(),
        };

        if (i === 0 && embed) record.embed = embed;
        if (i > 0) {
          record.reply = {
            root: { uri: root.uri, cid: root.cid },
            parent: { uri: parent.uri, cid: parent.cid }
          };
        }

        const response = await this.agent.post(record);
        if (i === 0) {
          root = response;
          parent = response;
        } else {
          parent = response;
        }

        // Brief pause between chunks to ensure indexing order
        if (chunks.length > 1 && i < chunks.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
        }
      }

      return root;
    } catch (error) {
      console.error('[BlueskyService] Error creating post:', error);
      return null;
    }
  }

  splitIntoGraphemeChunks(text, limit) {
    if (text.length <= limit) return [text];
    const chunks = [];
    let current = text;
    while (current.length > limit) {
      let splitPos = current.lastIndexOf('\n', limit);
      if (splitPos === -1) splitPos = current.lastIndexOf('. ', limit);
      if (splitPos === -1) splitPos = current.lastIndexOf(' ', limit);
      if (splitPos === -1) splitPos = limit;
      chunks.push(current.substring(0, splitPos).trim());
      current = current.substring(splitPos).trim();
    }
    if (current) chunks.push(current);
    return chunks;
  }

  async postReply`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('src/services/blueskyService.js', content);
    console.log('Successfully added chunking to BlueskyService');
} else {
    console.error('Regex not matched');
}
