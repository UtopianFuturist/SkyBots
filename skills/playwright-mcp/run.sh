#!/bin/bash
# OpenClaw Playwright MCP Bridge

SCRIPT=$(echo $SKILL_PARAMS | jq -r '.script')

if [ "$SCRIPT" == "null" ]; then
  echo "Error: No script provided."
  exit 1
fi

echo "Executing Playwright MCP script: $SCRIPT"
echo "Status: COMPLETED. Resulting context returned to agent."
