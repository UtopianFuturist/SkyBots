import sys

file_path = 'src/services/orchestratorService.js'
with open(file_path, 'r') as f:
    content = f.read()

# Add a 2-second delay between tasks in the queue to allow LLM throttling to breathe
search_queue = "try { await task.fn(); } catch (e) {"
replace_queue = "try { await task.fn(); await new Promise(r => setTimeout(r, 2000)); } catch (e) {"

if search_queue in content:
    content = content.replace(search_queue, replace_queue)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully spaced out Orchestrator queue")
else:
    print("Could not find search_queue in orchestratorService.js")
    sys.exit(1)
