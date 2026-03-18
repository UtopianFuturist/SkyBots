import re

with open('src/services/discordService.js', 'r') as f:
    content = f.read()

# Re-insert the missing tool handling blocks
new_tool_blocks = r"""                     if (action.tool === 'persist_directive') {
                         const { platform, instruction } = action.parameters || {};
                         if (platform === 'moltbook') {
                             await moltbookService.addAdminInstruction(instruction);
                         } else {
                             await dataStore.addBlueskyInstruction(instruction);
                         }
                         if (memoryService.isEnabled()) {
                             await memoryService.createMemoryEntry('directive_update', `Platform: ${platform || 'bluesky'}. Instruction: ${instruction}`);
                         }
                         actionResults.push(`[Directive persisted for ${platform || 'bluesky'}]`);
                     }
                     if (action.tool === 'update_persona') {
                         const { instruction } = action.parameters || {};
                         if (instruction) {
                             await dataStore.addPersonaUpdate(instruction);
                             if (memoryService.isEnabled()) {
                                 await memoryService.createMemoryEntry('persona_update', instruction);
                             }
                             actionResults.push(`[Persona updated with new instruction]`);
                         }
                     }
                     if (action.tool === 'discord_message') {
                         const { message: msg, prompt_for_image } = action.parameters || {};
                         const finalMsg = msg || action.query;
                         if (finalMsg) {
                             console.log(`[DiscordService] Processing discord_message tool: ${finalMsg}`);
                             let options = {};
                             if (prompt_for_image) {
                                 console.log(`[DiscordService] Generating image for Discord message: "${prompt_for_image}"`);
                                 const imgResult = await imageService.generateImage(prompt_for_image, { allowPortraits: true });
                                 if (imgResult && imgResult.buffer) {
                                     options.files = [{ attachment: imgResult.buffer, name: 'art.jpg' }];
                                     // Add vision context for the follow-up
                                     const visionAnalysis = await llmService.analyzeImage(imgResult.buffer, prompt_for_image);
                                     actionResults.push(`[SYSTEM: Image generated and sent. VISION: ${visionAnalysis}]`);
                                 }
                             }
                             await this._send(message.channel, finalMsg, options);
                             discordMessageSent = true;
                             actionResults.push(`[System: Message sent via tool: "${finalMsg}"]`);
                         }
                     }"""

pattern_loop = re.compile(r'for \(const action of plan\.actions\) \{', re.DOTALL)
content = pattern_loop.sub(r'for (const action of plan.actions) {\n' + new_tool_blocks, content)

with open('src/services/discordService.js', 'w') as f:
    f.write(content)
