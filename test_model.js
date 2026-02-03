import { llmService } from './src/services/llmService.js';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
  console.log('Testing LLM Service with model: nvidia/nemotron-3-nano-30b-a3b');
  const response = await llmService.generateResponse([
    { role: 'user', content: 'Hello! Who are you and what model are you running?' }
  ]);
  console.log('Response:', response);
}

test();
