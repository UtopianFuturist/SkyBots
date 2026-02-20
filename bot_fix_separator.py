import sys

with open('src/bot.js', 'r') as f:
    content = f.read()

content = content.replace(
    'const keywordsArg = allKeywords.length > 0 ? `--keywords "${allKeywords.join(\',\')}"` : \'\';',
    'const keywordsArg = allKeywords.length > 0 ? `--keywords "${allKeywords.join(\'|\')}"` : \'\';'
)

content = content.replace(
    'const negativesArg = `--negatives "${config.FIREHOSE_NEGATIVE_KEYWORDS.join(\',\')}"`;',
    'const negativesArg = `--negatives "${config.FIREHOSE_NEGATIVE_KEYWORDS.join(\'|\')}"`;'
)

with open('src/bot.js', 'w') as f:
    f.write(content)
