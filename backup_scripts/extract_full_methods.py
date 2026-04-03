import re
import sys

def get_method_body(content, method_name):
    # Regex to find method start
    pattern = re.compile(r'^\s*(async\s+)?' + method_name + r'\s*\((.*?)\)\s*\{', re.MULTILINE)
    match = pattern.search(content)

    if not match:
        return None

    start = match.start()
    brace_count = 0
    method_end = -1
    for i in range(match.end() - 1, len(content)):
        if content[i] == '{':
            brace_count += 1
        elif content[i] == '}':
            brace_count -= 1
            if brace_count == 0:
                method_end = i + 1
                break

    if method_end != -1:
        return content[start:method_end]
    return None

with open("bot_full.js", "r") as f:
    content = f.read()

methods_to_extract = [
    "performPostPostReflection", "performTimelineExploration", "performPersonaEvolution",
    "performFirehoseTopicAnalysis", "performDialecticHumor", "performAIIdentityTracking",
    "performRelationalAudit", "performAgencyReflection", "performLinguisticAudit",
    "performDreamingCycle", "performSelfReflection", "performNewsroomUpdate",
    "performScoutMission", "performShadowAnalysis", "performDiscordGiftImage",
    "performAutonomousPost", "performMoltbookTasks", "performSpecialistResearchProject",
    "performPublicSoulMapping", "performLinguisticAnalysis", "performKeywordEvolution",
    "performMoodSync", "performPersonaAudit", "getAnonymizedEmotionalContext",
    "_extractImages", "_performHighQualityImagePost", "_generateVerifiedImagePost",
    "run", "cleanupOldPosts"
]

for method in methods_to_extract:
    body = get_method_body(content, method)
    if body:
        print(f"// --- START {method} ---")
        print(body)
        print(f"// --- END {method} ---")
