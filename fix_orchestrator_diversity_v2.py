import sys

file_path = 'src/services/orchestratorService.js'
with open(file_path, 'r') as f:
    content = f.read()

diversity_method = """
    async performTopicDiversityMission() {
        console.log("[Orchestrator] Starting Topic Diversity mission...");
        try {
            const currentKeywords = dataStore.getDeepKeywords();
            const recentPosts = await blueskyService.getUserPosts(blueskyService.handle, 30);

            const recommendation = await evaluationService.recommendTopics(currentKeywords, recentPosts);
            if (recommendation && recommendation.recommended_topics) {
                console.log(`[Orchestrator] New recommended topics: ${recommendation.recommended_topics.join(', ')}`);

                // Inject recommendations into keywords but keep a limit
                const updatedKeywords = [...new Set([...recommendation.recommended_topics, ...currentKeywords])].slice(0, 50);
                await dataStore.setDeepKeywords(updatedKeywords);

                await introspectionService.performAAR("topic_diversity", recommendation.analysis, { success: true });
                await memoryService.createMemoryEntry("evolution", "[DIVERSITY] Integrated fresh narrative angles: " + (recommendation.fresh_angles || []).slice(0, 3).join(', '));
            }
        } catch (e) {
            console.error("[Orchestrator] Topic Diversity mission failed:", e);
        }
    }

"""

# Insert inside the class before the final export
if 'export const orchestratorService' in content:
    content = content.replace('export const orchestratorService', diversity_method + 'export const orchestratorService')

# Trigger the mission in performMaintenance
maintenance_check = """        if (now - this.lastKeywordEvolution >= 6 * 3600000) {
            this.addTaskToQueue(() => this.performKeywordEvolution(), "keyword_evolution");
            this.lastKeywordEvolution = now;
        }"""

diversity_trigger = """        if (now - this.lastKeywordEvolution >= 6 * 3600000) {
            this.addTaskToQueue(() => this.performKeywordEvolution(), "keyword_evolution");
            this.addTaskToQueue(() => this.performTopicDiversityMission(), "topic_diversity");
            this.lastKeywordEvolution = now;
        }"""

if maintenance_check in content:
    content = content.replace(maintenance_check, diversity_trigger)

with open(file_path, 'w') as f:
    f.write(content)
print("Successfully added Topic Diversity mission and trigger")
