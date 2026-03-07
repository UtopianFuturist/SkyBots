import { webReaderService } from './src/services/webReaderService.js';
const urls = [
    'https://docs.openclaw.ai/',
    'https://docs.openclaw.ai/web/control-ui',
    'https://docs.openclaw.ai/start/hubs',
    'https://docs.openclaw.ai/nodes',
    'https://docs.openclaw.ai/concepts/multi-agent',
    'https://docs.openclaw.ai/concepts/features'
];

async function main() {
    for (const url of urls) {
        console.log('--- START DOC: ' + url + ' ---');
        const content = await webReaderService.fetchContent(url);
        console.log(content);
        console.log('--- END DOC: ' + url + ' ---');
    }
}
main();
