# Bot Skills Directory

This directory contains specialized system-level skills for the bot, powered by the OpenClaw architecture.

## Skill Structure
Each skill must be a subdirectory containing:
1. `SKILL.md`: Metadata and instructions for the LLM.
2. `run.sh`: A bash script that executes the skill.

### SKILL.md Template
```markdown
---
name: skill-name
description: What this skill does
metadata: {"key": "value"}
---
Instructions for the LLM on when and how to use this skill.
Use {baseDir} to reference files within the skill folder.
```

### run.sh Standards
- Must be executable (`chmod +x`).
- Receives JSON parameters via the `SKILL_PARAMS` environment variable.
- Should output results to `stdout`.
- Should use `jq` for robust parameter parsing.

Example:
```bash
#!/bin/bash
QUERY=$(echo $SKILL_PARAMS | jq -r ".query")
# ... execution logic ...
```
