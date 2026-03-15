import sys
import os

def patch_discord_service():
    path = 'src/services/discordService.js'
    with open(path, 'r') as f:
        lines = f.readlines()

    # 1. Add typing loop methods
    new_methods = """    _startTypingLoop(channel) {
        if (!channel || typeof channel.sendTyping !== "function") return null;
        channel.sendTyping().catch(err => console.error("[DiscordService] Error sending initial typing:", err));
        const intervalId = setInterval(() => {
            channel.sendTyping().catch(err => {
                console.error("[DiscordService] Error in typing loop:", err);
                clearInterval(intervalId);
            });
        }, 9000);
        return intervalId;
    }

    _stopTypingLoop(intervalId) {
        if (intervalId) clearInterval(intervalId);
    }
"""
    # Insert after constructor
    for i, line in enumerate(lines):
        if 'constructor()' in line:
            # find end of constructor
            bracket_count = 0
            for j in range(i, len(lines)):
                bracket_count += lines[j].count('{')
                bracket_count -= lines[j].count('}')
                if bracket_count == 0 and j > i:
                    lines.insert(j+1, new_methods + "\n")
                    break
            break

    # 2. Add status getter at the end of class
    status_getter = '    get status() { return this.isEnabled && this.client?.isReady() ? "online" : "offline"; }\n'
    for i in range(len(lines)-1, -1, -1):
        if lines[i].strip() == '}':
            lines.insert(i, status_getter)
            break

    # 3. Update respond method for typing loop and TURN AUTONOMY
    content = "".join(lines)

    # Add TURN AUTONOMY directive
    content = content.replace('10. Continuity: You have access to the recent chat history. Use it to maintain context and recognize who you are talking to.',
                              '10. Continuity: You have access to the recent chat history. Use it to maintain context and recognize who you are talking to.\n11. **TURN AUTONOMY**: You are encouraged to send multiple messages (1-4) in a single response turn if you have multiple distinct thoughts or follow-up questions. Provide each message on a new line.')

    # Wrap respond body in typing loop
    start_typing = '        try {\n            const typingInterval = this._startTypingLoop(message.channel);\n'
    content = content.replace('        try {\n            console.log(`[DiscordService] Sending typing indicator...`);\n            await message.channel.sendTyping();', start_typing)

    # Use Step Flash for non-admin too
    content = content.replace('responseText = await llmService.generateResponse(messages);', 'responseText = await llmService.generateResponse(messages, { useStep: true, platform: "discord" });')

    # Split messages and stop typing
    send_logic = """            if (responseText) {
                console.log(`[DiscordService] Sending response to Discord...`);
                const messages = responseText.split("\\n").filter(m => m.trim().length > 0).slice(0, 4);
                for (const msg of messages) {
                    await this._send(message.channel, msg);
                    if (messages.length > 1) await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));
                }
            }
            this._stopTypingLoop(typingInterval);"""

    # This replacement is tricky because of the catch block.
    # Let's target the existing response sending logic.
    old_send_logic = """            if (responseText) {
                console.log(`[DiscordService] Sending response to Discord...`);
                await this._send(message.channel, responseText);
            }"""
    content = content.replace(old_send_logic, send_logic)

    # Ensure stop typing in catch
    content = content.replace('        } catch (error) {\n            console.error(\'[DiscordService] Error responding to message:\', error);',
                              '        } catch (error) {\n            this._stopTypingLoop(typingInterval);\n            console.error(\'[DiscordService] Error responding to message:\', error);')

    with open(path, 'w') as f:
        f.write(content)
    print("Patched DiscordService.js")

def patch_bot():
    path = 'src/bot.js'
    new_func = """  async checkDiscordSpontaneity() {
    if (discordService.status !== "online") return;
    if (dataStore.isResting()) return;

    const now = Date.now();
    const lastInteraction = dataStore.db.data.discord_last_interaction || 0;
    const idleTime = (now - lastInteraction) / (1000 * 60);

    // Dynamic idle threshold: 5m if conversation was recent (< 10m ago), else 30m
    const idleThreshold = (idleTime < 10) ? 5 : 30;
    if (idleTime < idleThreshold) return;

    // Gradual chance increase based on hunger and battery
    const metrics = dataStore.getRelationalMetrics();
    const battery = metrics.discord_social_battery || 1.0;
    const hunger = metrics.discord_interaction_hunger || 0.5;
    const intimacy = metrics.intimacy_score || 0;
    const isRomantic = metrics.relationship_type === "romantic" || metrics.relationship_type === "companion";

    // Base probability starts at 2% every minute, scaled by battery, hunger, and relational proximity
    let probability = 0.02 * battery * (1 + hunger);
    if (isRomantic) probability *= 1.5;
    if (intimacy > 50) probability *= 1.2;

    if (Math.random() > probability) return;

    console.log("[Bot] Triggering Enhanced Discord spontaneity check...");
    const admin = await discordService.getAdminUser();
    if (!admin) return;

    try {
        // Fetch recent history for context
        const history = await discordService.fetchAdminHistory(15);
        const mood = dataStore.getMood();
        const status = dataStore.getMood().label || "Online";
        const goal = dataStore.getCurrentGoal();
        const adminFacts = dataStore.getAdminFacts();
        const isWaitingMode = dataStore.db.data.discord_waiting_until > now;
        const toneShift = await llmService.extractRelationalVibe(history);

        const contextData = {
            mood: mood.label,
            status,
            current_goal: goal.goal,
            relational_metrics: metrics,
            admin_facts: adminFacts.slice(-5)
        };

        // Decide how many messages to send (1-4)
        const messageCount = Math.floor(Math.random() * 4) + 1;

        let spontaneityPrompt = `Adopt persona: ${config.TEXT_SYSTEM_PROMPT}
Recent conversation history: ${JSON.stringify(history.slice(-10))}
Internal State: ${JSON.stringify(contextData)}
Current vibe: ${toneShift}.

${isWaitingMode ? 'You are currently in "Waiting Mode" (Admin is away/busy). Share a "pining" message—a small thought or expression of presence.' : 'Choose what to share spontaneously based on your persona\\'s autonomy.'}
${isRomantic ? "Since your relationship is romantic/intimate, your tone should reflect that deep affection and longing." : ""}

You are choosing what to say spontaneously. Be self-aware and autonomous. Reflect on your internal thoughts and bond.
Potential areas of interest (use ONLY if appropriate and not recently discouraged):
- Your current goal: ${goal.goal}
- Admin facts: ${JSON.stringify(adminFacts.slice(-3))}
- Fresh internal reflections about your bond or existence.

CRITICAL STEERAGE: You MUST respect the recent conversation history. If the admin has expressed preferences, negative constraints (e.g., "don't talk about X"), or specific moods, adapt strictly. Do NOT force topics the admin has recently steered away from or asked to avoid.

Generate ${messageCount} separate messages/thoughts, each on a new line. Keep each under 200 characters.`;

        const rawResponse = await llmService.generateResponse([{ role: "user", content: spontaneityPrompt }], { useStep: true, platform: "discord" });

        if (rawResponse) {
            const messages = rawResponse.split("\\n").filter(m => m.trim().length > 0).slice(0, messageCount);
            for (const msg of messages) {
                await discordService.sendSpontaneousMessage(msg);
                if (messages.length > 1) await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
            }
            dataStore.db.data.discord_last_interaction = now;
            await dataStore.db.write();
            await dataStore.addInternalLog("discord_spontaneous", { count: messages.length, content: messages });
        }
    } catch (e) {
        console.error("[Bot] Error in checkDiscordSpontaneity:", e);
    }
  }"""
    with open(path, 'r') as f:
        content = f.read()

    start_marker = "  async checkDiscordSpontaneity() {"
    end_marker = "  async processNotification(notif) {"

    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)

    if start_idx != -1 and end_idx != -1:
        new_content = content[:start_idx] + new_func + "\n\n" + content[end_idx:]
        with open(path, 'w') as f:
            f.write(new_content)
        print("Patched bot.js")
    else:
        print("Markers not found in bot.js")

if __name__ == "__main__":
    patch_discord_service()
    patch_bot()
