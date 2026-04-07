import { Bot } from './src/bot.js';
import { llmService } from './src/services/llmService.js';
import { blueskyService } from './src/services/blueskyService.js';
import { dataStore } from './src/services/dataStore.js';
import { memoryService } from './src/services/memoryService.js';
import { newsroomService } from './src/services/newsroomService.js';
import { newsroomService as nr } from './src/services/newsroomService.js';
import { newsroomService as Newsroom } from './src/services/newsroomService.js';
import fs from 'fs/promises';

async function fix() {
    let content = await fs.readFile('src/bot.js', 'utf-8');

    // Fix executeAction bsky_post
    content = content.replace(
        /if \(action\.tool === "bsky_post"\) \{\s+const text = params\.text \|\| query;/g,
        'if (action.tool === "bsky_post") {\n              let text = params.text || query;\n              if (text) {\n                  const memories = memoryService.isEnabled() ? await memoryService.getRecentMemories(20) : [];\n                  const realityAudit = await llmService.performRealityAudit(text, {}, { history: memories });\n                  if (realityAudit.hallucination_detected || realityAudit.repetition_detected) {\n                      console.warn("[Bot] Audit flagged bsky_post. Refining...");\n                      text = realityAudit.refined_text;\n                  }'
    );

    // Fix processNotification self-reply logic and context passing
    // This is more complex, let's just rewrite the whole method since it's cleaner
    const newProcessNotification = `  async processNotification(notif) {
    if (this._detectInfiniteLoop(notif.uri)) return;
    const isSelf = !!notif.author.did && notif.author.did === blueskyService.agent?.session?.did;
    const history = await this._getThreadHistory(notif.uri);

    if (isSelf) {
        const prePlan = await llmService.performPrePlanning(notif.record.text || "", history, null, "bluesky", dataStore.getMood(), {});
        if (!["informational", "analytical", "critical_analysis"].includes(prePlan.intent)) return;
    }

    if (checkHardCodedBoundaries(notif.record.text || "").blocked) {
        await dataStore.setBoundaryLockout(notif.author.did, 30);
        return;
    }
    if (dataStore.isUserLockedOut(notif.author.did)) return;

    try {
      const handle = notif.author.handle;
      const text = notif.record.text || "";
      if (dataStore.db?.data) {
          dataStore.db.data.last_notification_processed_at = Date.now();
          await dataStore.db.write();
      }
      const isAdmin = handle === config.ADMIN_BLUESKY_HANDLE;
      const prePlan = await llmService.performPrePlanning(text, history, null, "bluesky", dataStore.getMood(), {});
      const memories = memoryService.isEnabled() ? await memoryService.getRecentMemories(20) : [];
      let plan = await llmService.performAgenticPlanning(text, history, null, isAdmin, "bluesky", dataStore.getExhaustedThemes(), {}, {}, {}, {}, null, prePlan, { memories });
      const evaluation = await llmService.evaluateAndRefinePlan(plan, { platform: "bluesky", isAdmin });

      if (evaluation.refined_actions && evaluation.refined_actions.length > 0) {
          plan.actions = evaluation.refined_actions;
      } else if (evaluation.decision !== "proceed") {
          return;
      }

      if (plan.actions) {
        for (const action of plan.actions) {
          await this.executeAction(action, { ...notif, platform: "bluesky" });
        }
      }
    } catch (error) { console.error(\`[Bot] Error processing notification \${notif.uri}:\`, error); }
  }`;

    content = content.replace(/async processNotification\(notif\) \{[\s\S]*?\}\n\n  _detectInfiniteLoop/g, newProcessNotification + '\n\n  _detectInfiniteLoop');

    await fs.writeFile('src/bot.js', content);
    console.log('src/bot.js fixed.');
}

fix();
