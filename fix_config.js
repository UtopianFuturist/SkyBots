import fs from 'fs';
const path = 'config.js';
let content = fs.readFileSync(path, 'utf8');

// The issue is trying to access 'config' while defining 'config'.
// We should use process.env.BOT_NAME directly or move the nickname definition.

const oldLine = "BOT_NICKNAMES: process.env.BOT_NICKNAMES ? process.env.BOT_NICKNAMES.split(',') : [config.BOT_NAME || 'Sydney'],";
const newLine = "BOT_NICKNAMES: process.env.BOT_NICKNAMES ? process.env.BOT_NICKNAMES.split(',') : [process.env.BOT_NAME || 'Sydney'],";

content = content.replace(oldLine, newLine);
fs.writeFileSync(path, content);
