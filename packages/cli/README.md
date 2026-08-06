# tokenuse

![TokenUse brand banner](https://assets.tokenuse.ai/branding/readme-banner-v2.png)

[![npm version](https://img.shields.io/npm/v/tokenuse?label=npm)](https://www.npmjs.com/package/tokenuse)
[![Homebrew tap version](https://img.shields.io/github/v/release/tokenuse/tokenuse?label=homebrew&color=fbb040&logo=homebrew&logoColor=white)](https://github.com/tokenuse/tokenuse-homebrew/blob/main/Formula/tokenuse.rb)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
![Platform: macOS and Linux](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-24292f)

Track and analyze Claude Code and OpenAI Codex usage and costs with TokenUse.

![TokenUse dashboard preview](https://assets.tokenuse.ai/branding/readme-dashboard-v1.png)

## Quick Start

```bash
# One command - auto signs in if needed
npx tokenuse@latest
```

## Installation

### One-time execution (no install needed)

```bash
# npx (recommended)
npx tokenuse@latest

# bunx
bunx tokenuse@latest

# pnpm
pnpm dlx tokenuse@latest
```

### Global installation

```bash
# npm
npm install -g tokenuse

# yarn
yarn global add tokenuse

# pnpm
pnpm add -g tokenuse

# bun
bun add -g tokenuse
```

### Homebrew (macOS/Linux)

```bash
brew tap tokenuse/tap
brew install tokenuse
```

Homebrew 6.0 and later require third-party taps to be trusted before their
formulae will load. If you see `Refusing to load formula tokenuse/tap/tokenuse
from untrusted tap`, run `brew trust tokenuse/tap` and install again.

## Behind a proxy

The npm postinstall downloader honors proxy settings from npm config and the standard environment. npm config takes precedence:

- `npm_config_https_proxy`
- `npm_config_proxy`
- `HTTPS_PROXY` / `https_proxy`
- `HTTP_PROXY` / `http_proxy`

Example:

```bash
npm config set https-proxy http://proxy.example.com:8080
npm install -g tokenuse
```

Use `npm_config_noproxy`, `NO_PROXY`, or `no_proxy` to bypass the proxy for matching hosts. Entries may be `*`, exact hosts, host suffixes such as `.example.com`, or host-and-port pairs such as `localhost:8080`.

If the binary download cannot reach GitHub Releases, the installer prints which proxy variables were detected, whether each release URL used a proxy or direct connection, and a link back to the manual install path below.

## Offline / manual install

Checksum verification remains required. Do not place a binary manually unless its SHA-256 matches the published `checksums.txt` for the same release.

```bash
VERSION=0.4.7
PLATFORM=darwin_arm64 # darwin_amd64, linux_amd64, or linux_arm64

npm install -g tokenuse --ignore-scripts

curl -fsSLO "https://github.com/tokenuse/tokenuse/releases/download/v${VERSION}/tokenuse_${VERSION}_${PLATFORM}.tar.gz"
curl -fsSLO "https://github.com/tokenuse/tokenuse/releases/download/v${VERSION}/checksums.txt"

EXPECTED="$(awk -v file="tokenuse_${VERSION}_${PLATFORM}.tar.gz" '$2 == file { print $1 }' checksums.txt)"
ACTUAL="$(shasum -a 256 "tokenuse_${VERSION}_${PLATFORM}.tar.gz" | awk '{ print $1 }')"
test -n "$EXPECTED" && test "$EXPECTED" = "$ACTUAL"

PKG_ROOT="$(npm root -g)/tokenuse"
mkdir -p "$PKG_ROOT/.tokenuse/bin"
tar -xzf "tokenuse_${VERSION}_${PLATFORM}.tar.gz" --strip-components=1 -C "$PKG_ROOT/.tokenuse/bin"
chmod +x "$PKG_ROOT/.tokenuse/bin/tokenuse"
tokenuse version
```

## Usage

```bash
# Start tracking (auto signs in if needed)
tokenuse

# Check tracking status
tokenuse status

# Show version
tokenuse version
```

## Commands

- `tokenuse` - Start tracking (auto signs in if not authenticated)
- `tokenuse status` - Show tracking status
- `tokenuse tracker stop` - Stop the background tracker without deleting local data
- `tokenuse uninstall` - Remove the background tracker and optionally delete local data
- `tokenuse version` - Show version information

## Requirements

- Node.js 18 or later
- macOS or Linux
- Claude Code or OpenAI Codex installed and used at least once

## Supported Agents

- Claude Code: session tracking is supported today.
- OpenAI Codex: session tracking is supported today.
- Cursor Agent: device/home detection is supported for status reporting; full Cursor session tracking and cost reporting are not shipped yet.

## How It Works

TokenUse monitors supported local Claude Code and OpenAI Codex session logs and tracks:

- Token usage (input, output, cache)
- Session activity
- Model usage
- Prompts and the paths they ran in (on by default, opt out anytime) — to power per-prompt analytics

Data is securely streamed over TLS to the TokenUse API for analysis and visualization.

## Upgrade

```bash
npm install -g tokenuse@latest
tokenuse version
```

## Uninstall

Run the TokenUse uninstall command before removing the npm package:

```bash
tokenuse uninstall
npm uninstall -g tokenuse
```

`tokenuse uninstall` stops and removes the background tracker service, removes the managed daemon binary, and asks whether to delete local TokenUse data such as config, credentials, queued events, prompts, cursors, cache, and logs.

If your installed version does not have `tokenuse uninstall`, run `tokenuse logout` first and type `delete` when prompted, then remove the npm package.

When npm runs package lifecycle hooks, the package also makes a best-effort call to `tokenuse uninstall --keep-data` before removal. Lifecycle hooks can be skipped by package managers, and old binaries may not support the command, so run `tokenuse uninstall` yourself when you want to stop capture and upload immediately.

Manual fallback paths:

- `~/Library/LaunchAgents/ai.tokenuse.tracker.plist` on macOS
- `~/.config/systemd/user/tokenuse-tracker.service` on Linux
- `~/.local/share/tokenuse/bin/tokenuse`
- `~/.config/tokenuse/`
- `~/.local/share/tokenuse/`
- `~/.cache/tokenuse/`

## Privacy

Prompt capture is **on by default** so you get per-prompt analytics. Detected secrets are scrubbed on a best-effort basis before upload, prompts are retained per your retention setting and deleted on request, and we never collect model responses or your file contents. Turn prompt capture off anytime:

```bash
tokenuse config set prompts.enabled=false
```

You can also manage prompt capture and retention from the dashboard under Settings → Data.

## Links

- [Website](https://tokenuse.ai)
- [Documentation](https://tokenuse.ai/docs)
- [Changelog](https://github.com/tokenuse/tokenuse/releases)
- [Security](../../SECURITY.md)
- [GitHub](https://github.com/tokenuse/tokenuse)

## License

MIT
