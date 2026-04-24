import sys

file_path = 'src/services/evaluationService.js'
with open(file_path, 'r') as f:
    content = f.read()

# The class closing brace was before recommendTopics
bad_split = """    }
}

    /**
     * Recommends a list of fresh topics and angles to maintain diversity.
     */
    async recommendTopics"""

good_split = """    /**
     * Recommends a list of fresh topics and angles to maintain diversity.
     */
    async recommendTopics"""

if bad_split in content:
    content = content.replace(bad_split, good_split)
    # The file likely has a dangling closing brace now or needs one before export
    if 'export const evaluationService' in content:
        content = content.replace('export const evaluationService', '}\nexport const evaluationService')

    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully fixed evaluation service syntax")
else:
    print("Could not find the syntax error pattern")
    sys.exit(1)
