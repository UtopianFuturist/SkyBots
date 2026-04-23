import sys

file_path = 'src/services/blueskyService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Update upsertThreadgate to be more restrictive by default
search_rules = "const { allowMentions = true, allowFollowing = false } = rules;"
replace_rules = "const { allowMentions = false, allowFollowing = false } = rules;"

if search_rules in content:
    content = content.replace(search_rules, replace_rules)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully hardened threadgate default")
else:
    print("Could not find search_rules in blueskyService.js")
    sys.exit(1)
