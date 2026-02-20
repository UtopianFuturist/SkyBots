import sys

with open('src/utils/textUtils.js', 'r') as f:
    content = f.read()

clean_keywords_code = """
export const cleanKeywords = (keywords) => {
  if (!keywords) return [];
  const list = Array.isArray(keywords) ? keywords : [keywords];
  return [...new Set(
    list
      .flatMap(k => (typeof k === "string" ? k.split(",") : [k]))
      .map(k => (typeof k === "string" ? k.trim().toLowerCase() : k))
      .filter(k => typeof k === "string" && k.length >= 3 && !KEYWORD_BLACKLIST.includes(k))
  )];
};
"""

# Insert after KEYWORD_BLACKLIST definition
marker = '];'
index = content.find(marker)
if index != -1:
    end_of_line = content.find('\n', index)
    if end_of_line != -1:
        new_content = content[:end_of_line+1] + clean_keywords_code + content[end_of_line+1:]
        with open('src/utils/textUtils.js', 'w') as f:
            f.write(new_content)
        print("Successfully updated src/utils/textUtils.js")
    else:
        print("Could not find end of line after marker")
else:
    print("Could not find marker")
