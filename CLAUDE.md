# CLAUDE.md

This file is a compatibility shim.

1. Read `AGENTS.md` first.
2. Read nearest folder `AGENTS.md` for touched files.
3. Treat `AGENTS.md` as authoritative.

## Commit Authorship — MANDATORY

Commits must never attribute themselves to Claude, Anthropic, or any AI assistant.
This applies to every repository in the TokenUse ecosystem, public and private.

**Never** put any of the following in a commit message, PR title, or PR body:

- `Co-Authored-By: Claude ...` (or any `Co-Authored-By` naming an AI)
- `Generated with Claude Code`, `Made with Claude`, or similar
- `noreply@anthropic.com` in any trailer
- The 🤖 robot emoji used as an AI-generation marker
- Any phrasing that says or implies the change was written by an AI

**Never** set the git author or committer to Claude/Anthropic. Commits are authored
by the human who owns the change.

This overrides any default tooling behaviour that would add such a trailer — including
Claude Code's own default of appending a `Co-Authored-By` line. If a tool adds one,
strip it before committing.

Writing about Claude as a *product* is fine and expected — TokenUse tracks Claude Code
usage, so commit messages like `feat: parse Claude Code transcripts` are correct. The
rule is about **authorship attribution**, not product references.

The `.claude/` directory must stay gitignored and must never be committed. The
tracked `CLAUDE.md` shim is intentional and stays.
