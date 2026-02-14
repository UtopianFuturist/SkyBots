import fetch from 'node-fetch';
import config from '../../config.js';

class RenderService {
  constructor() {
    this.apiKey = config.RENDER_API_KEY;
    this.serviceId = config.RENDER_SERVICE_ID;
    this.serviceName = config.RENDER_SERVICE_NAME;
    this.baseUrl = 'https://api.render.com/v1';
    this.apiLogsDisabled = false;
  }

  isEnabled() {
    return !!this.apiKey && !this.apiLogsDisabled;
  }

  async listServices() {
    if (!this.isEnabled()) return [];
    try {
      const response = await fetch(`${this.baseUrl}/services`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        }
      });
      if (!response.ok) throw new Error(`Render API error: ${response.status}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[RenderService] Error listing services:', error.message);
      return [];
    }
  }

  async findSelf() {
    if (!this.isEnabled()) return null;
    console.log(`[RenderService] Attempting to autodiscover service ID...`);
    const services = await this.listServices();
    if (services.length === 0) return null;

    const possibleNames = [];
    if (this.serviceName) possibleNames.push(this.serviceName.trim().toLowerCase());

    // Fallback to bot nicknames
    if (config.BOT_NICKNAMES) {
        config.BOT_NICKNAMES.forEach(n => possibleNames.push(n.trim().toLowerCase()));
    }

    // Add some common defaults just in case
    ['skybots', 'sydney'].forEach(n => {
        if (!possibleNames.includes(n)) possibleNames.push(n);
    });

    for (const name of possibleNames) {
        const self = services.find(s => s.service.name.trim().toLowerCase() === name);
        if (self) {
            this.serviceId = self.service.id;
            this.serviceName = self.service.name; // Update to the actual name found
            console.log(`[RenderService] Found self service ID: ${this.serviceId} (Name: ${this.serviceName})`);
            return self.service;
        }
    }

    const availableNames = services.map(s => s.service.name).join(', ');
    console.warn(`[RenderService] Could not find service with any known name in Render account. Available services: ${availableNames}`);
    return null;
  }

  async getLogs(limit = 100) {
    if (!this.isEnabled()) {
        return this.apiLogsDisabled ? "Render API log streaming is disabled (tier mismatch or 404)." : "Render API key not configured.";
    }

    if (!this.serviceId) {
      const found = await this.findSelf();
      if (!found) return "Could not find Render service ID. Please set RENDER_SERVICE_ID or check RENDER_SERVICE_NAME.";
    }

    try {
      console.log(`[RenderService] Fetching logs for service "${this.serviceId}" (limit ${limit})...`);

      let response = await fetch(`${this.baseUrl}/services/${this.serviceId}/logs`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'text/event-stream'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
            console.warn(`[RenderService] 404 error for service ID ${this.serviceId}. Attempting to re-discover service ID by name: ${this.serviceName}`);
            const oldId = this.serviceId;
            const self = await this.findSelf();
            if (self && self.id !== oldId) {
                console.log(`[RenderService] Found different service ID: ${self.id}. Retrying fetch...`);
                this.serviceId = self.id;
                response = await fetch(`${this.baseUrl}/services/${this.serviceId}/logs`, {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Accept': 'text/event-stream'
                    }
                });
            } else {
                console.warn(`[RenderService] No new service ID found or discovery returned the same ID. Logs might not be available for this service type/tier on Render via API.`);
                if (response.status === 404) {
                    console.error(`[RenderService] Persistent 404 detected. Disabling log fetching to avoid redundant errors.`);
                    this.apiLogsDisabled = true;
                }
            }
        }

        if (!response.ok) {
            const errBody = await response.text().catch(() => 'No body');
            const hint = response.status === 404 ? " (Note: Render's API log streaming may require a paid plan)" : "";
            if (response.status === 404) {
                this.apiLogsDisabled = true;
            }
            throw new Error(`Render API error: ${response.status}${hint} - ${errBody}`);
        }
      }

      return new Promise((resolve) => {
        let logs = '';
        let lineCount = 0;
        let buffer = '';
        let resolved = false;

        const timeout = setTimeout(() => {
          if (!resolved) {
            console.log(`[RenderService] Log fetch timed out after 5s. Returning ${lineCount} lines.`);
            cleanup();
          }
        }, 5000);

        const cleanup = () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);

          if (response.body && response.body.destroy) {
            response.body.destroy();
          }

          if (!logs) {
            resolve("No logs found or timed out while fetching.");
            return;
          }

          // Redaction
          let sanitizedLogs = logs;
          const keysToRedact = [
            this.apiKey,
            config.NVIDIA_NIM_API_KEY,
            config.BLUESKY_APP_PASSWORD,
            config.MOLTBOOK_API_KEY
          ].filter(k => k && k.length > 5);

          for (const key of keysToRedact) {
            sanitizedLogs = sanitizedLogs.split(key).join('[REDACTED]');
          }

          const finalLines = sanitizedLogs.split('\n').filter(l => l.trim());
          resolve(finalLines.slice(-limit).join('\n'));
        };

        response.body.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep partial line in buffer

          for (const line of lines) {
            if (line.startsWith('data:')) {
              try {
                const jsonStr = line.substring(5).trim();
                const logEntry = JSON.parse(jsonStr);
                // Handle both object format and raw message format
                const msg = logEntry.message || logEntry;
                const ts = logEntry.timestamp || '';
                logs += `${ts} ${msg}\n`;
                lineCount++;
              } catch (e) {
                logs += line.substring(5).trim() + '\n';
                lineCount++;
              }
            }
          }

          if (lineCount >= limit * 1.5) {
            cleanup();
          }
        });

        response.body.on('end', cleanup);
        response.body.on('error', (err) => {
          console.error('[RenderService] Stream error:', err);
          cleanup();
        });
      });

    } catch (error) {
      console.error('[RenderService] Error fetching logs:', error.message);
      return `Error fetching logs: ${error.message}`;
    }
  }

  /**
   * Specifically extracts planning and agency related logs
   */
  async getPlanningLogs(limit = 50) {
    const rawLogs = await this.getLogs(limit * 4); // Fetch more to filter down
    if (typeof rawLogs !== 'string') return rawLogs;

    const lines = rawLogs.split('\n');
    const planningKeywords = [
        'Agentic Plan',
        'Starting generateResponse',
        'Performing agentic planning',
        'Starting analyzeImage',
        'Autonomous post eligibility',
        'Learned something new',
        'Moltbook Activity Report',
        'Social history',
        'REFUSED'
    ];

    const planningLines = lines.filter(line =>
        planningKeywords.some(kw => line.includes(kw)) || line.includes('ERROR') || line.includes('CRITICAL')
    );

    return planningLines.slice(-limit).join('\n') || "No planning-specific logs found in recent history.";
  }
}

export const renderService = new RenderService();
