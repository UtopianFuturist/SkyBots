import sys

def fix_llm_400():
    path = 'src/services/llmService.js'
    with open(path, 'r') as f:
        lines = f.readlines()

    new_lines = []
    found_fix_spot = False
    for i in range(len(lines)):
        line = lines[i]
        new_lines.append(line)
        if 'const finalMessages = preface_system_prompt ? [' in line:
            # We found the assignment. Now let's insert the check after it.
            # We need to find the end of this assignment
            j = i + 1
            while j < len(lines) and '];' not in lines[j]:
                j += 1

            if j < len(lines):
                # Found the end of assignment. Insert check after lines[j]
                # Actually, let's just rewrite this part for clarity
                pass

    # Direct replacement is cleaner for this specific logic
    content = "".join(lines)

    old_logic = """    const finalMessages = preface_system_prompt ? [
        { role: 'system', content: this._buildSystemPrompt(systemPrompt, openingBlacklist, tropeBlacklist, additionalConstraints, currentMood) },
        ...userMessages
    ] : messages;"""

    new_logic = """    let finalMessages = preface_system_prompt ? [
        { role: 'system', content: this._buildSystemPrompt(systemPrompt, openingBlacklist, tropeBlacklist, additionalConstraints, currentMood) },
        ...userMessages
    ] : [...messages];

    // CRITICAL: Ensure at least one 'user' message exists for Nvidia NIM API
    if (!finalMessages.some(m => m.role === 'user')) {
        finalMessages.push({ role: 'user', content: 'Please process the above context and respond accordingly.' });
    }"""

    if old_logic in content:
        content = content.replace(old_logic, new_logic)
        with open(path, 'w') as f:
            f.write(content)
        print("Successfully fixed potential 400 error in LLMService.")
    else:
        print("Target logic not found for replacement.")

fix_llm_400()
