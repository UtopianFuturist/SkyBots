import fs from 'fs';

function updateFile(filePath, search, replace) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.indexOf(search) === -1) {
        console.error(`Search text not found in ${filePath}`);
        return false;
    }
    content = content.replace(search, replace);
    fs.writeFileSync(filePath, content);
    console.log(`Successfully updated ${filePath}`);
    return true;
}

const discordSearchArt = `if (action.tool === 'image_gen') {
                         const prompt = action.query || action.parameters?.prompt;
                         if (prompt) {
                             const imgResult = await imageService.generateImage(prompt, { allowPortraits: true, mood: currentMood });
                             if (imgResult && imgResult.buffer) {
                                 await this._send(message.channel, \`Generated image: "\${imgResult.finalPrompt}"\`, {
                                     files: [{ attachment: imgResult.buffer, name: 'art.jpg' }]
                                 });
                                 actionResults.push(\`[Successfully generated image for prompt: "\${prompt}"]\`);
                             } else {
                                 actionResults.push(\`[Failed to generate image]\`);
                             }
                         }
                     }`;

const discordReplaceArt = `if (action.tool === 'image_gen') {
                         const prompt = action.query || action.parameters?.prompt;
                         console.log(\`[DiscordService] Tool: image_gen for prompt: "\${prompt}"\`);
                         if (prompt) {
                             const imgResult = await imageService.generateImage(prompt, { allowPortraits: true, mood: currentMood });
                             if (imgResult && imgResult.buffer) {
                                 await this._send(message.channel, \`Generated image: "\${imgResult.finalPrompt}"\`, {
                                     files: [{ attachment: imgResult.buffer, name: 'art.jpg' }]
                                 });
                                 actionResults.push(\`[Successfully generated image for prompt: "\${prompt}"]\`);
                             } else {
                                 const errorMsg = "I'm sorry, I encountered an issue while generating that image. It might be a temporary API error or a content filter mismatch.";
                                 await this._send(message.channel, errorMsg);
                                 actionResults.push(\`[Failed to generate image: API error or safety filter mismatch]\`);
                             }
                         }
                     }`;

const botSearchArt = `await blueskyService.postReply(notif, \`Generated image: "\${imageResult.finalPrompt}"\`, {
              imageBuffer: imageResult.buffer,
              imageAltText: imageResult.finalPrompt
            });
            imageGenFulfilled = true;
          }
        }`;

const botReplaceArt = `await blueskyService.postReply(notif, \`Generated image: "\${imageResult.finalPrompt}"\`, {
              imageBuffer: imageResult.buffer,
              imageAltText: imageResult.finalPrompt
            });
            imageGenFulfilled = true;
          } else {
            currentActionFeedback = "IMAGE_GENERATION_FAILED: The image generation API returned an error or blocked the prompt.";
            console.warn(\`[Bot] Image generation failed for prompt: "\${action.query}"\`);
          }
        }`;

updateFile('src/services/discordService.js', discordSearchArt, discordReplaceArt);
updateFile('src/bot.js', botSearchArt, botReplaceArt);

// Simple replacement for /art command
let discordContent = fs.readFileSync('src/services/discordService.js', 'utf8');
discordContent = discordContent.replace("I'm sorry, I couldn't generate that image right now.", "I'm sorry, I encountered an issue while generating that image. It might be a temporary API error or a content filter mismatch.");
fs.writeFileSync('src/services/discordService.js', discordContent);
