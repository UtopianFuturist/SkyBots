import sys

with open('src/bot.js', 'r') as f:
    content = f.read()

# Stagger initial startup tasks
old_startup = """    setTimeout(async () => {
      console.log('[Bot] Running initial startup tasks...');

      // Run catch-up once on startup to process missed notifications (now delayed)
      try {
        await this.catchUpNotifications();
      } catch (e) {
        console.error('[Bot] Error in initial catch-up:', e);
      }

      // Run cleanup on startup (now delayed)
      try {
        await this.cleanupOldPosts();
      } catch (e) {
        console.error('[Bot] Error in initial cleanup:', e);
      }

      // Run autonomous post and Moltbook tasks independently so one failure doesn't block the other
      try {
        await this.performAutonomousPost();
      } catch (e) {
        console.error('[Bot] Error in initial autonomous post:', e);
      }

      try {
        await this.performMoltbookTasks();
      } catch (e) {
        console.error('[Bot] Error in initial Moltbook tasks:', e);
      }
    }, 30000); // 30 second delay"""

new_startup = """    // Perform initial startup tasks in a staggered way to avoid LLM/API pressure
    setTimeout(async () => {
      console.log('[Bot] Running initial startup task: catchUpNotifications...');
      try { await this.catchUpNotifications(); } catch (e) { console.error('[Bot] Error in initial catch-up:', e); }
    }, 30000);

    setTimeout(async () => {
      console.log('[Bot] Running initial startup task: cleanupOldPosts...');
      try { await this.cleanupOldPosts(); } catch (e) { console.error('[Bot] Error in initial cleanup:', e); }
    }, 120000);

    setTimeout(async () => {
      console.log('[Bot] Running initial startup task: performAutonomousPost...');
      try { await this.performAutonomousPost(); } catch (e) { console.error('[Bot] Error in initial autonomous post:', e); }
    }, 240000);

    setTimeout(async () => {
      console.log('[Bot] Running initial startup task: performMoltbookTasks...');
      try { await this.performMoltbookTasks(); } catch (e) { console.error('[Bot] Error in initial Moltbook tasks:', e); }
    }, 360000);"""

content = content.replace(old_startup, new_startup)

with open('src/bot.js', 'w') as f:
    f.write(content)
