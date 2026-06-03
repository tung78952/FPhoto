# FPhoto Project Status

## Current Phase
Phase 2: Folder Scan complete. Next phase: Search Parser.

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
- Committed and pushed Phase 1 to GitHub.
- Added Electron IPC handlers for choosing a folder and recursively scanning photo files.
- Exposed safe preload APIs: `selectPhotoFolder` and `scanPhotoFolder`.
- Added renderer UI for folder selection, scan status, file count, total size, and scanned file list.
- Fixed Electron dev entry path to `out/main/index.js`.
- Verified `npm run dev` starts Electron; the smoke-test command timed out only because dev mode runs continuously.

## In Progress
- Git commit/push for Phase 2.

## Next Steps
1. Commit and push Phase 2.
2. Implement search parser for comma-separated codes, ranges, numeric shorthand, and simple free text.
3. Filter scanned files by parsed codes.
4. Show matched count and total matched size.

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
- `package.json` main points to `out/main/index.js` because `electron-vite` outputs to `out` by default.
- Photo scan currently recurses subfolders and indexes common photo/RAW extensions by filename only. It does not decode images.

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
Read this file first, then inspect the latest Git status and package scripts before continuing. Start Phase 3 by adding parser/filter logic for scanned file names.
For the next phase, keep filesystem access in Electron main/preload only. Implement parser/filter logic in renderer or shared utilities so it can be tested independently later.
