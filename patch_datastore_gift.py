import os

file_path = 'src/services/dataStore.js'
with open(file_path, 'r') as f:
    content = f.read()

# Add getLastDiscordGiftTime and updateLastDiscordGiftTime
methods = """  getLastDiscordGiftTime() { return this.db?.data?.last_discord_gift_time || 0; }
  async updateLastDiscordGiftTime(t) { if (this.db?.data) { this.db.data.last_discord_gift_time = t; await this.write(); } }"""

if "  getLastMoltfeedSummaryTime()" in content:
    content = content.replace("  getLastMoltfeedSummaryTime() { return this.db?.data?.last_moltfeed_summary_time; }",
                              "  getLastMoltfeedSummaryTime() { return this.db?.data?.last_moltfeed_summary_time; }\n" + methods)
    with open(file_path, 'w') as f:
        f.write(content)
    print("DataStore patch applied")
else:
    print("Could not find insertion point")
