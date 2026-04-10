import fs from 'fs';
let content = fs.readFileSync('src/bot.js', 'utf8');

const search = 'if (["search", "wikipedia", "youtube"].includes(action.tool)) {';
const replace = `if (action.tool === "find_image") {
                const { googleSearchService } = await import("./services/googleSearchService.js");
                const res = await googleSearchService.findImage(query);
                return { success: true, data: res };
            }
            if (["search", "wikipedia", "youtube"].includes(action.tool)) {`;

if (content.includes(search)) {
    content = content.replace(search, replace);
    fs.writeFileSync('src/bot.js', content);
    console.log('Successfully added find_image to Bot');
} else {
    console.error('Search string not found');
}
