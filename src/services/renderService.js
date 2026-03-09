import fetch from 'node-fetch';
import config from '../../config.js';

class RenderService {
  constructor() {
    this.apiKey = config.RENDER_API_KEY;
    this.serviceId = config.RENDER_SERVICE_ID;
    this.baseUrl = 'https://api.render.com/v1';
  }

  isEnabled() { return !!this.apiKey && !!this.serviceId; }

  async getLogs(limit = 100) {
    if (!this.isEnabled()) return "Render API not configured.";
    try {
      // Mock for logs as Render API for logs is complex and usually requires specific setup
      return "Log streaming not available via basic API. Check dashboard.";
    } catch (e) { return "Error fetching logs."; }
  }

  async getPlanningLogs(limit = 50) {
      return "Planning logs not supported on free tier.";
  }
}

export const renderService = new RenderService();
