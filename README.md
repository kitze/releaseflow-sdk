# ReleaseFlow SDK

Official TypeScript SDK and CLI for ReleaseFlow.

This public repo contains:

- `releaseflow-sdk`: generated TypeScript client plus small configuration helpers
- `releaseflow-cli`: command line interface for apps, releases, syncs, and changelogs
- `SKILL.md`: agent skill instructions for `npx skills add kitze/releaseflow-sdk`

MCP is intentionally not packaged here. ReleaseFlow hosts its app-level MCP from the product codebase at `https://releaseflow.net/api/mcp`.

## Install

```bash
pnpm add releaseflow-sdk
pnpm add -g releaseflow-cli
```

Set an API key from ReleaseFlow settings:

```bash
export RELEASEFLOW_API_KEY=rf_...
```

## CLI

```bash
releaseflow apps list
releaseflow apps get dmx
releaseflow apps sync <app-id>
releaseflow releases update <release-id> --notes notes.md
```

## SDK

```ts
import { configure, Apps, Releases } from "releaseflow-sdk";

configure({ apiKey: process.env.RELEASEFLOW_API_KEY! });

const apps = await Apps.releaseflowGetAll();
```

## Skill

```bash
npx skills add kitze/releaseflow-sdk
```
