import fs from 'fs';
let content = fs.readFileSync('src/services/llmService.js', 'utf8');

const regex = /static lastRequestTime = 0;[\s\S]*?async _throttle\(\) \{[\s\S]*?LLMService\.lastRequestTime = Date\.now\(\);[\s\S]*?\}/;
const replacement = `static lastRequestTime = 0;

  async _throttle(priority = false) {
    const now = Date.now();
    const minDelay = priority ? 2000 : 5000;

    // Calculate the earliest the next request can start
    const targetStartTime = Math.max(now, LLMService.lastRequestTime + minDelay);

    // Reserve this time slot immediately
    LLMService.lastRequestTime = targetStartTime;

    const waitTime = targetStartTime - now;
    if (waitTime > 0) {
      console.log(\`[LLMService] Throttling (\${priority ? 'priority' : 'background'}) - waiting \${waitTime}ms...\`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);

    // Also ensure generateResponse uses the updated throttle correctly
    content = content.replace(
        'await this._throttle(options.platform === \'discord\');',
        'await this._throttle(options.platform === "discord" || options.platform === "bluesky" || options.is_direct_reply);'
    );

    fs.writeFileSync('src/services/llmService.js', content);
    console.log('Successfully updated LLMService throttling');
} else {
    console.error('Regex not matched');
}
