import os

file_path = 'src/services/llmService.js'
with open(file_path, 'r') as f:
    content = f.read()

old_end = """    console.error(`[LLMService] All models failed. Final error:`, lastError?.message || 'Undefined');
    return null;
  }"""

new_end = """    console.error(`[LLMService] All models failed. Final error:`, lastError?.message || 'Undefined');

    // Final Last Resort Fallback: Use Step 3.5 Flash regardless of circuit breaker or request type
    if (config.STEP_MODEL) {
      try {
        console.log(`[LLMService] LAST RESORT: Attempting final fallback with ${config.STEP_MODEL}...`);
        const fullMessages = this._prepareMessages(messages, systemPrompt);
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.NVIDIA_NIM_API_KEY}`
          },
          body: JSON.stringify({
            model: config.STEP_MODEL,
            messages: fullMessages,
            temperature: 0.7,
            max_tokens: 1024
          }),
          agent: persistentAgent,
          timeout: 60000
        });
        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            console.log(`[LLMService] Final fallback successful with ${config.STEP_MODEL}.`);
            return content;
          }
        }
      } catch (e) {
        console.error(`[LLMService] Final fallback failed:`, e.message);
      }
    }

    return null;
  }"""

if old_end in content:
    content = content.replace(old_end, new_end)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Final fallback patch applied")
else:
    # Try with original version if previous patch changed it slightly
    old_end_alt = """    console.error(`[LLMService] All models failed. Final error:`, lastError?.message);
    return null;
  }"""
    if old_end_alt in content:
        content = content.replace(old_end_alt, new_end)
        with open(file_path, 'w') as f:
            f.write(content)
        print("Final fallback patch applied (alt)")
    else:
        print("Could not find patch location")
