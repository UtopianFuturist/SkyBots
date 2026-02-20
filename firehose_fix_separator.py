import sys

with open('firehose_monitor.py', 'r') as f:
    content = f.read()

content = content.replace(
    'keywords = [k.strip().lower() for k in args.keywords.split(\',\') if k.strip()]',
    'keywords = [k.strip().lower() for k in args.keywords.split(\'|\') if k.strip()]'
)

content = content.replace(
    'negatives = [k.strip().lower() for k in args.negatives.split(\',\') if k.strip()]',
    'negatives = [k.strip().lower() for k in args.negatives.split(\'|\') if k.strip()]'
)

with open('firehose_monitor.py', 'w') as f:
    f.write(content)
