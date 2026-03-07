import express from 'express';
import config from '../../config.js';
import { discordService } from './discordService.js';
import { blueskyService } from './blueskyService.js';
import { dataStore } from './dataStore.js';

class NodeGatewayService {
    constructor() {
        this.app = express();
        this.port = process.env.GATEWAY_PORT || 3001;
        this.app.use(express.json());
    }

    async init() {
        console.log(`[NodeGatewayService] Initializing on port ${this.port}...`);

        this.app.get('/status', (req, res) => {
            res.json({
                status: 'online',
                discord: discordService.status,
                bluesky: !!blueskyService.did,
                goal: dataStore.getCurrentGoal(),
                timestamp: new Date().toISOString()
            });
        });

        this.app.post('/broadcast', async (req, res) => {
            const { message, secret } = req.body;
            if (secret !== process.env.GATEWAY_SECRET) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            console.log(`[NodeGatewayService] Received broadcast request: ${message}`);
            await discordService.sendSpontaneousMessage(message);
            res.json({ success: true });
        });

        this.app.listen(this.port, () => {
            console.log(`[NodeGatewayService] Gateway listening on port ${this.port}`);
        });
    }
}

export const nodeGatewayService = new NodeGatewayService();
