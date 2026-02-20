import sys

with open('src/bot.js', 'r') as f:
    content = f.read()

# Fix containsSlop -> isSlopCand and remove 'last' prefixes in performAutonomousPost
# Re-locate the block
search_text = 'if (isJaccardRepetitive || hasPrefixMatch || containsSlop || varietyCheck.repetitive || !personaCheck.aligned) {'
# We need to find this specifically in performAutonomousPost.
# It appears after 'Checking coherence for autonomous' or similar.

content = content.replace(
    'if (isJaccardRepetitive || hasPrefixMatch || containsSlop || varietyCheck.repetitive || !personaCheck.aligned) {',
    'if (isJaccardRepetitive || hasPrefixMatch || isSlopCand || varietyCheck.repetitive || !personaCheck.aligned) {'
)

content = content.replace(
    'postFeedback = containsSlop ? `REJECTED: Contains forbidden metaphorical "slop": "${slopInfo.reason}". You MUST avoid this specific phrase in your next attempt.` :',
    'postFeedback = isSlopCand ? `REJECTED: Contains forbidden metaphorical "slop": "${slopInfo.reason}". You MUST avoid this specific phrase in your next attempt.` :'
)

content = content.replace(
    '(lastHasPrefixMatch ? "Prefix overlap detected (starts too similarly to a recent message)." :',
    '(hasPrefixMatch ? "Prefix overlap detected (starts too similarly to a recent message)." :'
)

content = content.replace(
    '(!lastPersonaCheck.aligned ? `Not persona aligned: ${lastPersonaCheck.feedback}` :',
    '(!personaCheck.aligned ? `Not persona aligned: ${personaCheck.feedback}` :'
)

with open('src/bot.js', 'w') as f:
    f.write(content)
