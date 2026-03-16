import os

file_path = 'src/services/llmService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix the catch block to include more detail
old_catch = """            } catch (error) {
              console.error(`[LLMService] Error with ${model}:`, error.message);
              if (error.name === 'AbortError' || error.message.includes('timeout')) {
                  this.lastTimeout = Date.now();
              }
              lastError = error;
              if (attempts < maxAttempts) {
                  await new Promise(r => setTimeout(r, 2000 * attempts));
                  continue;
              }
            }"""

new_catch = """            } catch (error) {
              const errorMessage = error.message || 'Unknown error';
              console.error(`[LLMService] Error with ${model} (Attempt ${attempts}):`, errorMessage);
              if (error.stack) console.error(error.stack);

              if (error.name === 'AbortError' || errorMessage.toLowerCase().includes('timeout')) {
                  this.lastTimeout = Date.now();
              }
              lastError = error;
              if (attempts < maxAttempts) {
                  await new Promise(r => setTimeout(r, 2000 * attempts));
                  continue;
              }
            }"""

if old_catch in content:
    content = content.replace(old_catch, new_catch)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Patch applied successfully")
else:
    print("Could not find old_catch in content")
