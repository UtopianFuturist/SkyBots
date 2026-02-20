import sys

with open('src/bot.js', 'r') as f:
    content = f.read()

# 1. Clean up previous messed up insertions
content = content.replace('                    let containsSlop = false;\n                    let hasPrefixMatch = false;\n                    let personaCheckResult = { aligned: true };\n                    let varietyCheckResult = { feedback: "Too similar to recent history." };', '')
content = content.replace('let isJaccardRepetitive = false;', '')

# 2. Re-locate and fix the heartbeat loop
search_marker = 'pollResult = await llmService.performInternalPoll({'
start_idx = content.find(search_marker)
if start_idx == -1:
    print("Could not find start marker")
    sys.exit(1)

# Find the start of the while loop after the poll
while_marker = 'while (attempts < MAX_ATTEMPTS) {'
while_idx = content.find(while_marker, start_idx)

# Insert the lifted variables before the while loop
lifted_vars = """
                let lastContainsSlop = false;
                let lastIsJaccardRepetitive = false;
                let lastHasPrefixMatch = false;
                let lastPersonaCheck = { aligned: true };
                let lastVarietyCheck = { feedback: "Too similar to recent history." };
"""
content = content[:while_idx] + lifted_vars + content[while_idx:]

# 3. Fix the candidate evaluation loop
# I'll use regex or careful string replacement for the loop body
import re

# Fix the evaluation loop logic
loop_start = content.find('for (const evalResult of evaluations) {')
loop_end = content.find('if (bestCandidate) {', loop_start)
loop_body = content[loop_start:loop_end]

# Replace the inner evaluation block
new_loop_body = """for (const evalResult of evaluations) {
                        const { cand, varietyCheck, personaCheck, hasPrefixMatch: hpm, isJaccardRepetitive: jRep, isExactDuplicate, error } = evalResult;
                        if (error) {
                            rejectedAttempts.push(cand);
                            continue;
                        }

                        const slopInfo = getSlopInfo(cand);
                        const isSlopCand = slopInfo.isSlop;

                        // Score components: Variety (0.5), Mood Alignment (0.3), Length (0.2)
                        const lengthBonus = Math.min(cand.length / 500, 0.2);
                        const varietyWeight = (varietyCheck.variety_score ?? varietyCheck.score ?? 0) * 0.5;
                        const moodWeight = (varietyCheck.mood_alignment_score ?? 0) * 0.3;
                        const score = varietyWeight + moodWeight + lengthBonus;

                        console.log(`[Bot] Heartbeat candidate evaluation: Score=${score.toFixed(2)} (Var: ${varietyCheck.variety_score ?? varietyCheck.score ?? 0}, Mood: ${varietyCheck.mood_alignment_score ?? 0}, Bonus: ${lengthBonus.toFixed(2)}), Slop=${isSlopCand}, Aligned=${personaCheck.aligned}, Exact=${isExactDuplicate}, PrefixMatch=${hpm}, JaccardRep=${jRep}`);

                        if (!isSlopCand && !varietyCheck.repetitive && !isExactDuplicate && !hpm && !jRep && personaCheck.aligned) {
                            if (score > bestScore) {
                                bestScore = score;
                                bestCandidate = cand;
                            }
                        } else {
                            if (!bestCandidate) {
                                lastIsJaccardRepetitive = jRep;
                                lastHasPrefixMatch = hpm;
                                lastPersonaCheck = personaCheck;
                                lastVarietyCheck = varietyCheck;
                                lastContainsSlop = isSlopCand;
                            }
                            rejectedAttempts.push(cand);
                        }
                    }
                    """

content = content[:loop_start] + new_loop_body + content[loop_end:]

# 4. Fix the feedback assignment
feedback_start = content.find('feedback = lastContainsSlop ? "Contains metaphorical slop." :')
feedback_end = content.find('rejectedAttempts.push(message);', feedback_start)

new_feedback = """feedback = lastContainsSlop ? "Contains metaphorical slop." :
                                   (lastIsJaccardRepetitive ? "Jaccard similarity threshold exceeded (too similar to history)." :
                                   (lastHasPrefixMatch ? "Prefix overlap detected (starts too similarly to a recent message)." :
                                   (!lastPersonaCheck.aligned ? `Not persona aligned: ${lastPersonaCheck.feedback}` :
                                   (lastVarietyCheck.feedback || "Too similar to recent history."))));
                        """

content = content[:feedback_start] + new_feedback + content[feedback_end:]

with open('src/bot.js', 'w') as f:
    f.write(content)
