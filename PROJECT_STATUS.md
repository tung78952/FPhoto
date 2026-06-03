# FPhoto Project Status

## Current Phase
Phase 1: Foundation complete. Next phase: Folder Scan.

## Goal
Build a Windows desktop app for photographers to quickly filter photo files by image codes and copy matched files safely.

## Repository
GitHub: https://github.com/tung78952/FPhoto.git

## Tech Stack
- Electron
- React
- TypeScript
- Vite
- Tailwind CSS
- ESLint
- Prettier
- electron-builder

## Completed
- Read `PROJECT_PLAN.md`.
- Confirmed local machine has Node.js, npm, Git, VSCode, and required VSCode extensions.
- Decided to keep the original roadmap but focus v1.0 on search, copy, and installer.
- Created this handoff/status file.
- Created Electron + React + TypeScript project structure.
- Added Tailwind CSS, ESLint, Prettier, electron-vite, and electron-builder configuration.
- Installed npm dependencies successfully.
- Verified `npm run build` succeeds.
- Verified `npm run lint` succeeds.

## In Progress
- Git init/commit/push for Phase 1.

## Next Steps
1. Initialize Git and push Phase 1 to GitHub if authentication is available.
2. Implement folder picker through Electron IPC.
3. Implement folder scan and return photo file metadata to renderer.
4. Render scanned file count/list in the UI.

## Commands
Planned commands:

```powershell
npm install
npm run dev
npm run build
npm run lint
```

## Important Decisions
- Keep `PROJECT_STATUS.md` updated after each phase so another chat/agent can continue from this file.
- Do not add SQLite, EXIF, thumbnails, or code signing in v1.0.
- v1.0 should prioritize safe copy-only workflow: choose folder, scan files, filter by code, copy matches.
- Source/build outputs stay in `D:\PJPHOTO` where possible. npm/Electron caches may still use Windows AppData on drive C.
- Vite is pinned to v7 because the current `electron-vite` release does not support Vite 8 yet.

## Known Issues
- GitHub push may require user login/confirmation if Git Credential Manager is not already authenticated.
- Node.js is currently v24.14.1, not LTS. If Electron or native packages fail, consider switching to Node.js 22 LTS.
- npm install produced deprecation warnings from transitive Electron tooling packages, but `npm audit` reported 0 vulnerabilities.

## File Structure
```text
D:\PJPHOTO
├── PROJECT_PLAN.md
├── PROJECT_STATUS.md
├── package.json
├── package-lock.json
├── electron.vite.config.ts
├── eslint.config.js
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
└── src
    ├── main
    ├── preload
    ├── renderer
    └── shared
```

## Notes For Next Agent
Read this file first, then inspect the latest Git status and package scripts before continuing. Start Phase 2 by adding IPC handlers in `src/main/index.ts`, exposing safe APIs in `src/preload/index.ts`, and replacing the placeholder UI in `src/renderer/src/App.tsx`.
