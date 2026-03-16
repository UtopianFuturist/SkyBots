import os

file_path = 'src/services/llmService.js'
with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if "console.error(`[LLMService] Error with ${model}:`, error.message);" in line:
        new_lines.append("              const errorMessage = error.message || 'Unknown error';\n")
        new_lines.append("              console.error(`[LLMService] Error with ${model} (Attempt ${attempts}):`, errorMessage);\n")
        new_lines.append("              if (error.stack) console.error(`[LLMService] STACK: ${error.stack}`);\n")
    elif "if (error.name === 'AbortError' || error.message.includes('timeout')) {" in line:
        new_lines.append("              if (error.name === 'AbortError' || (errorMessage && errorMessage.toLowerCase().includes('timeout'))) {\n")
    elif "console.error(`[LLMService] All models failed. Final error:`, lastError?.message);" in line:
        new_lines.append("    console.error(`[LLMService] All models failed. Final error:`, lastError?.message || 'Undefined');\n")
    else:
        new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)
print("Patch applied")
