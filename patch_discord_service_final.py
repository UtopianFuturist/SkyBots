import re

with open('src/services/discordService.js', 'r') as f:
    content = f.read()

# Modify the final response generation to skip if a discord_message was already sent
pattern_final_response = re.compile(r'if \(actionResults\.length > 0\) \{.*?responseText = await llmService\.generateResponse\(finalMessages, \{ useStep: true, platform: \'discord\' \}\);', re.DOTALL)

new_final_response_logic = r"""                 if (discordMessageSent) {
                    console.log("[DiscordService] Message already sent via tool. Skipping final response generation.");
                    this._stopTypingLoop(typingInterval);
                    this.isResponding = false;
                    return;
                 }

                 if (actionResults.length > 0) {
                     messages.push({ role: 'system', content: `TOOL EXECUTION RESULTS (Acknowledge naturally):
${actionResults.join('\n')}` });
                 }

                 let attempts = 0;
                 let feedback = '';
                 let rejectedContent = null;
                 const MAX_ATTEMPTS = 4;
                 const recentThoughts = dataStore.getRecentThoughts();
                 let lastValidResponse = null;

                 while (attempts < MAX_ATTEMPTS) {
                     attempts++;
                     const feedbackContext = feedback ? `
[RETRY FEEDBACK]: ${feedback}${rejectedContent ? `
[PREVIOUS ATTEMPT (AVOID THIS)]: "${rejectedContent}"` : ''}` : '';
                     const finalMessages = feedback
                        ? [...messages, { role: 'system', content: feedbackContext }]
                        : messages;

                     // High priority low-latency response: use Step (Flash) for ALL attempts in Discord
                     // This prioritizes response speed over deep reasoning for social interactions
                     responseText = await llmService.generateResponse(finalMessages, { useStep: true, platform: 'discord' });"""

content = pattern_final_response.sub(new_final_response_logic, content)

with open('src/services/discordService.js', 'w') as f:
    f.write(content)
