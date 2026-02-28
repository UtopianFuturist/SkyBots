import sys

def replace_in_file(filename, search_text, replace_text):
    with open(filename, 'r') as f:
        content = f.read()
    if search_text not in content:
        print(f"Error: Search text not found in {filename}")
        # print("Content around expected search area:")
        # start = content.find("async isImageCompliant")
        # print(content[start:start+500])
        return False
    new_content = content.replace(search_text, replace_text)
    with open(filename, 'w') as f:
        f.write(new_content)
    print(f"Successfully updated {filename}")
    return True

# Fix LLMService.js
llm_search = """      if (!response.ok) {
        const errorText = await response.text();
        const isAlreadyBorrowed = errorText.includes("Already borrowed") || (response.status === 400 && errorText.includes("Already borrowed"));
        const isPrimary = !useCoder && !useStep;
        const isCoder = useCoder && !useStep;

        if (response.status === 429 || response.status >= 500 || isAlreadyBorrowed) {"""

llm_replace = """      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[LLMService] [${requestId}] Nvidia NIM API error (${response.status}): ${errorText}`);

        // If vision model 404s, try fallback
        if (response.status === 404 && actualModel === this.visionModel && this.fallbackVisionModel && this.fallbackVisionModel !== this.visionModel) {
            console.warn(`[LLMService] [${requestId}] Vision model 404. Trying fallback: ${this.fallbackVisionModel}`);
            clearTimeout(timeout);
            return this.isImageCompliant(imageSource, { ...options, modelOverride: this.fallbackVisionModel });
        }

        const isAlreadyBorrowed = errorText.includes("Already borrowed") || (response.status === 400 && errorText.includes("Already borrowed"));
        const isPrimary = !useCoder && !useStep;
        const isCoder = useCoder && !useStep;

        if (response.status === 429 || response.status >= 500 || isAlreadyBorrowed) {"""

# Note: The above search text might be slightly different in generateResponse vs isImageCompliant
# Actually isImageCompliant has its own fetch block.

llm_search_v2 = """      if (!response.ok) {
        const errorText = await response.text();
        const isAlreadyBorrowed = errorText.includes("Already borrowed") || (response.status === 400 && errorText.includes("Already borrowed"));"""

llm_replace_v2 = """      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[LLMService] [${requestId}] Nvidia NIM API error (${response.status}): ${errorText}`);

        // If vision model 404s, try fallback
        if (response.status === 404 && actualModel === this.visionModel && this.fallbackVisionModel && this.fallbackVisionModel !== this.visionModel) {
            console.warn(`[LLMService] [${requestId}] Vision model 404. Trying fallback: ${this.fallbackVisionModel}`);
            clearTimeout(timeout);
            return this.isImageCompliant(imageSource, { ...options, modelOverride: this.fallbackVisionModel });
        }

        const isAlreadyBorrowed = errorText.includes("Already borrowed") || (response.status === 400 && errorText.includes("Already borrowed"));"""

# Fix bot.js
bot_search = """        const lastInteraction = history[history.length - 1];
        const quietMins = (Date.now() - lastInteraction.timestamp) / (1000 * 60);

        return quietMins < 10;"""

bot_replace = """        const lastUserMessage = [...history].reverse().find(m => m.role === 'user');
        if (!lastUserMessage) return false;

        const quietMins = (Date.now() - lastUserMessage.timestamp) / (1000 * 60);

        return quietMins < 10;"""

if replace_in_file('src/services/llmService.js', llm_search_v2, llm_replace_v2):
    replace_in_file('src/bot.js', bot_search, bot_replace)
else:
    # Try another variation for llmService
    pass
