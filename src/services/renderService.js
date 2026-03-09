import fetch from 'node-fetch';
import config from '../../config.js';
import { dataStore } from './dataStore.js';

class RenderService {
  constructor() {
    this.apiKey = config.RENDER_API_KEY;
    this.baseUrl = 'https://api.render.com/v1';
  }

  isEnabled() { return !!this.apiKey; }

  async getLogs(limit = 100) {
      return "Log streaming not supported on free tier.";
  }

  async getPlanningLogs(limit = 50) {
      return "Planning logs not supported on free tier.";
  }
}

export const renderService = new RenderService();
