import sys

def fix_file(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()

    new_lines = []
    in_generate_response = False
    in_is_image_compliant = False

    i = 0
    while i < len(lines):
        line = lines[i]
        if 'async generateResponse' in line:
            in_generate_response = True
            in_is_image_compliant = False
        elif 'async isImageCompliant' in line:
            in_is_image_compliant = True
            in_generate_response = False

        # In generateResponse, remove the incorrect isImageCompliant fallback
        if in_generate_response:
            if '// If vision model 404s, try fallback' in line:
                # Skip the next 4 lines
                i += 5
                continue

        new_lines.append(lines[i])
        i += 1

    with open(filename, 'w') as f:
        f.writelines(new_lines)
    print(f"Fixed {filename}")

fix_file('src/services/llmService.js')
