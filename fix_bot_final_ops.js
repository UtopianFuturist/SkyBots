import fs from 'fs/promises';

async function fix() {
  const path = 'src/bot.js';
  let content = await fs.readFile(path, 'utf-8');

  const extractImagesMethod = `  _extractImages(post) {
    const images = [];
    if (post.record?.embed?.$type === 'app.bsky.embed.images') {
      for (let i = 0; i < post.record.embed.images.length; i++) {
        images.push({
          url: \`https://cdn.bsky.app/img/feed_fullsize/plain/\${post.author.did}/\${post.record.embed.images[i].image.ref['$link']}@jpeg\`,
          alt: post.record.embed.images[i].alt || ''
        });
      }
    }
    return images;
  }`;

  // Insert before the last closing brace
  const lastBrace = content.lastIndexOf('}');
  content = content.slice(0, lastBrace) + '\n' + extractImagesMethod + '\n' + content.slice(lastBrace);

  await fs.writeFile(path, content);
  console.log('Restored _extractImages to src/bot.js.');
}
fix();
