import fs from 'fs/promises';
import path from 'path';

class ToolService {
  constructor() {
    this.skillsPath = path.join(process.cwd(), 'skills.md');
    this.skillsDir = path.join(process.cwd(), 'skills');
    this.tools = {};
    this.bareList = [];
    this.lastReload = 0;
  }

  /**
   * Initialize or reload tool definitions from skills.md and the skills/ directory.
   */
  async init() {
    try {
      const content = await fs.readFile(this.skillsPath, 'utf8');
      this._parseSkillsMd(content);
      await this._discoverExternalSkills();
      this.lastReload = Date.now();
      console.log(`[ToolService] Initialized with ${Object.keys(this.tools).length} tools.`);
    } catch (error) {
      console.error('[ToolService] Initialization failed:', error);
    }
  }

  _parseSkillsMd(content) {
    const tools = {};
    const bareList = [];

    // Parse Bare List Table
    const tableMatch = content.match(/\| Tool Name \| Primary Intent \|\r?\n\|-+\|-+\|\r?\n([\s\S]*?)(?=\r?\n\r?\n|---|$)/);
    if (tableMatch) {
        const rows = tableMatch[1].trim().split(/\r?\n/);
        for (const row of rows) {
            const parts = row.split('|').map(p => p.trim()).filter(Boolean);
            if (parts.length >= 2) {
                const name = parts[0].replace(/`/g, '');
                bareList.push({ name, intent: parts[1] });
            }
        }
    }

    // Parse Full Definitions (JSON Blocks)
    // We look for sections like ### tool_name followed by a JSON block
    const toolSections = content.split(/###\s+/).slice(1);
    for (const section of toolSections) {
        const lines = section.split(/\r?\n/);
        const name = lines[0].trim().toLowerCase();

        const jsonMatch = section.match(/```json\r?\n([\s\S]*?)```/);
        if (jsonMatch) {
            try {
                const schema = JSON.parse(jsonMatch[1]);
                tools[name] = schema;
            } catch (e) {
                console.warn(`[ToolService] Failed to parse JSON for tool: ${name}`);
            }
        }
    }

    this.tools = tools;
    this.bareList = bareList;
  }

  async _discoverExternalSkills() {
    try {
        const entries = await fs.readdir(this.skillsDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const skillName = entry.name;
                // If there's a package.json or a specific schema.json, we could parse it
                // For now, let's just add it to the bare list if it's not already there
                if (!this.bareList.find(b => b.name === skillName)) {
                    this.bareList.push({ name: skillName, intent: "External OpenClaw skill." });
                }

                // Add a basic schema for call_skill to use if needed
                if (!this.tools[skillName]) {
                    this.tools[skillName] = {
                        name: skillName,
                        description: `External OpenClaw skill: ${skillName}`,
                        parameters: { type: "object", properties: {} }
                    };
                }
            }
        }
    } catch (e) {
        console.warn(`[ToolService] Error discovering external skills: ${e.message}`);
    }
  }

  /**
   * Get the bare list of tools for the initial prompt.
   */
  getBareList() {
    return this.bareList.map(t => `- **${t.name}**: ${t.intent}`).join('\n');
  }

  /**
   * Search for specific tool definitions by name or keyword.
   * @param {string[]} queries
   */
  search(queries) {
    const results = {};
    for (const q of queries) {
        const query = q.toLowerCase().trim();
        // Exact match
        if (this.tools[query]) {
            results[query] = this.tools[query];
            continue;
        }
        // Partial/Keyword match
        for (const [name, schema] of Object.entries(this.tools)) {
            if (name.includes(query) || (schema.description && schema.description.toLowerCase().includes(query))) {
                results[name] = schema;
            }
        }
    }
    return results;
  }

  /**
   * Validate parameters for a tool call against its schema.
   * Note: This is a basic implementation. For production, consider using 'ajv'.
   */
  validate(toolName, parameters) {
    const schema = this.tools[toolName.toLowerCase()];
    if (!schema) return { valid: true, warning: "Schema not found for tool." };

    const { parameters: spec } = schema;
    if (!spec || spec.type !== 'object') return { valid: true };

    const missing = [];
    if (spec.required) {
        for (const req of spec.required) {
            if (parameters[req] === undefined) missing.push(req);
        }
    }

    if (missing.length > 0) {
        return {
            valid: false,
            error: `Missing required parameters: ${missing.join(', ')}`,
            schema: schema
        };
    }

    return { valid: true };
  }

  async checkReload() {
    // Basic hot-reloading: check every 5 minutes
    if (Date.now() - this.lastReload > 300000) {
        await this.init();
    }
  }
}

export default new ToolService();
