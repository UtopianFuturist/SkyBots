import sys
import os

def fix_llm_service():
    path = 'src/services/llmService.js'
    with open(path, 'r') as f:
        content = f.read()

    # 1. Fix generateResponse error handling (lines 300-335ish)
    # Remove the empty block and redundant code
    search_gen = """      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[LLMService] [${requestId}] Nvidia NIM API error (${response.status}): ${errorText}`);

        }

        const isAlreadyBorrowed = errorText.includes("Already borrowed") || (response.status === 400 && errorText.includes("Already borrowed"));"""

    replace_gen = """      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[LLMService] [${requestId}] Nvidia NIM API error (${response.status}): ${errorText}`);

        const isAlreadyBorrowed = errorText.includes("Already borrowed") || (response.status === 400 && errorText.includes("Already borrowed"));"""

    content = content.replace(search_gen, replace_gen)

    # 2. Fix analyzeImage error handling (lines 859-885ish)
    search_analyze = """      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[LLMService] [${requestId}] Nvidia NIM API error (${response.status}): ${errorText}`);

        }

        const isAlreadyBorrowed = errorText.includes("Already borrowed") || (response.status === 400 && errorText.includes("Already borrowed"));"""

    replace_analyze = """      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[LLMService] [${requestId}] Nvidia NIM API error (${response.status}): ${errorText}`);

        const isAlreadyBorrowed = errorText.includes("Already borrowed") || (response.status === 400 && errorText.includes("Already borrowed"));"""

    content = content.replace(search_analyze, replace_analyze)

    # 3. Fix isImageCompliant recursive call (lines 1333-1336ish)
    # It was calling analyzeImage instead of isImageCompliant
    search_compliant_err = """        if (response.status === 404 && actualModel === this.visionModel) {
            console.warn(`[LLMService] [${requestId}] Primary vision model 404. Falling back to ${this.fallbackVisionModel}. NVIDIA Response: ${errorText}`);
            return this.analyzeImage(imageSource, altText, { ...options, modelOverride: this.fallbackVisionModel });
        }"""

    # Wait, in isImageCompliant, it doesn't have altText.
    # Looking at the code:
    # return this.isImageCompliant(imageSource, { ...options, modelOverride: this.fallbackVisionModel });
    # is already present at line 1311-1315.

    # So the block at 1333 is redundant and wrong.
    redundant_block = """        if (response.status === 404 && actualModel === this.visionModel) {
            console.warn(`[LLMService] [${requestId}] Primary vision model 404. Falling back to ${this.fallbackVisionModel}. NVIDIA Response: ${errorText}`);
            return this.analyzeImage(imageSource, altText, { ...options, modelOverride: this.fallbackVisionModel });
        }"""

    content = content.replace(redundant_block, "")

    with open(path, 'w') as f:
        f.write(content)
    print("Fixed LLMService structure.")

fix_llm_service()
