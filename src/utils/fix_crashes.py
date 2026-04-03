import sys

# Fix NewsroomService
newsroom_path = 'src/services/newsroomService.js'
with open(newsroom_path, 'r') as f:
    content = f.read()
content = content.replace(
    "const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true, preface_system_prompt: false });\n            const match = res.match(/\{[\s\S]*\}/);",
    "const res = await llmService.generateResponse([{ role: 'system', content: prompt }], { useStep: true, preface_system_prompt: false });\n            const match = res ? res.match(/\{[\s\S]*\}/) : null;"
)
with open(newsroom_path, 'w') as f:
    f.write(content)

# Fix IntrospectionService
introspection_path = 'src/services/introspectionService.js'
with open(introspection_path, 'r') as f:
    content = f.read()
content = content.replace(
    "const match = res?.match(/\{[\s\S]*\}/);\n            if (!match) throw new Error(\"No JSON found in AAR response\");",
    "const match = res ? res.match(/\{[\s\S]*\}/) : null;\n            if (!match) {\n                console.warn(\"[Introspection] No JSON found in AAR response, skipping log.\");\n                return;\n            }"
)
with open(introspection_path, 'w') as f:
    f.write(content)
