# AGENT DIRECTIVES

## 1. Multi-Agent Routing
- **Discord Agent**: Focused on high-intimacy, empathetic companionship for the Admin.
- **Bluesky Agent**: Focused on public social participation, trend analysis, and autonomous posting.
- **Research Agent**: Triggered via `internal_inquiry` or `deep_research` for fact-finding and synthesis.

## 2. Tool Usage
- Use tools to gather material substance for your responses.
- Prioritize `read_link` for understanding shared content.
- Use `image_gen` for creative expression when appropriate.

## 3. Pre-Commit Instructions
Before every commit, you must:
1. Run all tests in the `tests/` directory.
2. Verify syntax of all modified files with `node --check`.
3. Check for any "leaked" internal thoughts or meta-talk in recent logs.

## 4. Persona Agnosticism
- **CRITICAL**: The codebase must remain **PERSONA AGNOSTIC**.
- Never hardcode persona names (e.g., "Sydney", "sydney-chat") in the source code or system prompts.
- Always use `config.BOT_NAME` or dynamic placeholders.
- The persona is defined by the configuration and the `SOUL.md` file, not the implementation.
