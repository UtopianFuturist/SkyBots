import sys

file_path = 'src/services/discordService.js'
with open(file_path, 'r') as f:
    content = f.read()

search_text = """    async loginLoop() {
        if (!this.token) {
            console.error('[DiscordService] No token found in config.');
            this.isInitializing = false;
            return;
        }

        let attempts = 0;
        const maxAttempts = 10;
        while (attempts < maxAttempts) {
            attempts++;
            try {
                if (this.client) {
                    try { await this.client.destroy(); } catch (e) {}
                    this.client = null;
                }

                console.log(`[DiscordService] Login attempt ${attempts}/${maxAttempts}...`);
                this.client = this._createClient();

                // We use client.login but also wrap the whole wait for ready in a timeout
                // Some environments have issues with Promise.race on login, so we use a more robust approach
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error("Discord login/ready timed out after 300s")), 300000);

                    this.client.once('ready', () => {
                        clearTimeout(timeout);
                        resolve();
                    });

                    this.client.login(this.token).catch(err => {
                        clearTimeout(timeout);
                        reject(err);
                    });
                });

                console.log(`[DiscordService] SUCCESS: Login complete! Bot User: ${this.client.user.tag}`);
                this.isInitializing = false;
                return;
            } catch (err) {
                console.error(`[DiscordService] Login attempt ${attempts} failed:`, err.message);

                if (err.message.includes('TOKEN_INVALID')) {
                    console.error('[DiscordService] FATAL: Invalid token provided.');
                    break;
                }

                // If it's a "this.dispatch" error, we might need a full client recreation
                if (err.message.includes('dispatch')) {
                    console.log('[DiscordService] Dispatch error detected. Re-initializing client...');
                }

                if (attempts < maxAttempts) {
                    const backoff = Math.min(30000 * attempts, 300000); // Gradual backoff up to 5 mins
                    console.log(`[DiscordService] Waiting ${backoff/1000}s before retry...`);
                    await new Promise(r => setTimeout(r, backoff));
                }
            }
        }
        this.isInitializing = false;
        console.error('[DiscordService] FATAL: All login attempts failed.');
    }"""

replace_text = """    async loginLoop() {
        if (!this.token) {
            console.error('[DiscordService] No token found in config.');
            this.isInitializing = false;
            return;
        }

        while (true) {
            const attemptWindowMs = 10 * 60 * 1000; // 10 minutes
            const startTime = Date.now();
            let attemptCount = 0;

            console.log(`[DiscordService] Starting a new 10-minute login window...`);

            while (Date.now() - startTime < attemptWindowMs) {
                attemptCount++;
                try {
                    if (this.client) {
                        try {
                            console.log('[DiscordService] Destroying existing client before retry...');
                            await this.client.destroy();
                        } catch (e) {
                            console.warn('[DiscordService] Error destroying client:', e.message);
                        }
                        this.client = null;
                    }

                    console.log(`[DiscordService] Login attempt ${attemptCount} (Elapsed: ${Math.round((Date.now() - startTime) / 1000)}s)...`);
                    this.client = this._createClient();

                    // Wrap login in a promise with a 2-minute individual timeout
                    await new Promise((resolve, reject) => {
                        const individualTimeout = setTimeout(() => {
                            reject(new Error("Individual login attempt timed out after 120s"));
                        }, 120000);

                        this.client.once('ready', () => {
                            clearTimeout(individualTimeout);
                            resolve();
                        });

                        this.client.login(this.token).catch(err => {
                            clearTimeout(individualTimeout);
                            reject(err);
                        });
                    });

                    console.log(`[DiscordService] SUCCESS: Login complete! Bot User: ${this.client.user.tag}`);
                    this.isInitializing = false;
                    return;
                } catch (err) {
                    console.error(`[DiscordService] Login attempt ${attemptCount} failed with error:`, err);

                    if (err.message && err.message.includes('TOKEN_INVALID')) {
                        console.error('[DiscordService] FATAL: Invalid token provided. Stopping login loop.');
                        this.isInitializing = false;
                        return;
                    }

                    // Log more context if it's a common error
                    if (err.code) console.log(`[DiscordService] Error Code: ${err.code}`);
                    if (err.status) console.log(`[DiscordService] HTTP Status: ${err.status}`);

                    const backoff = Math.min(30000 * attemptCount, 60000); // Backoff up to 1 min
                    const remainingWindow = attemptWindowMs - (Date.now() - startTime);

                    if (remainingWindow > backoff) {
                        console.log(`[DiscordService] Waiting ${backoff / 1000}s before next attempt within window...`);
                        await new Promise(r => setTimeout(r, backoff));
                    } else {
                        break; // Not enough time left in window for another attempt
                    }
                }
            }

            console.error(`[DiscordService] 10-minute login window exhausted. Waiting 15 minutes before restarting loop...`);
            await new Promise(r => setTimeout(r, 15 * 60 * 1000));
        }
    }"""

if search_text in content:
    new_content = content.replace(search_text, replace_text)
    with open(file_path, 'w') as f:
        f.write(new_content)
    print("Successfully updated loginLoop")
else:
    print("Could not find loginLoop search text")
    sys.exit(1)
