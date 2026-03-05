# 📯 Agentara

A 24/7 personal assistant powered by Claude Code. Multi-channel messaging, file system access, task scheduling, and memory management.

You can call me "Tara" for short.

## Prerequisites

- [Bun](https://bun.sh)
- Claude Code installed and configured

## Quick Start

```bash
bun install
bun run dev      # Start the service
bun run chat     # Interactive CLI chat
```

On first run, `~/.agentara` is created with config, workspace, and memory files.

## Configuration

Configure the environment variables to your liking.

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENTARA_HOME` | User home directory | `~/.agentara` |
| `AGENTARA_LOG_LEVEL` | Log level | `info` |
| `AGENTARA_SERVICE_PORT` | Service port | `1984` |
| `AGENTARA_SERVICE_HOST` | Service host | `localhost` |
