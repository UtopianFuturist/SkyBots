import fs from 'fs/promises';
import { Bot } from './src/bot.js';

const bot = new Bot();
const initCode = bot.init.toString();
console.log(initCode);
