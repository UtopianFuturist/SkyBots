import sys

with open('src/utils/textUtils.js', 'r') as f:
    content = f.read()

blacklist_const = """
export const KEYWORD_BLACKLIST = [
    "glass", "ruins", "everything", "nothing", "somebody", "anybody", "someone", "anyone", "something", "anything",
    "about", "their", "there", "would", "could", "should", "people", "really", "think", "thought", "going",
    "thanks", "thank", "hello", "please", "maybe", "actually", "probably", "just", "very", "much", "many",
    "always", "never", "often", "sometimes", "usually", "almost", "quite", "rather", "somewhat", "too", "enough"
];
"""

if 'export const KEYWORD_BLACKLIST' not in content:
    content = blacklist_const + content

with open('src/utils/textUtils.js', 'w') as f:
    f.write(content)
