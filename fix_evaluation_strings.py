import sys

file_path = 'src/services/evaluationService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Fix literal string insertions that were broken by python formatting
content = content.replace('${JSON.stringify(currentKeywords)}', '${JSON.stringify(currentKeywords)}')
content = content.replace('${recentPosts.slice(0, 10).map(p => \'- \' + (p.record?.text || p.text || p)).join(\'\\n\')}', '${recentPosts.slice(0, 10).map(p => "- " + (p.record?.text || p.text || p)).join("\\n")}')
content = content.replace('${text.substring(0, 3000)}', '${text.substring(0, 3000)}')
content = content.replace('${posts.map(p => `- ${p.record?.text || p}`).join(\'\\n\')}', '${posts.map(p => "- " + (p.record?.text || p.text || p)).join("\\n")}')

with open(file_path, 'w') as f:
    f.write(content)
print("Manually fixed template literals in EvaluationService")
