import sys

with open('tests/autonomousPost.test.js', 'r') as f:
    content = f.read()

# Update topic prompt mock
content = content.replace(
    "if (content.includes('You are brainstorming a visual expression')) return Promise.resolve('{ \"topic\": \"Surreal Robot\", \"prompt\": \"A painting of a sad robot\" }');",
    "if (content.includes('Identify a visual topic for an image generation')) return Promise.resolve('{ \"topic\": \"Surreal Robot\", \"prompt\": \"A detailed oil painting of a lonely robot in a neon city\" }');"
)

# Update fallback prompt mock (though it shouldn't be needed if the above works)
content = content.replace(
    "if (content.includes('Audit this image prompt for safety')) return Promise.resolve('COMPLIANT');",
    "if (content.includes('Audit this image prompt for safety')) return Promise.resolve('COMPLIANT');\n        if (content.includes('Generate a highly descriptive, artistic image prompt based on the topic')) return Promise.resolve('A detailed oil painting of a lonely robot in a neon city');"
)

with open('tests/autonomousPost.test.js', 'w') as f:
    f.write(content)
