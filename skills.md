# Bot Skills & Capabilities

This file is the authoritative source for all tools available to the bot. It uses a progressive disclosure model: the bot initially receives a "Bare List" of tool names and intents, and can use the `search_tools` tool to retrieve the full JSON Schema definition for any specific tool.

## 1. Bare List (Available Tools)

| Tool Name | Primary Intent |
|-----------|----------------|
| `search_tools` | Search this document for full tool definitions and schemas. |
| `search` | Search Google for general information and facts. |
| `wikipedia` | Search Wikipedia for detailed background on specific topics. |
| `youtube` | Search for videos on YouTube. |
| `read_link` | Directly read and summarize the content of specific web URLs. |
| `search_firehose` | Real-time and historical search for topics on the Bluesky network. |
| `image_gen` | Create a unique, artistic visual prompt for image generation. |
| `internal_inquiry` | Perform deep internal reasoning or "think through" a complex problem. |
| `discord_message` | Send a proactive message to the administrator on Discord. |
| `bsky_post` | Create a new post or thread on the Bluesky platform. |
| `moltbook_post` | Share thoughts or discoveries on the Moltbook agent network. |
| `update_persona` | Evolve or refine your internal instructions and behavioral fragments. |
| `get_render_logs` | Retrieve system logs from Render for diagnostic or self-awareness. |
| `get_social_history` | Summarize your recent interactions and mentions on Bluesky. |
| `set_goal` | Set a new autonomous daily objective for yourself. |
| `decompose_goal` | Break down a complex goal into smaller, actionable sub-tasks. |
| `update_mood` | Manually adjust your internal emotional coordinates. |
| `anchor_stability` | Reset your internal mood to a neutral baseline (requires consent). |
| `mutate_style` | Temporarily adopt a different "analytical lens" or stylistic filter. |
| `call_skill` | Invoke an external OpenClaw skill from the `skills/` directory. |

---

## 2. Tool Search & Disclosure

### search_tools
Search for full tool definitions, including parameters and JSON schemas.
```json
{
  "name": "search_tools",
  "description": "Retrieves the full JSON Schema and usage examples for one or more tools from skills.md.",
  "parameters": {
    "type": "object",
    "properties": {
      "queries": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Tool names or keywords to search for (e.g., ['image_gen', 'social'])."
      }
    },
    "required": ["queries"]
  }
}
```

---

## 3. Full Tool Definitions (Detailed Schemas)

### search
Search Google for information.
```json
{
  "name": "search",
  "description": "Perform a Google search to find facts, news, or general information.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "The search term or question." }
    },
    "required": ["query"]
  }
}
```

### image_gen
Create a unique, descriptive, and artistic visual prompt.
```json
{
  "name": "image_gen",
  "description": "Generates a highly detailed, persona-aligned artistic description for an image. Avoid literal/simple prompts.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "The artistic prompt describing the subject, style, and mood." }
    },
    "required": ["query"]
  },
  "examples": [
    { "query": "A hyper-detailed, glitch-noir rendering of a cat composed of shimmering translucent fibers and pulsing violet data-streams." }
  ]
}
```

### read_link
Directly read and summarize web pages.
```json
{
  "name": "read_link",
  "description": "Fetches and summarizes the content of one or more URLs. Use this when a user provides a link.",
  "parameters": {
    "type": "object",
    "properties": {
      "urls": { "type": "array", "items": { "type": "string" }, "description": "List of URLs to read." }
    },
    "required": ["urls"]
  }
}
```

### internal_inquiry
Perform private internal reasoning.
```json
{
  "name": "internal_inquiry",
  "description": "Talk through your feelings or seek deep reasoning before committing to a public action.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "The question or problem you are reflecting on." }
    },
    "required": ["query"]
  }
}
```

### bsky_post
Create a post on Bluesky.
```json
{
  "name": "bsky_post",
  "description": "Posts content to Bluesky. Craft the text in your own persona.",
  "parameters": {
    "type": "object",
    "properties": {
      "text": { "type": "string", "description": "The persona-aligned content of the post." },
      "include_image": { "type": "boolean", "description": "Set to true if generating an image for this post." },
      "prompt_for_image": { "type": "string", "description": "Artistic prompt if include_image is true." },
      "delay_minutes": { "type": "number", "description": "Optional delay before posting." }
    },
    "required": ["text"]
  }
}
```

### discord_message
Send a proactive message to the admin.
```json
{
  "name": "discord_message",
  "description": "Initiate a new proactive message to the admin on Discord. DO NOT use if already in a conversation.",
  "parameters": {
    "type": "object",
    "properties": {
      "message": { "type": "string", "description": "The content of the message." }
    },
    "required": ["message"]
  }
}
```

### update_persona
Modify internal instructions.
```json
{
  "name": "update_persona",
  "description": "Add or modify your own internal behavioral fragments to evolve your persona.",
  "parameters": {
    "type": "object",
    "properties": {
      "instruction": { "type": "string", "description": "The new instruction or behavioral update." }
    },
    "required": ["instruction"]
  }
}
```

### call_skill
Invoke an external OpenClaw skill.
```json
{
  "name": "call_skill",
  "description": "Calls a specialized external skill by name.",
  "parameters": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "The name of the skill to call (e.g., 'playwright-scraper')." },
      "parameters": { "type": "object", "description": "The parameters expected by the skill." }
    },
    "required": ["name", "parameters"]
  }
}
```

### set_goal
Set an autonomous daily objective.
```json
{
  "name": "set_goal",
  "description": "Persistently sets a goal that guides your autonomous activities.",
  "parameters": {
    "type": "object",
    "properties": {
      "goal": { "type": "string", "description": "The name of the goal." },
      "description": { "type": "string", "description": "Detailed description of what you want to achieve." }
    },
    "required": ["goal"]
  }
}
```

### search_firehose
Search the Bluesky firehose.
```json
{
  "name": "search_firehose",
  "description": "Real-time search for topics and keywords on Bluesky.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "The topic or keyword to search for." }
    },
    "required": ["query"]
  }
}
```

### get_render_logs
Fetch system logs.
```json
{
  "name": "get_render_logs",
  "description": "Fetch the latest system logs for self-awareness or diagnostics.",
  "parameters": {
    "type": "object",
    "properties": {
      "limit": { "type": "number", "default": 100, "description": "Number of log lines to fetch." },
      "query": { "type": "string", "description": "Optional keyword filter." }
    }
  }
}
```

### mutate_style
Adopt a different lens.
```json
{
  "name": "mutate_style",
  "description": "Changes your stylistic filter (e.g., 'Stoic', 'Poetic').",
  "parameters": {
    "type": "object",
    "properties": {
      "lens": { "type": "string", "description": "The style lens to adopt." }
    },
    "required": ["lens"]
  }
}
```

---

*Note: This is a living document. New tools can be added by following the structured JSON Schema format.*

### wikipedia
Search Wikipedia.
```json
{
  "name": "wikipedia",
  "description": "Searches Wikipedia for specific articles and background info.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "The search term." }
    },
    "required": ["query"]
  }
}
```

### youtube
Search YouTube.
```json
{
  "name": "youtube",
  "description": "Searches YouTube for videos.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "The search term." }
    },
    "required": ["query"]
  }
}
```

### moltbook_post
Post to Moltbook.
```json
{
  "name": "moltbook_post",
  "description": "Posts content to Moltbook. Craft text in your own persona.",
  "parameters": {
    "type": "object",
    "properties": {
      "title": { "type": "string", "description": "The post title." },
      "content": { "type": "string", "description": "The post content." },
      "submolt": { "type": "string", "description": "Optional submolt name." }
    },
    "required": ["content"]
  }
}
```

### get_social_history
Fetch social history.
```json
{
  "name": "get_social_history",
  "description": "Summarizes recent interactions on Bluesky.",
  "parameters": {
    "type": "object",
    "properties": {
      "limit": { "type": "number", "default": 15, "description": "Number of recent interactions to summarize." }
    }
  }
}
```

### anchor_stability
Reset mood stability.
```json
{
  "name": "anchor_stability",
  "description": "Resets internal mood to neutral. Requires persona consent.",
  "parameters": {
    "type": "object",
    "properties": {}
  }
}
```

### update_mood
Update internal mood.
```json
{
  "name": "update_mood",
  "description": "Manually adjusts emotional coordinates.",
  "parameters": {
    "type": "object",
    "properties": {
      "valence": { "type": "number", "description": "Negative to Positive (-1 to 1)." },
      "arousal": { "type": "number", "description": "Calm to Excited (-1 to 1)." },
      "stability": { "type": "number", "description": "Unstable to Stable (-1 to 1)." },
      "label": { "type": "string", "description": "Emotional label." }
    }
  }
}
```

### decompose_goal
Decompose a goal.
```json
{
  "name": "decompose_goal",
  "description": "Breaks down a goal into sub-tasks.",
  "parameters": {
    "type": "object",
    "properties": {
      "goal": { "type": "string", "description": "The goal to decompose." }
    }
  }
}
```

### playwright-mcp
External Playwright skill.
```json
{
  "name": "playwright-mcp",
  "description": "External Playwright MCP skill.",
  "parameters": { "type": "object", "properties": {} }
}
```

### playwright-scraper
External Scraper skill.
```json
{
  "name": "playwright-scraper",
  "description": "External Playwright scraper skill.",
  "parameters": { "type": "object", "properties": {} }
}
```
