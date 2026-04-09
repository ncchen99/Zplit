# Zplit Project - Claude Code Guidelines

## Project Overview
Zplit is a React + TypeScript expense-splitting application using Firebase, Zustand for state management, and DaisyUI(Tailwind CSS). This file documents working preferences to optimize token usage and development efficiency.

**Reference Document**: Start by reading `README.md` for comprehensive project structure and architecture.

---

## Working Preferences

### 1. **Token Optimization - Read README First**
- **Always start by reading `README.md`** (in project root) to understand the project structure, architecture, and key files
- **Do NOT re-read the entire codebase** for every task
- Use README as the reference guide for:
  - Stack info (React 19, TypeScript, Firebase, Zustand, Tailwind CSS + DaisyUI)
  - Directory structure and key file locations
  - Data models and service architecture
  - Zustand stores and caching patterns
  - Routing configuration

### 2. **Development Workflow**
- **NO dev server startup**: Do not run `npm run dev` or similar
- **NO screenshot verification**: Do not take screenshots for verification
- **Code changes only**: Focus on code modifications without runtime verification

### 3. **Git & Branching**
- **Work directly on `main` branch** - no feature branches
- User manages local git history themselves (`.git` is under their control)
- Do NOT create new branches or manage git workflows
- Focus on code changes only; user handles commits and version control

### 4. **Code Quality Standards**
- Follow existing patterns in the codebase (use Zustand for state, Firebase services for data, Tailwind for styling)
- Maintain component structure as in `/src/pages` and `/src/components`
- Use TypeScript strictly (no `any` types without justification)
- Keep components functional, use hooks appropriately
- Minimize new dependencies - prefer existing tech stack

---

## Key Files Reference

### Critical Understanding (from README)
- **AddExpensePage.tsx** - Expense form with split logic
- **PersonalPage.tsx** - Contact list and add flow
- **GroupDetailPage.tsx** - Real-time listener pattern
- **personalLedgerService.ts** - Personal expense data model
- **groupStore.ts** - Zustand store structure
- **App.tsx** - Full routing configuration

### Directory Map
```
src/
├── pages/       - Route components (auth, groups, personal, settings)
├── components/  - Reusable UI (ui/, MainLayout, AuthGuard, ErrorBoundary)
├── store/       - Zustand stores (auth, group, personal, ui)
├── services/    - Firebase & business logic
├── lib/         - Firebase config, i18n, algorithms
├── hooks/       - Custom React hooks
└── utils/       - Utilities
```

---

## Task Checklist Template

When starting a new task:
1. Read README.md for context
2. Identify affected files (use Grep/Glob if needed)
3. Make code changes directly on `main`
4. Run `npm run build` or `npx tsc --noEmit`
5. Done - no branch management needed

---

## Stack Quick Reference
- **Framework**: React 19.2.4 + TypeScript 6.0.2
- **Styling**: Tailwind CSS 4.2.2 + DaisyUI 5.5.19
- **Routing**: React Router 7.14.0
- **State**: Zustand 5.0.12
- **Backend**: Firebase 12.11.0 (Firestore + Auth)
- **Build**: Vite 8.0.4
- **i18n**: i18next 26.0.3 (Chinese support)
