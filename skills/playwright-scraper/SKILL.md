---
name: playwright-scraper
description: Deep web scraping and browser automation using Playwright.
metadata: {"version": "1.0.0", "author": "OpenClaw"}
---
This skill allows the agent to navigate complex websites, handle JavaScript-heavy pages, and extract specific information using Playwright.

Usage:
The planning module can call this skill to perform deep research on websites that standard scrapers cannot handle.

Parameters:
- url: The target URL to scrape.
- action: "scrape", "screenshot", or "extract".
- selector: Optional CSS selector for extraction.
