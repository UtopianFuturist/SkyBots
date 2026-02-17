import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import config from '../../config.js';

class OpenClawService {
    constructor() {
        this.skillsDir = path.resolve(process.cwd(), 'skills');
        this.skills = new Map(); // name -> skill data
    }

    async init() {
        console.log(`[OpenClawService] Initializing skills from ${this.skillsDir}`);
        await this.discoverSkills();
    }

    async discoverSkills() {
        try {
            await fs.mkdir(this.skillsDir, { recursive: true });
            const entries = await fs.readdir(this.skillsDir, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const skillPath = path.join(this.skillsDir, entry.name);
                    const skillMdPath = path.join(skillPath, 'SKILL.md');

                    try {
                        const content = await fs.readFile(skillMdPath, 'utf-8');
                        const skillData = this.parseSkillMd(content, skillPath);
                        if (skillData) {
                            this.skills.set(skillData.name, skillData);
                            console.log(`[OpenClawService] Loaded skill: ${skillData.name}`);
                        }
                    } catch (e) {
                        // Skip if SKILL.md doesn't exist or is invalid
                    }
                }
            }
        } catch (error) {
            console.error('[OpenClawService] Error discovering skills:', error);
        }
    }

    parseSkillMd(content, baseDir) {
        const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
        const match = content.match(frontmatterRegex);

        if (!match) return null;

        const frontmatter = match[1];
        const instructions = match[2].trim();

        const data = {};
        const lines = frontmatter.split('\n');
        for (const line of lines) {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length > 0) {
                const value = valueParts.join(':').trim();
                if (key.trim() === 'metadata') {
                    try {
                        data.metadata = JSON.parse(value);
                    } catch (e) {
                        data.metadata = value;
                    }
                } else {
                    data[key.trim()] = value;
                }
            }
        }

        if (!data.name) return null;

        return {
            name: data.name,
            description: data.description || 'No description provided.',
            metadata: data.metadata || {},
            instructions: instructions.replace(/\{baseDir\}/g, baseDir),
            baseDir: baseDir
        };
    }

    getSkillsForPrompt() {
        return Array.from(this.skills.values()).map(skill => {
            return `**${skill.name}**: ${skill.description}
  - Instructions: ${skill.instructions.substring(0, 500)}${skill.instructions.length > 500 ? '...' : ''}`;
        }).join('\n');
    }

    async executeSkill(name, parameters) {
        const skill = this.skills.get(name);
        if (!skill) throw new Error(`Skill ${name} not found.`);

        console.log(`[OpenClawService] Executing skill: ${name} with params:`, parameters);

        // OpenClaw skills typically execute a command or script.
        // We'll look for a 'command' or 'bin' in metadata or instructions.
        // For simplicity in this bridge, we'll try to find an executable script in the skill directory.

        const executablePath = path.join(skill.baseDir, 'run.sh'); // Common convention

        try {
            await fs.access(executablePath);
            return await this.runCommand(executablePath, parameters, skill.baseDir);
        } catch (e) {
            // If no run.sh, we might need a more complex dispatcher based on OpenClaw specs.
            // For now, we'll return a descriptive error or look for other patterns.
            return `Skill ${name} does not have a standard entry point (run.sh). Integration pending for this skill type.`;
        }
    }

    runCommand(command, params, cwd) {
        return new Promise((resolve, reject) => {
            const process = spawn('bash', [command, JSON.stringify(params)], {
                cwd,
                env: { ...process.env, SKILL_PARAMS: JSON.stringify(params) }
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => { stdout += data.toString(); });
            process.stderr.on('data', (data) => { stderr += data.toString(); });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout.trim());
                } else {
                    reject(new Error(`Skill failed with code ${code}. Stderr: ${stderr}`));
                }
            });
        });
    }
}

export const openClawService = new OpenClawService();
