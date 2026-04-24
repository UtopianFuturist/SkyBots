import sys

file_path = 'src/services/orchestratorService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Make performAutonomousConsultation actually exist in the class
if 'async performAutonomousConsultation() {' not in content:
    consult_method = """
    async performAutonomousConsultation() {
        try {
            const res = await llmService.generateResponse([{ role: 'system', content: "Do you need subagent consultation? JSON: {\\"needs_consultation\\": boolean, \\"subagent\\": \\"name\\", \\"topic\\": \\"...\\"}" }], { useStep: true });
            const decision = llmService.extractJson(res);
            if (decision?.needs_consultation) await this.consultSubagent(decision.subagent, decision.topic);
        } catch (e) {}
    }
"""
    if 'async consultSubagent(subagentName, topic) {' in content:
        content = content.replace('async consultSubagent(subagentName, topic) {', consult_method + '\n    async consultSubagent(subagentName, topic) {')
        with open(file_path, 'w') as f:
            f.write(content)
        print("Restored performAutonomousConsultation")
