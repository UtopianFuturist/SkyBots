import fs from 'fs/promises';

async function fix() {
  const path = 'src/services/dataStore.js';
  let content = await fs.readFile(path, 'utf-8');

  // Helper to replace method body
  function replaceMethod(content, name, newBody) {
    const start = content.indexOf(`${name}(`);
    if (start === -1) return content;
    const braceStart = content.indexOf('{', start);
    let count = 1;
    let pos = braceStart + 1;
    while (count > 0 && pos < content.length) {
      if (content[pos] === '{') count++;
      else if (content[pos] === '}') count--;
      pos++;
    }
    return content.slice(0, start) + newBody + content.slice(pos);
  }

  const lockoutMethod = `isUserLockedOut(did) {
    const lockouts = this.db.data.boundary_lockouts || {};
    const lockout = lockouts[did];
    if (!lockout) return false;
    if (Date.now() > lockout.expires_at) {
      delete lockouts[did];
      return false;
    }
    return true;
  }`;

  const setLockoutMethod = `async setBoundaryLockout(did, minutes = 60) {
    if (!this.db.data.boundary_lockouts) this.db.data.boundary_lockouts = {};
    this.db.data.boundary_lockouts[did] = {
      expires_at: Date.now() + (minutes * 60 * 1000),
      reason: 'Boundary violation'
    };
    await this.db.write();
  }`;

  const hasRepliedMethod = `hasReplied(uri) {
    return (this.db.data.replied_posts || []).includes(uri);
  }`;

  content = replaceMethod(content, 'isUserLockedOut', lockoutMethod);
  content = replaceMethod(content, 'setBoundaryLockout', setLockoutMethod);

  // Check if hasReplied exists, if not add it
  if (!content.includes('hasReplied(')) {
    const lastBrace = content.lastIndexOf('}');
    content = content.slice(0, lastBrace) + '\n  ' + hasRepliedMethod + '\n' + content.slice(lastBrace);
  }

  await fs.writeFile(path, content);
  console.log('Successfully updated DataStore methods for lockout and reply tracking.');
}
fix();
