# App Starter Template

A minimal template for creating apps with AI coding assistants. Instead of pre-building a project structure, this template provides a single instruction file that guides the AI through building your app from scratch — incrementally, with you making the key decisions.

## How to Use

1. Clone or copy this repository
2. Open it in your AI coding tool (Claude Code, Cursor, GitHub Copilot, etc.)
3. Tell the AI to read `AGENTS.md` and build the app you have in mind
4. The AI will ask you questions, recommend a tech stack, and start building

The AI handles project scaffolding, structure decisions, and implementation. You stay in control of the important choices.

## How It Works

`AGENTS.md` is the central file. It tells the AI:

- **How to collaborate with you** — as a critical partner who pushes back on bad ideas, explains trade-offs, and involves you in key decisions rather than making them silently
- **How to build software** — incrementally, with no placeholders, no speculative scaffolding, and testing at each step
- **How to track the project** — updating the same file with the project goal, status, decisions, and architecture as work progresses

The file is both the instruction set and the project record. It starts minimal and grows with the project.

## Supported AI Tools

This template uses the [AGENTS.md open standard](https://agents.md), which is supported by most major AI coding tools. For tools that use their own convention files, redirects are included:

| Tool | File | Auto-discovered |
|------|------|:---:|
| Most AI agents | `AGENTS.md` | Yes |
| Claude Code | `CLAUDE.md` → redirects to AGENTS.md | Yes |
| Cursor | `.cursorrules` → redirects to AGENTS.md | Yes |
| GitHub Copilot | `.github/copilot-instructions.md` → redirects to AGENTS.md | Yes |

If your tool isn't listed, point it to `AGENTS.md` manually.

## File Structure

```
├── AGENTS.md                          # AI instruction file (the core of this template)
├── CLAUDE.md                          # Redirect for Claude Code
├── .cursorrules                       # Redirect for Cursor
├── .github/
│   └── copilot-instructions.md        # Redirect for GitHub Copilot
├── .gitignore                         # Standard multi-stack ignores
└── README.md                          # This file (for humans)
```

## What This Is Not

- Not a boilerplate with pre-built code — the AI generates code based on your specific app
- Not a conversation memory system — it's designed for code-generation tools, not chat UIs
- Not locked to any tech stack — the AI recommends a stack based on what you're building

## License

Use this template however you like. No attribution required.
