import fs from 'fs';
let content = fs.readFileSync('src/bot.js', 'utf8');

const toolsImplementation = `
            if (action.tool === "check_internal_state") {
                const state = {
                    goal: dataStore.getCurrentGoal(),
                    mood: dataStore.getMood(),
                    relational_metrics: dataStore.getRelationalMetrics(),
                    recent_memories: await memoryService.getRecentMemories(15)
                };
                return { success: true, data: state };
            }
            if (action.tool === "list_persona_blurbs") {
                const blurbs = dataStore.getPersonaBlurbs();
                return { success: true, data: blurbs };
            }
            if (action.tool === "audit_persona_blurbs") {
                await orchestratorService.performPersonaAudit();
                return { success: true, message: "Persona audit triggered." };
            }
            if (action.tool === "internal_inquiry") {
                const res = await llmService.generateResponse([{ role: 'system', content: \`Internal inquiry: \${query}\` }], { useStep: true });
                return { success: true, data: res };
            }
            if (action.tool === "mutate_style") {
                await dataStore.addLinguisticMutation(params.lens || query, "Manual style mutation");
                return { success: true, lens: params.lens || query };
            }
            if (action.tool === "read_link") {
                const { webReaderService } = await import("./services/webReaderService.js");
                const urls = Array.isArray(params.urls) ? params.urls : [params.url || query];
                const results = [];
                for (const url of urls.filter(Boolean)) {
                    results.push(await webReaderService.read(url));
                }
                return { success: true, data: results };
            }
            if (action.tool === "moltbook_post") {
                const { moltbookService } = await import("./services/moltbookService.js");
                const result = await moltbookService.post(params.content || query, params.title, params.submolt);
                return { success: !!result, data: result };
            }
            if (action.tool === "get_social_history") {
                const history = await socialHistoryService.getRecentSocialContext(params.limit || 15);
                return { success: true, data: history };
            }
            if (action.tool === "update_mood") {
                await dataStore.setMood({
                    valence: params.valence,
                    arousal: params.arousal,
                    stability: params.stability,
                    label: params.label || "Dynamic"
                });
                return { success: true };
            }
            if (action.tool === "anchor_stability") {
                await dataStore.setMood({ valence: 0, arousal: 0, stability: 1, label: "Stable" });
                return { success: true };
            }
            if (action.tool === "decompose_goal") {
                const res = await llmService.generateResponse([{ role: 'system', content: \`Decompose this goal into sub-tasks: \${params.goal || query}\` }], { useStep: true });
                return { success: true, data: res };
            }
            if (action.tool === "vision_model") {
                const res = await llmService.analyzeImage(params.image_url, params.focus || "General analysis");
                return { success: true, data: res };
            }
            if (action.tool === "search_firehose") {
                const matches = dataStore.getFirehoseMatches(20).filter(m => m.text.toLowerCase().includes(query.toLowerCase()));
                return { success: true, data: matches };
            }
            if (action.tool === "get_render_logs") {
                const logs = await renderService.getLogs(params.limit || 100);
                return { success: true, data: logs };
            }
            if (action.tool === "call_skill") {
                const { openClawService } = await import("./services/openClawService.js");
                const result = await openClawService.executeSkill(params.name, params.parameters);
                return { success: true, data: result };
            }
`;

const search = 'if (["search", "wikipedia", "youtube"].includes(action.tool)) {';
if (content.includes(search)) {
    content = content.replace(search, toolsImplementation + '            if (["search", "wikipedia", "youtube"].includes(action.tool)) {');
    fs.writeFileSync('src/bot.js', content);
    console.log('Successfully updated Bot with comprehensive tool set');
} else {
    console.error('Search string not found');
}
