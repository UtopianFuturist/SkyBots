import re

with open('src/utils/textUtils.js', 'r') as f:
    content = f.read()

search_text = """export const cleanKeywords = (keywords) => {
  if (!keywords) return [];
  const list = Array.isArray(keywords) ? keywords : [keywords];
  return [...new Set(
    list
      .flatMap(k => (typeof k === "string" ? k.split(",") : [k]))
      .map(k => (typeof k === "string" ? k.trim().toLowerCase() : k))
      .filter(k => typeof k === "string" &&  (k.length >= 4) && !KEYWORD_BLACKLIST.includes(k))
  )];
};"""

replace_text = """export const cleanKeywords = (keywords) => {
  if (!keywords) return [];
  const list = Array.isArray(keywords) ? keywords : [keywords];
  return [...new Set(
    list
      .flatMap(k => (typeof k === "string" ? k.split(/[,\\n\\r]+/) : [k]))
      .map(k => (typeof k === "string" ? k.trim().toLowerCase() : k))
      .filter(k => typeof k === "string" && (k.length >= 4) && !KEYWORD_BLACKLIST.includes(k))
  )];
};"""

if search_text in content:
    new_content = content.replace(search_text, replace_text)
    with open('src/utils/textUtils.js', 'w') as f:
        f.write(new_content)
    print("Successfully patched cleanKeywords in src/utils/textUtils.js")
else:
    print("Could not find search_text in src/utils/textUtils.js")
