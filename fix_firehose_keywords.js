import fs from 'fs';
let content = fs.readFileSync('firehose_monitor.py', 'utf8');

content = content.replace(
    "keywords = [k.strip().lower() for k in args.keywords.split('|') if k.strip()]",
    "keywords = [k.strip().lower() for k in args.keywords.split(',') if k.strip()]"
);
content = content.replace(
    "negatives = [k.strip().lower() for k in args.negatives.split('|') if k.strip()]",
    "negatives = [k.strip().lower() for k in args.negatives.split(',') if k.strip()]"
);

fs.writeFileSync('firehose_monitor.py', content);
