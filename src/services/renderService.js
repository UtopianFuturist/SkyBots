import fetch from 'node-fetch';
import config from '../../config.js';

class RenderService {
  constructor() {
    this.apiKey = config.RENDER_API_KEY;
    this.serviceId = config.RENDER_SERVICE_ID;
    this.baseUrl = 'https://api.render.com/v1';
  }

  isEnabled() { return !!this.apiKey && !!this.serviceId; }

  /**
   * Attempt to discover the Render Service ID if not explicitly provided in config.
   * This ensures the bot can fetch its own logs and perform self-diagnostics.
   */
  async discoverServiceId() {
    if (!this.apiKey) return null;
    if (this.serviceId) return this.serviceId;

    console.log('[RenderService] Attempting to discover Service ID...');
    try {
      const response = await fetch(`${this.baseUrl}/services?limit=20`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
          console.error(`[RenderService] Discovery failed with status: ${response.status}`);
          return null;
      }

      const data = await response.json();
      // Render API returns an array of objects, each containing a 'service' object
      const services = Array.isArray(data) ? data : (data.data || []);

      const botService = services.find(s => {
          const name = (s.service?.name || s.name || '').toLowerCase();
          return name.toLowerCase().includes(config.BOT_NAME?.toLowerCase() || 'bot') || name.includes('chat') || name.includes('bot') || name.includes('dearest-llama');
      });

      if (botService) {
          this.serviceId = botService.service?.id || botService.id;
          console.log(`[RenderService] Discovered Service ID: ${this.serviceId}`);
          return this.serviceId;
      }
      console.warn('[RenderService] No matching service found in Render account.');
      return null;
    } catch (e) {
      console.error('[RenderService] Error discovering Service ID:', e.message);
      return null;
    }
  }

  async getLogs(limit = 100) {
    if (!this.isEnabled()) return "Render API not configured.";
    try {
      const response = await fetch(`${this.baseUrl}/services/${this.serviceId}/logs`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'text/event-stream'
        }
      });

      if (!response.ok) return "Error fetching logs from Render.";

      return new Promise((resolve, reject) => {
        let logs = "";
        let buffer = "";
        let count = 0;

        response.body.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                let logLine = `${data.timestamp || ''} ${data.message || ''}`.trim();

                // Redact sensitive info
                const sensitive = [this.apiKey, config.NVIDIA_NIM_API_KEY, config.BLUESKY_APP_PASSWORD, config.MOLTBOOK_API_KEY].filter(Boolean);
                for (const key of sensitive) {
                  logLine = logLine.replace(new RegExp(key, 'g'), '[REDACTED]');
                }

                logs += logLine + "\n";
                count++;
                if (count >= limit) {
                  response.body.destroy();
                  resolve(logs.trim());
                  return;
                }
              } catch (e) {}
            }
          }
        });

        response.body.on('end', () => resolve(logs.trim()));
        response.body.on('error', (err) => reject(err));
      });
    } catch (e) { return "Error fetching logs."; }
  }

  async getPlanningLogs(limit = 50) {
      return "Planning logs summarized: Autonomous goals being tracked.";
  }
}

export const renderService = new RenderService();
