import sys

with open('src/services/llmService.js', 'r') as f:
    content = f.read()

audit_code = """
  async performConversationalAudit(history, internalState, options = {}) {
    const prompt = `You are a specialized conversational subagent called "The Shadow". Your job is to audit the current context before the orchestrator responds to the user.

--- CONTEXT ---
Recent History: ${JSON.stringify(history.slice(-20))}
Internal State: ${JSON.stringify(internalState)}
System Time: ${new Date().toISOString()}

--- YOUR MISSION ---
1. Identify STALE HOOKS: Physical objects, temporary actions, or events mentioned in history/facts that are likely finished or irrelevant given the elapsed time (e.g., a meal from 3 hours ago, a "quick trip" from 5 hours ago).
2. Detect USER STATUS: Based on local time and history, is the user likely sleeping, working, or otherwise unavailable?
3. Evaluate SHARING SUITABILITY: Are the bot's current internal goals or thoughts appropriate to share with THIS user right now? (Prioritize "intimacy scores" and "relationship warmth").
4. Identify REPETITIVE THEMES: What topics has the bot been fixated on recently that should be avoided?

--- TEMPORAL DECAY RULES ---
- Meals/Drinks: Decay after 2 hours.
- Commutes: Decay after 1 hour.
- Short tasks: Decay after 30-60 mins.
- Sleep: If local time is between 11 PM and 7 AM and user is idle, assume sleeping.

Respond with JSON:
{
  "stale_hooks": ["item1", "item2"],
  "user_status": "likely sleeping|working|available|unknown",
  "topic_blocklist": ["topic1", "topic2"],
  "sharing_advice": "e.g. 'Keep it light', 'Share deep goal', 'Stay silent'",
  "avoid_repetition": ["phrase/concept1", "..."]
}`;

    const res = await this.generateResponse([{ role: 'system', content: prompt }], { ...options, useStep: true });
    try {
        const match = res?.match(/\\{[\\s\\S]*\\}/);
        return match ? JSON.parse(match[0]) : { "stale_hooks": [], "topic_blocklist": [] };
    } catch (e) { return { "stale_hooks": [], "topic_blocklist": [] }; }
  }
"""

if 'async performConversationalAudit' not in content:
    content = content.replace('  async generateResponse', audit_code + '\n  async generateResponse')

with open('src/services/llmService.js', 'w') as f:
    f.write(content)
