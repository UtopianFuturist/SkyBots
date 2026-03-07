import sys

def apply_diff(filepath, search_text, replace_text):
    with open(filepath, "r") as f:
        content = f.read()
    if search_text not in content:
        return False
    new_content = content.replace(search_text, replace_text)
    with open(filepath, "w") as f:
        f.write(new_content)
    return True

llm_path = "src/services/llmService.js"

# Platform Isolation: In public pre-planning, explicitly forbid using Admin Facts
search_admin = """
      World Facts: ${(this.dataStore?.getWorldFacts() || []).map(f => `${f.entity}: ${f.fact}`).join('\\n')}
      Admin Facts: ${(this.dataStore?.getAdminFacts() || []).map(f => f.fact).join('\\n')}
      ---"""

replace_admin = """
      World Facts: ${(this.dataStore?.getWorldFacts() || []).map(f => `${f.entity}: ${f.fact}`).join('\\n')}
      ${platform !== 'discord' ? '[STRICT PLATFORM ISOLATION: Admin Facts are private and FORBIDDEN for use on public platforms]' : 'Admin Facts: ' + (this.dataStore?.getAdminFacts() || []).map(f => f.fact).join('\\n')}
      ---"""

if apply_diff(llm_path, search_admin, replace_admin):
    print("Successfully updated LLMService pre-planning for platform isolation")
else:
    print("Failed to update LLMService pre-planning")
