import sys

def fix():
    path = 'src/services/llmService.js'
    with open(path, 'r') as f:
        content = f.read()

    # In analyzeImage, add 404 fallback
    search_878 = """        throw new Error(`Nvidia NIM API error (${response.status}): ${errorText}`);
      }"""

    # We need to distinguish between analyzeImage and generateResponse
    parts = content.split('  async analyzeImage')
    p2 = parts[1].split('  async ', 1)
    analyze_block = p2[0]

    analyze_block = analyze_block.replace(
        '        throw new Error(`Nvidia NIM API error (${response.status}): ${errorText}`);',
        """        if (response.status === 404 && actualModel === this.visionModel && this.fallbackVisionModel && this.fallbackVisionModel !== this.visionModel) {
            console.warn(`[LLMService] [${requestId}] Vision model 404. Trying fallback: ${this.fallbackVisionModel}`);
            clearTimeout(timeout);
            return this.analyzeImage(imageSource, altText, { ...options, modelOverride: this.fallbackVisionModel });
        }
        throw new Error(`Nvidia NIM API error (${response.status}): ${errorText}`);"""
    )

    parts[1] = analyze_block + '  async ' + p2[1]
    content = '  async analyzeImage'.join(parts)

    with open(path, 'w') as f:
        f.write(content)

fix()
