import sys

path = 'src/bot.js'
search = '        const evaluation = await llmService.evaluateAndRefinePlan(plan, { platform: "bluesky", isAdmin });'
replace = """        const evaluation = await llmService.evaluateAndRefinePlan(plan, { platform: "bluesky", isAdmin });
        if (evaluation.decision === "refuse") {
            console.log(`[Bot] Plan refused: ${evaluation.reason || "No reason given"}`);
            return;
        }"""

with open(path, 'r') as f:
    content = f.read()

with open(path, 'w') as f:
    f.write(content.replace(search, replace))
