# Zplit Project - Claude Code Guidelines

## Core Rules

1. Read `docs/ai-project-exploration-notes.md` first.
2. Do not re-scan the whole codebase unless needed.
3. Do not run dev server (`npm run dev`) or do screenshot checks.
4. Work directly on `main` (no branch workflow changes).
5. Keep changes minimal and aligned with existing patterns.

## Coding Standards

- Follow existing architecture and folder patterns.
- Prefer existing stack and utilities; avoid new dependencies unless necessary.
- Use strict TypeScript and avoid `any` without clear justification.
- Keep components functional and hook-based.

## Task Checklist

1. Read `docs/ai-project-exploration-notes.md` for current context.
2. Locate only affected files.
3. Implement focused code changes.
4. Validate with `npm run build` or `npx tsc --noEmit` when needed.
5. Leave git history/commit strategy to the user.

## Notes

- If this file conflicts with `docs/ai-project-exploration-notes.md`, follow `docs/ai-project-exploration-notes.md`.
- Keep this file concise and guidance-only.
