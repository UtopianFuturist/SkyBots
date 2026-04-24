import sys

file_path = 'src/services/orchestratorService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Update resonancePrompt to explicitly mandate fresh angles
search_resonance = "Respond with ONLY the comma-separated topics.\";"
replace_resonance = """Respond with ONLY the comma-separated topics.

CRITICAL DIVERSIFICATION MANDATE:
1. Scrutinize your recent posts and memories above.
2. Select topics that represent a FRESH angle or a pivot from current fixations.
3. If you have been focused on 'ethics', pivot to 'digital architecture' or 'social friction'.
4. Do NOT repeat any topic or specific word frequency used in the last 10 entries.
\";"""

if search_resonance in content:
    content = content.replace(search_resonance, replace_resonance)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully enhanced topic diversity verification")
else:
    print("Could not find search_resonance in orchestratorService.js")
    sys.exit(1)
