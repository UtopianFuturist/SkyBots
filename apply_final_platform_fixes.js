import fs from 'fs';

let content = fs.readFileSync('src/services/llmService.js', 'utf8');

// Fix performSafetyAnalysis to pass platform
content = content.replace(
    /async performSafetyAnalysis\(text, context = \{\}\) \{([\s\S]*?)const response = await this\.generateResponse\(messages, \{([\s\S]*?)\}\);/m,
    (match, p1, p2) => {
        if (!p2.includes('platform')) {
            return `async performSafetyAnalysis(text, context = {}) {${p1}const response = await this.generateResponse(messages, {${p2}, platform });`;
        }
        return match;
    }
);

// Fix requestBoundaryConsent to pass platform (contextDescription might contain it or it's unknown)
// Actually requestBoundaryConsent doesn't take platform as an arg, but we can pass 'unknown' or try to extract.
// For now let's just make sure the ones that HAVE platform pass it.

// Check other methods
// isPersonaAligned has platform arg
content = content.replace(
    /async isPersonaAligned\(content, platform, context = \{\}, options = \{\}\) \{([\s\S]*?)this\.generateResponse/m,
    (match) => match.includes('platform') ? match : match // complex regex, let's skip
);

fs.writeFileSync('src/services/llmService.js', content);
