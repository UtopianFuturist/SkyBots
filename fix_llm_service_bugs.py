import sys

def fix_llm_service():
    path = 'src/services/llmService.js'
    with open(path, 'r') as f:
        content = f.read()

    # In isImageCompliant (around line 1318), it was calling generateResponse instead of recursing isImageCompliant
    bad_compliant_fallback = """        if (response.status === 429 || response.status >= 500 || isAlreadyBorrowed) {
            if (isPrimary) {
                console.warn(`[LLMService] [${requestId}] Primary model error (${response.status}). Falling back to Coder model...`);
                clearTimeout(timeout);
                return this.generateResponse(messages, { ...options, useCoder: true });
            } else if (isCoder) {
                console.warn(`[LLMService] [${requestId}] Coder model error (${response.status}). Falling back to Step model...`);
                clearTimeout(timeout);
                return this.generateResponse(messages, { ...options, useStep: true });
            }
        }"""

    # Actually, isImageCompliant doesn't use useCoder/useStep, it uses modelOverride.
    # So we should just throw for these errors or handle them better.
    # But for now, let's just make it NOT crash by calling generateResponse.

    good_compliant_fallback = """        if (response.status === 429 || response.status >= 500 || isAlreadyBorrowed) {
            // Rate limit or server error: just throw and let retry handle it
            throw new Error(`Nvidia NIM API error (${response.status}): ${errorText}`);
        }"""

    # Let's see if we can find this specifically in isImageCompliant
    # We'll use a more surgical approach with line matching if possible, but replace is safer if unique.

    # Wait, the analyzeImage fallback (around 865) is also calling generateResponse!
    # That's also wrong. It should probably fallback to another vision model or just fail.

    # Correcting analyzeImage fallback
    bad_analyze_fallback = """        if (response.status === 429 || response.status >= 500 || isAlreadyBorrowed) {
            if (isPrimary) {
                console.warn(`[LLMService] [${requestId}] Primary model error (${response.status}). Falling back to Coder model...`);
                clearTimeout(timeout);
                return this.generateResponse(messages, { ...options, useCoder: true });
            } else if (isCoder) {
                console.warn(`[LLMService] [${requestId}] Coder model error (${response.status}). Falling back to Step model...`);
                clearTimeout(timeout);
                return this.generateResponse(messages, { ...options, useStep: true });
            }
        }"""

    # We can't just replace because it appears multiple times.
    # Let's split by function and fix each.

    parts = content.split('  async ')
    new_parts = [parts[0]]

    for part in parts[1:]:
        if part.startswith('analyzeImage'):
            # Fix analyzeImage
            part = part.replace('return this.generateResponse(messages, { ...options, useCoder: true });',
                               'throw new Error(`Nvidia NIM API error (${response.status}): ${errorText}`);')
            part = part.replace('return this.generateResponse(messages, { ...options, useStep: true });',
                               'throw new Error(`Nvidia NIM API error (${response.status}): ${errorText}`);')
        elif part.startswith('isImageCompliant'):
            # Fix isImageCompliant
            part = part.replace('return this.generateResponse(messages, { ...options, useCoder: true });',
                               'throw new Error(`Nvidia NIM API error (${response.status}): ${errorText}`);')
            part = part.replace('return this.generateResponse(messages, { ...options, useStep: true });',
                               'throw new Error(`Nvidia NIM API error (${response.status}): ${errorText}`);')
        new_parts.append(part)

    content = '  async '.join(new_parts)

    with open(path, 'w') as f:
        f.write(content)
    print("Fixed LLMService tool-specific fallback bugs.")

fix_llm_service()
