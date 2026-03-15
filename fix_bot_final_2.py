import sys
path = 'src/bot.js'
with open(path, 'r') as f:
    content = f.read()

# Fix the broken image_gen (missing blobRes)
broken_image_gen = """          if (action.tool === 'image_gen' && action.query) {
              const res = await imageService.generateImage(action.query);
              if (res?.buffer) {
                  if (blobRes?.data?.blob) {
                      await blueskyService.postReply(context, "Generated Image", { embed: { $type: 'app.bsky.embed.images', images: [{ image: blobRes.data.blob, alt: action.query }] } });
                  }
              }
          }"""

fixed_image_gen = """          if (action.tool === 'image_gen' && action.query) {
              const res = await imageService.generateImage(action.query);
              if (res?.buffer) {
                  const blobRes = await blueskyService.uploadBlob(res.buffer, 'image/jpeg');
                  if (blobRes?.data?.blob) {
                      await blueskyService.postReply(context, "Generated Image", { embed: { $type: 'app.bsky.embed.images', images: [{ image: blobRes.data.blob, alt: action.query }] } });
                  }
              }
          }"""

if broken_image_gen in content:
    content = content.replace(broken_image_gen, fixed_image_gen)

# Add missing tools in bot.js executeAction
missing_tools = """          if (action.tool === 'set_goal') {
              const { goal, description } = action.parameters || action.query || {};
              if (goal) {
                  await dataStore.setCurrentGoal(goal, description);
                  if (memoryService.isEnabled()) {
                      await memoryService.createMemoryEntry('goal', `[GOAL] Goal: ${goal} | Description: ${description || goal}`);
                  }
                  return `Goal set: ${goal}`;
              }
              return "Goal name missing.";
          }

          if (action.tool === 'update_persona') {
              const instruction = action.parameters?.instruction || action.query;
              if (instruction) {
                  await dataStore.addPersonaUpdate(instruction);
                  if (memoryService.isEnabled()) {
                      await memoryService.createMemoryEntry('persona_update', instruction);
                  }
                  return "Persona updated with new instruction.";
              }
              return "Instruction missing.";
          }

          if (action.tool === 'bsky_post') {
              const { text, include_image, prompt_for_image } = action.parameters || action.query || {};
              if (text) {
                  let embed = null;
                  if (prompt_for_image) {
                      const res = await imageService.generateImage(prompt_for_image);
                      if (res?.buffer) {
                          const blob = await blueskyService.uploadBlob(res.buffer, 'image/jpeg');
                          if (blob?.data?.blob) {
                              embed = { $type: 'app.bsky.embed.images', images: [{ image: blob.data.blob, alt: prompt_for_image }] };
                          }
                      }
                  }
                  const result = await blueskyService.post(text, embed);
                  return result ? `Posted to Bluesky: ${result.uri}` : "Failed to post to Bluesky.";
              }
              return "Post text missing.";
          }"""

if "action.tool === 'set_goal'" not in content:
    search_marker = "if (action.tool === 'add_persona_blurb') {"
    content = content.replace(search_marker, missing_tools + "\n\n          " + search_marker)

with open(path, 'w') as f:
    f.write(content)
print("Fixed image_gen and added missing tools to bot.js")
