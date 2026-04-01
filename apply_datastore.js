import fs from 'fs';
let ds = fs.readFileSync('src/services/dataStore.js', 'utf8');
ds = ds.replace('last_autonomous_post_time: 0,',
    'last_autonomous_post_time: 0,\n      last_bluesky_image_post_time: 0,\n      text_posts_since_last_image: 0,');
ds = ds.replace('console.log(`[RENDER_LOG] [${type.toUpperCase()}] ${consoleMsg.substring(0, 500)}`);',
    'const prefix = type.toUpperCase(); console.log(`\\n[RENDER_LOG] [${prefix}] ${"-".repeat(Math.max(0, 40 - prefix.length))}\\n${consoleMsg.substring(0, 1000)}\\n[RENDER_LOG] ${"-".repeat(40)}`);');
ds = ds.replace('this.db.data.persona_blurbs.push(blurb);',
    'const entry = typeof blurb === "string" ? { text: blurb, uri: `ds_${Date.now()}`, timestamp: Date.now() } : { ...blurb, uri: blurb.uri || `ds_${Date.now()}` };\n      this.db.data.persona_blurbs.push(entry);');

const dsMethods = `
  getLastBlueskyImagePostTime() { return this.db?.data?.last_bluesky_image_post_time || 0; }
  async updateLastBlueskyImagePostTime(t) {
    if (this.db?.data) {
      this.db.data.last_bluesky_image_post_time = t;
      this.db.data.text_posts_since_last_image = 0;
      await this.write();
    }
  }
  getTextPostsSinceLastImage() { return this.db?.data?.text_posts_since_last_image || 0; }
  async incrementTextPostsSinceLastImage() {
    if (this.db?.data) {
      this.db.data.text_posts_since_last_image = (this.db.data.text_posts_since_last_image || 0) + 1;
      await this.write();
    }
  }`;

const dsLines = ds.split('\n');
const dsLastBraceIndex = dsLines.findLastIndex(l => l.trim() === '}');
dsLines.splice(dsLastBraceIndex, 0, dsMethods);
fs.writeFileSync('src/services/dataStore.js', dsLines.join('\n'));
console.log("DataStore.js updated");
