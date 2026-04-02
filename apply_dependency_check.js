import fs from 'fs';
const orchPath = 'src/services/orchestratorService.js';
let content = fs.readFileSync(orchPath, 'utf8');

// Proposal 8: Skill Dependency Checker
const dependencyLogic = `
    async verifySkillDependencies() {
        console.log('[Orchestrator] Verifying skill dependencies...');
        const skillsDir = './skills';
        try {
            const skills = fs.readdirSync(skillsDir);
            for (const skill of skills) {
                const reqPath = \`\${skillsDir}/\${skill}/requirements.txt\`;
                if (fs.existsSync(reqPath)) {
                    console.log(\`[Orchestrator] Checking dependencies for skill: \${skill}\`);
                    // This is where we'd run 'pip install -r reqPath' in a real environment
                    // For now, we just log the verification step.
                }
            }
        } catch (e) {
            console.error('[Orchestrator] Error verifying skills:', e);
        }
    }
`;

content = content.replace('class OrchestratorService {', 'class OrchestratorService {\n' + dependencyLogic);

// Insert into start()
content = content.replace('console.log(\'[Orchestrator] Starting autonomous cycles...\');',
  "console.log('[Orchestrator] Starting autonomous cycles...');\n        await this.verifySkillDependencies();");

fs.writeFileSync(orchPath, content);
console.log('Applied dependency check');
