# tokenuse

Track and analyze your Claude Code usage with TokenUse.

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
- `tokenuse version` - Show version information

## Requirements

- Node.js 18 or later
- macOS or Linux
- Claude Code installed and used at least once

## How It Works

TokenUse monitors your Claude Code session logs and tracks:

- Token usage (input, output, cache)
- Session activity
- Model usage

Data is securely streamed to the TokenUse API for analysis and visualization.

## Links

- [Website](https://tokenuse.ai)
- [Documentation](https://docs.tokenuse.ai)
- [GitHub](https://github.com/tokenuse/tokenuse)

## License

MIT
