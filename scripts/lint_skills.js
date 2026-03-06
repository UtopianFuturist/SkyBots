import toolService from '../src/services/toolService.js';
import fs from 'fs/promises';
import path from 'path';

async function lint() {
    console.log('[Lint] Checking skills.md...');
    try {
        await toolService.init();

        const errors = [];
        const content = await fs.readFile(path.join(process.cwd(), 'skills.md'), 'utf8');

        // Parse Bare List Table
        const tableMatch = content.match(/\| Tool Name \| Primary Intent \|\r?\n\|-+\|-+\|\r?\n([\s\S]*?)(?=\r?\n\r?\n|---|$)/);
        if (tableMatch) {
            const rows = tableMatch[1].trim().split(/\r?\n/);
            const names = new Set();
            for (const row of rows) {
                const parts = row.split('|').map(p => p.trim()).filter(Boolean);
                if (parts.length >= 2) {
                    const name = parts[0].replace(/`/g, '').toLowerCase();
                    if (names.has(name)) errors.push(`Duplicate tool name in Bare List: ${name}`);
                    names.add(name);
                }
            }
        }

        // Check for JSON syntax errors in schemas
        const toolSections = content.split(/###\s+/).slice(1);
        const definedTools = new Set();
        for (const section of toolSections) {
            const lines = section.split(/\r?\n/);
            const name = lines[0].trim().toLowerCase();
            definedTools.add(name);

            const jsonMatch = section.match(/```json\r?\n([\s\S]*?)```/);
            if (!jsonMatch) {
                errors.push(`Tool '${name}' is missing a JSON code block.`);
                continue;
            }

            try {
                JSON.parse(jsonMatch[1]);
            } catch (e) {
                errors.push(`Invalid JSON in tool '${name}': ${e.message}`);
            }
        }

        // Check that all tools in bare list have a schema (except search_tools which is in section 2)
        for (const bare of toolService.bareList) {
            const name = bare.name.toLowerCase();
            if (name === 'search_tools') continue;
            if (!definedTools.has(name)) {
                errors.push(`Tool '${bare.name}' in Bare List has no JSON Schema definition in 'Full Definitions'.`);
            }
        }

        if (errors.length > 0) {
            console.error('[Lint] Found errors:');
            errors.forEach(err => console.error(` - ${err}`));
            process.exit(1);
        } else {
            console.log('[Lint] skills.md is valid.');
            process.exit(0);
        }
    } catch (err) {
        console.error('[Lint] Error during linting:', err);
        process.exit(1);
    }
}

lint();
