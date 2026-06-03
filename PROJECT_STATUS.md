# FPhoto Project Status

## Current Phase
Phase 6: Custom result folder workflow complete. Next phase: Manual app testing and UI polish.

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
- Committed and pushed Phase 2 to GitHub.
- Added shared search parser in `src/shared/search.ts`.
- Search supports comma-separated codes, numeric shorthand, ranges like `EX0001-EX0020`, and simple free-text number extraction.
- UI now shows parsed code count, matched file count, matched total size, and filtered file list.
- Verified Phase 3 with `npm run lint` and `npm run build`.
- Committed and pushed Phase 3 to GitHub.
- Added destination folder picker through Electron IPC.
- Added safe copy-only file action through Electron main process.
- Copy keeps original files untouched and auto-renames destination duplicates with `(2)`, `(3)`, etc.
- Added copy progress events from main process to renderer.
- Added open destination folder action through Electron shell.
- Verified Phase 4 with `npm run lint`, `npm run build`, and a dev startup smoke test.
- Committed and pushed Phase 4 to GitHub.
- `npm run dist` successfully created Windows installer at `release\FPhoto Setup 0.1.0.exe`.
- Added `README.md` with setup, run, build, usage, and cleanup notes.
- Verified final `npm run lint` and `npm run build` succeed.
- User manually tested the MVP and confirmed search, copy, and destination selection work.
- Added workflow for choosing a parent folder and typing a custom result folder name.
- Copy target is now built as `parentFolder\resultFolderName`; Electron main still creates the folder automatically.

## In Progress
- Git commit/push for Phase 6.

## Next Steps
1. Commit and push Phase 6.
2. Manually test custom result folder creation with a small photo folder.
3. Add RAW + JPEG grouping or inverse filtering next.
4. Polish UI after confirming workflow behavior.

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
- Search matching compares numeric sequences in filenames, so `EX0001`, `IMG_0001`, and `DSC0001` all match input `1`.
- UI is intentionally functional/temporary. Core workflow is prioritized first; visual polish can be redesigned later without replacing main/preload/shared logic.
- `signAndEditExecutable` is disabled in the Windows electron-builder config to avoid a local Windows symlink privilege issue when extracting `winCodeSign`. Re-enable it later if the machine has Developer Mode/admin symlink support and app icon/version resource editing is needed.
- Result folder naming is user-controlled. The app validates only Windows-invalid characters (`\ / : * ? " < > |`) and does not force client/date templates.

## Known Issues
- GitHub push may require user login/confirmation if Git Credential Manager is not already authenticated.
- Node.js is currently v24.14.1, not LTS. If Electron or native packages fail, consider switching to Node.js 22 LTS.
- npm install produced deprecation warnings from transitive Electron tooling packages, but `npm audit` reported 0 vulnerabilities.
- The app uses the default Electron icon until a custom icon is added.

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
Read this file first, then inspect the latest Git status and package scripts before continuing. Start the next phase with manual testing of custom result folder creation, then add RAW + JPEG grouping or inverse filtering.
Keep filesystem writes in Electron main/preload only. Renderer should pass matched file paths and destination folder to a safe preload API.
Next best step: run `npm run dev` or the packaged app, then test scan/search/copy with parent folder + custom result folder name.
