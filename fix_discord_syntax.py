import re

with open('src/services/discordService.js', 'r') as f:
    content = f.read()

# Fix the broken string joining
content = re.sub(
    r"\$\{actionResults\.join\('\n'\)\}\` \}\);",
    r"${actionResults.join('\\n')}` });",
    content,
    flags=re.DOTALL
)

with open('src/services/discordService.js', 'w') as f:
    f.write(content)
