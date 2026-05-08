---
name: releaseflow
description: Use ReleaseFlow to manage desktop app releases, Sparkle and Electron update feeds, alpha/beta/stable channels, downloads, and user-facing changelogs.
---

# ReleaseFlow

ReleaseFlow is a desktop-app release layer for shipping paid or public apps from GitHub Releases without rebuilding downloads, update feeds, changelogs, and checkout/license wiring for every product.

It sits between:

- A product repo that publishes GitHub Releases with signed app artifacts.
- Public ReleaseFlow URLs for product pages, downloads, release lists, and updater feeds.
- Native updaters in the app: Sparkle for Swift/macOS apps, and electron-updater style update checks for Electron apps.
- Optional commerce/license integrations such as Polar or LemonSqueezy.

GitHub remains the artifact source of truth. ReleaseFlow imports releases, classifies channels, chooses the right asset for platform and arch, serves updater metadata, and lets agents or maintainers replace generated GitHub notes with clean user-facing copy.

## Mental Model

ReleaseFlow has apps, releases, and assets.

An app has:

- `type`: `SPARKLE` for native macOS/Sparkle apps or `ELECTRON` for Electron apps.
- `slug`: the public URL slug, usually `https://releaseflow.net/{username}/{slug}`.
- `githubRepo`: the GitHub repo that owns the release artifacts.
- `enableBeta` and `enableAlpha`: whether beta/alpha channels are exposed.
- Sparkle config: public EdDSA key, minimum macOS version, and version strategy.
- Optional changelog config: none, Glink-backed, or custom URL per release.

A release is imported from GitHub Releases. ReleaseFlow stores the display version, tag name, channel, user-facing notes, optional changelog URL, publish date, and downloadable assets.

An asset is matched by filename:

- macOS: `.dmg`, `.pkg`, `darwin`, `-mac`, or signed `.zip` update archives.
- Windows: `.exe`, `.msi`, `windows`, `win`.
- Linux: `.AppImage`, `.deb`, `.rpm`, `linux`.
- Architecture comes from names like `arm64`, `aarch64`, `x64`, `x86_64`, `amd64`.

## Release Lifecycle

Use this flow when shipping a release:

1. Build, sign, notarize, and upload artifacts to a GitHub Release.
2. Tag releases with a semver-ish tag such as `v1.2.3`, `v1.2.3-beta.1`, or `v1.2.3-alpha.1`.
3. Let the GitHub webhook sync ReleaseFlow automatically. Manual sync is a debugging/backfill fallback.
4. Inspect the imported ReleaseFlow release and assets.
5. Replace generated GitHub notes with intentional user-facing copy.
6. Verify the public download URL and updater feed before announcing.

## Channels

ReleaseFlow supports three channels:

- `stable`: normal production releases.
- `beta`: preview releases. Tags containing `beta` or `rc` map here.
- `alpha`: early/internal releases. Tags containing `alpha` map here.

Tag mapping:

```txt
v1.2.3          -> STABLE
v1.2.3-beta.1   -> BETA
v1.2.3-rc.1     -> BETA
v1.2.3-alpha.1  -> ALPHA
```

Channel visibility is cascading:

- Stable users see stable releases only.
- Beta users see beta releases, falling back to stable if no newer beta exists.
- Alpha users see alpha releases, falling back to beta, then stable.

Only expose beta/alpha URLs if the app has that channel enabled.

## Public URL Patterns

For app `{username}/{slug}`:

| Purpose | URL |
|---|---|
| Product/download page | `https://releaseflow.net/{username}/{slug}` |
| Beta page | `https://releaseflow.net/{username}/{slug}?channel=beta` |
| Alpha page | `https://releaseflow.net/{username}/{slug}?channel=alpha` |
| Auto-detected download | `https://releaseflow.net/{username}/{slug}/download` |
| Platform download | `https://releaseflow.net/{username}/{slug}/download/darwin?arch=arm64` |
| Release list | `https://releaseflow.net/{username}/{slug}/releases?channel=stable` |
| Sparkle appcast | `https://releaseflow.net/{username}/{slug}/sparkle/appcast.xml` |
| Sparkle beta appcast | `https://releaseflow.net/{username}/{slug}/sparkle/appcast.xml?channel=beta` |
| Electron update check | `https://releaseflow.net/{username}/{slug}/update/{platform}/{version}` |
| Electron beta update check | `https://releaseflow.net/{username}/{slug}/update/{platform}/{version}?channel=beta&arch=arm64` |

Use `?debug=1` on Electron update URLs when diagnosing feed resolution.

## CLI And SDK

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

## Swift / Sparkle Integration Pattern

Use this for native macOS apps built with SwiftUI or AppKit.

1. Add Sparkle to the app target.
2. Add a tiny updater wrapper that starts Sparkle only in packaged builds.
3. Put `SUFeedURL` and `SUPublicEDKey` in `Info.plist` during packaging.
4. Upload both human download artifacts and Sparkle update artifacts to GitHub Releases.
5. Let ReleaseFlow generate the appcast from the imported release and signed assets.

Example updater wrapper:

```swift
import Foundation
import Sparkle

@MainActor
final class AppUpdater: ObservableObject {
    private let controller: SPUStandardUpdaterController

    private static var isDevelopmentBuild: Bool {
        #if DEBUG
        return true
        #else
        let path = Bundle.main.bundlePath
        return path.contains(".build") ||
            path.contains("DerivedData") ||
            path.contains("Xcode")
        #endif
    }

    init() {
        controller = SPUStandardUpdaterController(
            startingUpdater: !Self.isDevelopmentBuild,
            updaterDelegate: nil,
            userDriverDelegate: nil
        )
    }

    func checkForUpdates() {
        guard !Self.isDevelopmentBuild else { return }
        controller.checkForUpdates(nil)
    }
}
```

Example `Info.plist` entries:

```xml
<key>SUFeedURL</key>
<string>https://releaseflow.net/{username}/{slug}/sparkle/appcast.xml</string>
<key>SUPublicEDKey</key>
<string>{sparkle_public_ed25519_key}</string>
```

For beta or alpha builds, point that build at the matching channel feed:

```xml
<key>SUFeedURL</key>
<string>https://releaseflow.net/{username}/{slug}/sparkle/appcast.xml?channel=beta</string>
```

Packaging notes:

- Sparkle in-app updates should use a signed `.zip` archive plus the matching `.zip.sig` file.
- Human downloads should usually use a signed/notarized `.dmg`.
- ReleaseFlow prefers `.zip` for Sparkle update enclosures and `.dmg` for manual macOS downloads.
- The `.sig` asset is not a user download. ReleaseFlow reads it and inserts `sparkle:edSignature` into the appcast.
- Set `CFBundleShortVersionString` to the user-facing version and `CFBundleVersion` to the build version Sparkle should compare.

Sparkle version strategies:

- `SEMVER`: `1.2.3` stays `1.2.3`; `1.2.3-beta.2` becomes `1.2.3b2`.
- `NUMERIC_BUILD`: `1.2.3` becomes `10203`; `1.2.3-beta.2` becomes `10203b2`.

Use `NUMERIC_BUILD` when the app's `CFBundleVersion` is numeric. Use `SEMVER` when the bundle build version is semver-compatible.

## Electron Integration Pattern

Use this for Electron apps that publish with electron-builder and use `electron-updater`.

ReleaseFlow does not need to replace GitHub publishing. The normal pattern is:

1. Keep `electron-builder` publishing artifacts to GitHub Releases.
2. Configure ReleaseFlow as an `ELECTRON` app pointed at that GitHub repo.
3. In the app, call `autoUpdater.setFeedURL(...)` with the ReleaseFlow update URL before checking for updates.
4. Include channel and arch in the URL, based on user preferences and runtime architecture.
5. Let ReleaseFlow choose the latest visible release and redirect update downloads through `/updates/download/...`.

Updater skeleton:

```ts
import { app, BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";

autoUpdater.autoDownload = false;
autoUpdater.allowDowngrade = true;

const appVersion = app.getVersion();

function getReleaseFlowUpdateUrl(options: {
  username: string;
  slug: string;
  manual: boolean;
  channel?: "stable" | "beta" | "alpha";
}) {
  const mode = options.manual ? "manual" : "auto";
  const channel = options.channel ?? "stable";
  const platform = process.platform;
  const arch = process.arch;

  return [
    `https://releaseflow.net/${options.username}/${options.slug}`,
    `/update/${platform}/${appVersion}`,
    `?mode=${mode}&channel=${channel}&arch=${arch}`,
  ].join("");
}

export async function checkForUpdates(manual: boolean) {
  autoUpdater.setFeedURL(
    getReleaseFlowUpdateUrl({
      username: "your-username",
      slug: "your-app",
      manual,
      channel: getUserSelectedUpdateChannel(),
    }),
  );

  const result = await autoUpdater.checkForUpdates();

  if (manual) {
    showUpdatePrompt(result.updateInfo.version);
    return;
  }

  await autoUpdater.downloadUpdate(result.cancellationToken);
}
```

Recommended event handling:

```ts
autoUpdater.on("update-available", (info) => {
  setUpdateVersion(info.version);
});

autoUpdater.on("download-progress", ({ percent }) => {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.setProgressBar(percent / 100);
  });
});

autoUpdater.on("update-downloaded", () => {
  showRestartToUpdatePrompt();
});

autoUpdater.on("error", (error) => {
  logUpdateError(error);
});
```

Electron packaging notes:

- macOS updates should include a `.zip` artifact for `electron-updater`; `.dmg` is still useful for direct download.
- Windows usually wants an installer asset such as `.exe` or `.msi`.
- Linux usually wants `.AppImage`, `.deb`, or `.rpm`.
- ReleaseFlow matches the requesting platform and arch against imported assets.
- Store the update channel in app preferences. Do not hardcode beta/alpha.
- For automatic checks, a 30 to 60 minute interval is reasonable. Manual checks should show "no update" instead of silently doing nothing.

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

Good release notes:

- Lead with the user-visible improvement.
- Mention fixes by outcome, not internal file/module names.
- Keep Sparkle/Electron dialog notes short enough to read.
- Link to Glink for richer public changelogs when the app has a longer story.

Bad release notes:

- Only `**Full Changelog**`.
- Raw commit lists.
- Internal admin/webhook/security details.
- Secret names, token handling, private repo names, or private endpoints.

## MCP Boundary

This SDK repo does not package MCP. MCP belongs in the app codebase and is hosted by the product at `/api/mcp`, layered over the app API. For ReleaseFlow, use `https://releaseflow.net/api/mcp` when a hosted MCP connection is needed.

## Safety

Never commit Sparkle private keys, app-specific passwords, API keys, GitHub tokens, webhook secrets, signing certificates, or private admin endpoints into public repos or public skills.
