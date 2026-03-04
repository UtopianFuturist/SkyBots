import sys

file_path = "src/bot.js"
with open(file_path, "r") as f:
    content = f.read()

# Fix handler to use executeAction (Simplified insertion for now)
# I will replace the manual tool logic in processNotification with calls to executeAction.

# First, find the processNotification loop
old_tool_loop = """      for (const action of finalActions) {
        if (action.tool === 'image_gen') {"""

# Replace with a call to executeAction
# This is complex because of all the local state.
# Let's just update set_scheduled_task to handle the 'action' parameter correctly.

old_sched = """        if (action.tool === 'set_scheduled_task') {
            const { time, message, date } = action.parameters || {};
            if (time && message) {
                const targetDate = date || new Date().toISOString().split('T')[0];
                const task = { time, message, date: targetDate };"""

new_sched = """        if (action.tool === 'set_scheduled_task') {
            const { time, message, date, action: scheduledAction } = action.parameters || {};
            if (time && (message || scheduledAction)) {
                const targetDate = date || new Date().toISOString().split('T')[0];
                const task = { time, message, date: targetDate, action: scheduledAction };"""

content = content.replace(old_sched, new_sched)

with open(file_path, "w") as f:
    f.write(content)
