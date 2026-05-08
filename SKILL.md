---
name: releaseflow
description: Use ReleaseFlow to manage app auto-updates, apps, releases, download URLs, Sparkle/Electron update feeds, and user-facing release changelogs.
---

# ReleaseFlow

ReleaseFlow manages app release distribution and auto-update feeds.

Use the CLI for quick operations:

```bash
releaseflow apps list
releaseflow apps get <slug>
releaseflow apps sync <app-id>
releaseflow apps urls <slug>
releaseflow releases update <release-id> --notes notes.md
```

Use the SDK for scripts:

```ts
import { configure, Apps } from "releaseflow-sdk";

configure({ apiKey: process.env.RELEASEFLOW_API_KEY! });
const apps = await Apps.releaseflowGetAll();
```

Authentication:

- Prefer `RELEASEFLOW_API_KEY`.
- Optional override: `RELEASEFLOW_BASE_URL`, default `https://releaseflow.net/api/rest`.

## Changelogs

ReleaseFlow changelogs are user-facing product copy. Before publishing or updating a release:

1. Inspect the code changes since the previous released tag.
2. Write concise notes that explain what got better, what was fixed, and why it matters.
3. Do not use GitHub's generated `**Full Changelog**` placeholder as the ReleaseFlow changelog.
4. Patch ReleaseFlow after GitHub release ingestion:

```bash
releaseflow releases update <release-id> --notes notes.md
```

Use `--changelog-url` for hosted long-form notes when useful, but still keep `notes` clean for update dialogs.

## MCP Boundary

This SDK repo does not package MCP. MCP belongs in the app codebase and is hosted by the product at `/mcp`, layered over the app API. For ReleaseFlow, use `https://releaseflow.net/mcp` when a hosted MCP connection is needed.
