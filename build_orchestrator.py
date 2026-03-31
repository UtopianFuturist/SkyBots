import re

def get_methods_from_restored():
    with open("restored_code.js", "r") as f:
        content = f.read()

    # Extract method bodies including comments
    # Using a more robust regex or just manual split by markers if I had them
    # But since I generated it with // --- START name ---
    methods = re.findall(r'// --- START (\w+) ---\n(.*?)\n// --- END \1 ---', content, re.DOTALL)
    return methods

def adapt_method(name, body):
    # Change 'this.' to 'this.bot.' for properties that moved to bot.js
    # but keep 'this.' for methods that moved to Orchestrator.

    # All methods in this list are now in Orchestrator
    orchestrator_methods = [
        "performPostPostReflection", "performTimelineExploration", "performPersonaEvolution",
        "performFirehoseTopicAnalysis", "performDialecticHumor", "performAIIdentityTracking",
        "performRelationalAudit", "performAgencyReflection", "performLinguisticAudit",
        "performDreamingCycle", "performSelfReflection", "performNewsroomUpdate",
        "performScoutMission", "performShadowAnalysis", "performDiscordGiftImage",
        "performAutonomousPost", "performMoltbookTasks", "performSpecialistResearchProject",
        "performPublicSoulMapping", "performLinguisticAnalysis", "performKeywordEvolution",
        "performMoodSync", "performPersonaAudit", "getAnonymizedEmotionalContext",
        "_extractImages", "_performHighQualityImagePost", "_generateVerifiedImagePost"
    ]

    bot_properties = [
        "paused", "readmeContent", "skillsContent", "firehoseProcess",
        "autonomousPostCount", "lastActivityTime", "restartFirehose",
        "catchUpNotifications", "processNotification", "executeAction",
        "startFirehose", "startNotificationPoll", "cleanupOldPosts",
        "_handleError"
    ]

    adapted = body
    for prop in bot_properties:
        adapted = re.sub(rf'this\.{prop}\b', rf'this.bot.{prop}', adapted)

    # Ensure it's treated as a class method (remove leading 'async ' if it's already there and we are inside class)
    # Actually the bodies already have '  async name() {'

    return adapted

methods = get_methods_from_restored()

header = """import { blueskyService } from './blueskyService.js';
import { llmService } from './llmService.js';
import { dataStore } from './dataStore.js';
import { imageService } from './imageService.js';
import { youtubeService } from './youtubeService.js';
import { googleSearchService } from './googleSearchService.js';
import { wikipediaService } from './wikipediaService.js';
import { newsroomService } from './newsroomService.js';
import { memoryService } from './memoryService.js';
import { discordService } from './discordService.js';
import { socialHistoryService } from './socialHistoryService.js';
import { evaluationService } from './evaluationService.js';
import { checkHardCodedBoundaries, isLiteralVisualPrompt, cleanKeywords, getSlopInfo, sanitizeDuplicateText, sanitizeThinkingTags, sanitizeCharacterCount } from '../utils/textUtils.js';
import * as prompts from '../prompts/index.js';
import config from '../../config.js';

const AUTONOMOUS_POST_SYSTEM_PROMPT = (followerCount) => prompts.system.AUTONOMOUS_POST_SYSTEM_PROMPT(followerCount);

class OrchestratorService {
    constructor() {
        this.bot = null;
    }

    setBotInstance(bot) {
        this.bot = bot;
    }

    async start() {
        console.log('[Orchestrator] Starting autonomous cycles...');
    }
"""

footer = """
    async performHeavyMaintenanceTasks() {
        const nowMs = Date.now();
        const heavyTasks = [
            { name: "ScoutMission", method: "performScoutMission", interval: 4 * 3600000, key: "last_scout_mission" },
            { name: "Newsroom", method: "performNewsroomUpdate", interval: 3 * 3600000, key: "last_newsroom_update" },
            { name: "TimelineExploration", method: "performTimelineExploration", interval: 2 * 3600000, key: "last_timeline_exploration" },
            { name: "DialecticHumor", method: "performDialecticHumor", interval: 6 * 3600000, key: "last_dialectic_humor" },
            { name: "PersonaAudit", method: "performPersonaAudit", interval: 6 * 3600000, key: "last_persona_audit" },
            { name: "VisualAudit", method: "performVisualAudit", interval: 24 * 3600000, key: "last_visual_audit" }
        ];

        for (const task of heavyTasks) {
            const lastRun = dataStore.db.data[task.key] || 0;
            if (nowMs - lastRun >= task.interval) {
                console.log(`[Orchestrator] Running heavy task: ${task.name}`);
                await this[task.method]();
                dataStore.db.data[task.key] = nowMs;
                await dataStore.db.write();
                break;
            }
        }
    }

    async checkMaintenanceTasks() {
        await this.performHeavyMaintenanceTasks();
    }

    async checkDiscordSpontaneity() {
        if (!this.bot || this.bot.paused || dataStore.isResting() || discordService.status !== 'online') return;

        try {
            const history = await discordService.fetchAdminHistory(20);
            const mood = dataStore.getMood();
            const impulse = await llmService.performImpulsePoll(history, { platform: 'discord', mood });

            if (impulse && impulse.impulse_detected) {
                console.log(`[Orchestrator] Discord Spontaneous impulse detected! Impulse Reason: ${impulse.reason}`);
                const messageCount = impulse.suggested_message_count || 1;
                await discordService.sendSpontaneousMessage(null, messageCount);
            }
        } catch (e) {
            console.error('[Orchestrator] Error in checkDiscordSpontaneity:', e);
        }
    }

    async heartbeat() {
        console.log('[Orchestrator] Pulse check...');
        const now = Date.now();
        const lastPost = dataStore.getLastAutonomousPostTime() || 0;
        const lastPostMs = typeof lastPost === 'string' ? new Date(lastPost).getTime() : lastPost;
        const cooldown = (config.AUTONOMOUS_POST_COOLDOWN || 6) * 3600000;

        if (now - lastPostMs >= cooldown) {
            await this.performAutonomousPost();
        }

        await this.performSpontaneityCheck();
    }

    async performSpontaneityCheck() {
        if (!this.bot || this.bot.paused || dataStore.isResting()) return;
        console.log('[Orchestrator] Spontaneity check...');
        try {
            const history = await dataStore.getRecentInteractions("bluesky", 10);
            const impulse = await llmService.performImpulsePoll(history, { mood: dataStore.getMood() });
            if (impulse && impulse.impulse_detected) {
                console.log('[Orchestrator] Spontaneous impulse detected!');
                await this.performAutonomousPost();
            }
        } catch (e) {
            console.error('[Orchestrator] Error in spontaneity check:', e);
        }
    }

    async performVisualAudit() {
        console.log('[Orchestrator] Visual audit triggered.');
    }
}

export const orchestratorService = new OrchestratorService();
"""

print(header)

for name, body in methods:
    if name not in ["run", "cleanupOldPosts"]:
        print(adapt_method(name, body))

print(footer)
