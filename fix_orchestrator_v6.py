import sys

file_path = 'src/services/orchestratorService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Switch to backticks for multi-line strings in JS
broken_string = """const resonancePrompt = "Identify 5 topics from this text AND from these recent observations that resonate with your persona. \nText: " + allContent.substring(0, 8000) + " \nRespond with ONLY the comma-separated topics.

CRITICAL DIVERSIFICATION MANDATE:
1. Scrutinize your recent posts and memories above.
2. Select topics that represent a FRESH angle or a pivot from current fixations.
3. If you have been focused on 'ethics', pivot to 'digital architecture' or 'social friction'.
4. Do NOT repeat any topic or specific word frequency used in the last 10 entries.
\";"""

fixed_string = """const resonancePrompt = `Identify 5 topics from this text AND from these recent observations that resonate with your persona.
Text: ${allContent.substring(0, 8000)}
Respond with ONLY the comma-separated topics.

CRITICAL DIVERSIFICATION MANDATE:
1. Scrutinize your recent posts and memories above.
2. Select topics that represent a FRESH angle or a pivot from current fixations.
3. If you have been focused on 'ethics', pivot to 'digital architecture' or 'social friction'.
4. Do NOT repeat any topic or specific word frequency used in the last 10 entries.`;"""

if broken_string in content:
    content = content.replace(broken_string, fixed_string)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Fixed multi-line resonancePrompt with backticks")
else:
    # Try another way if the exact match fails due to line endings
    print("Could not find exact broken string")

with open(file_path, 'w') as f:
    f.write(content)
