# SkyBots: Autonomous Persona-Driven AI Assistant

SkyBots is a sophisticated, individual entity designed for high-quality conversational engagement on Bluesky and Discord. It features a decentralized memory system, visual aesthetic auditing, and a recursive persona evolution loop.

## Key Capabilities

### 🧠 Advanced Persistence & Intelligence
- **Persona Pulse Heartbeat:** A centralized 5-minute orchestrator that manages autonomous posting, self-audits, and state synchronization.
- **Enhanced Data Persistence (lowdb):** Tracks world facts, user portraits (1-paragraph resonance summaries), growth logs, and established world-view stances.
- **Relational Decay:** Implements a weekly 5% decay on relationship warmth to ensure the bot remains grounded in active interactions.
- **Chain-of-Thought Generation:** Autonomous posts use a structured process: `[TENSION] -> [DRAFT] -> [CRITIQUE] -> [FINAL]`.

### 🎨 Visual & Aesthetic Intelligence
- **Aesthetic Manifesto:** Driven by `AESTHETIC.md`, focusing on material truth, tactile beauty, and literal visual grounding.
- **Autonomous Visual Audits:** The bot periodically analyzes its own image feed to refine its visual style and update its manifesto.
- **High-Quality Image Generation:** Integrates Nvidia NIM Flux and Stable Diffusion with strict safety and vision verification gates.

### 💬 Social Sophistication
- **Reply Length Calibration:** Dynamically matches the length of user messages (within 20%) to maintain natural social flow.
- **Post Deduplication:** A 90% similarity threshold prevents repetitive posting or redundant replies.
- **Bluesky Memory Thread:** Persistently stores `[GOAL]` and `[REPORT]` (weekly self-audit) entries on-feed to survive redeployments.
- **Reason-Based Refusal:** Detailed logging of internal states (e.g., "energy low", "mood conflict") for transparent self-correction.

### 🛠️ Tooling & Skills
- **Google Search & Wikipedia:** Real-time information retrieval.
- **Vision Analysis:** "Sees" and analyzes images from the timeline.
- **OpenClaw Skill Integration:** Extensible support for external skills like web scraping.
- **Health Monitoring:** Structured `/health` endpoint returning live bot metrics (mood, energy, last post).

## Deployment
Configured for Render with automated deployments and efficient resource usage (512MB RAM limit).

## Core Identity
Persona and boundaries are driven by:
- `SOUL.md`: Core tensions and aesthetic commitments.
- `AGENTS.md`: Operational logic and subagent coordination.
- `AESTHETIC.md`: Visual manifesto.
