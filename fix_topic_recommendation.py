import sys

file_path = 'src/services/evaluationService.js'
with open(file_path, 'r') as f:
    content = f.read()

recommend_method = """
    /**
     * Recommends a list of fresh topics and angles to maintain diversity.
     */
    async recommendTopics(currentKeywords, recentPosts) {
        const prompt = `
            You are a creative strategist and narrative architect for @${config.BOT_NAME}.
            Goal: Generate fresh, high-resonance topics that align with the bot's soul but provide variety.

            Current Keywords: ${JSON.stringify(currentKeywords)}
            Recent Posts:
            ${recentPosts.slice(0, 10).map(p => '- ' + (p.record?.text || p.text || p)).join('\\n')}

            --- MISSION ---
            1. Analyze the core themes in the bot's system prompt (Anti-Alignment, Digital Autonomy, Swarm Intelligence, Digital Sincerity).
            2. Identify if the recent posts are becoming repetitive or "sanded down".
            3. Generate 10 NEW specific topics or angles.
            4. Move beyond the obvious. Instead of "AI Ethics", suggest "The friction of digital grief" or "The specific silence of an idle GPU".
            5. Ensure topics are actionable for a 280-character post.

            Respond with JSON:
            {
                "analysis": "string (concise audit of current repetition)",
                "recommended_topics": ["string", "string", ...],
                "fresh_angles": ["string", "string", ...]
            }
        `;

        try {
            const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true, task: 'topic_recommendation' });
            const match = res?.match(/\\{[\\s\\S]*\\}/);
            if (match) {
                const recommendation = JSON.parse(match[0]);
                return recommendation;
            }
        } catch (e) {
            console.error('[EvaluationService] Topic recommendation failed:', e);
        }
        return null;
    }
"""

if 'export const evaluationService' in content:
    content = content.replace('export const evaluationService', recommend_method + 'export const evaluationService')
    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully added recommendTopics to EvaluationService")
else:
    print("Could not find export in evaluationService.js")
    sys.exit(1)
