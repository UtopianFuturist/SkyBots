import sys

def fix_vision_404():
    path = 'src/services/llmService.js'
    with open(path, 'r') as f:
        content = f.read()

    # In analyzeImage, correctly handle 404 fallback
    search_analyze_404 = """        if (response.status === 404 && actualModel === this.visionModel) {
            console.warn(`[LLMService] [${requestId}] Primary vision model 404. Falling back to ${this.fallbackVisionModel}. NVIDIA Response: ${errorText}`);
            return this.analyzeImage(imageSource, altText, { ...options, modelOverride: this.fallbackVisionModel });
        }"""

    # Wait, I already fixed that in the previous step? Let's check lines 881.
    # Ah, I see it's missing in some parts or incorrectly structured.

fix_vision_404()
