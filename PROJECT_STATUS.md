# FPhoto Project Status

## Current Phase
Phase 17: SQLite index/cache foundation complete. Remaining work is deeper change detection/volume serial cache, EXIF panel/filter, thumbnail grid/cache/lazy load, manual RAW/removable-drive testing, GitHub Release, and clean-machine installer testing.

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
- sql.js
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
- Added result mode toggle for matched files vs non-matched files.
- Copy/list/result size now use the selected result mode.
- Removed the custom result folder name field after user feedback; destination selection now copies directly into the selected folder.
- Added file type filter: All, JPEG, RAW, Other.
- Empty search now clearly means all scanned files within the selected file type.
- Added click-to-preview panel for browser-previewable image files such as JPEG/PNG/WebP/GIF/BMP.
- RAW preview currently shows a placeholder to avoid expensive full RAW decode.
- Fixed file list layout for maximized windows by using wider app width and safer `minmax(0, 1fr)` grid columns.
- Replaced direct renderer `file://` preview loading with safe Electron IPC that reads supported image files and returns a data URL.
- Added preview loading/error states and guarded against stale preview responses when clicking files quickly.
- Added Files/Groups view toggle in the result list.
- Grouped view combines result files by base filename and shows file count, extensions, file type mix, total size, and latest modified time.
- Clicking a group previews the best previewable file in that group, usually JPEG if available.
- Added Copy/Move file action toggle. Copy remains the default.
- Move requires user confirmation, copies to destination, verifies destination file size, then deletes the source file.
- Existing destination filename collision handling still applies before copy/move.
- Installed `exifr` for RAW embedded thumbnail extraction.
- RAW preview now calls the same preview IPC and attempts to extract embedded thumbnail data in Electron main.
- RAW preview data URLs are cached in `app.getPath('userData')\preview-cache` using path/size/mtime hash keys.
- RAW formats without embedded thumbnails still show a placeholder instead of decoding full RAW.
- Unsupported RAW preview extraction errors, such as some `.RAF` files reporting unknown format, are now caught and shown as a clean placeholder instead of an IPC error.
- Installed `exiftool-vendored` as a stronger fallback for RAW preview extraction.
- RAW preview flow now tries `exifr.thumbnail()` first, then ExifTool `extractPreview`, `extractJpgFromRaw`, and `extractThumbnail`.
- ExifTool output is converted to a cached data URL using the existing preview cache.
- ExifTool process is stopped on app quit.
- Added removable-drive detection in Electron main via a Windows PowerShell CIM query (`Win32_LogicalDisk.DriveType == 2`).
- Scan result now reports `isRemovableDrive`; renderer shows an amber memory-card warning banner when the source is removable.
- Move is disabled and the action mode is forced to Copy when the source folder is on a removable drive.
- Added a defensive backend guard that refuses Move when any source file lives on a removable drive, even if the renderer guard is bypassed.
- Added `LOGO.png` as the source app logo.
- Added a reproducible icon generation script that creates `build\icon.png` and `build\icon.ico` from `LOGO.png`.
- Updated installer metadata: author, repository/homepage, copyright, Windows icon, executable name, shortcut name, uninstall display name, and dashed installer artifact name.
- Rebuilt the Windows installer with the custom logo icon.
- Verified `npm run dist` succeeds and generates `release\FPhoto-Setup-0.1.0.exe`.
- Upgraded Smart Search parser in the single existing search box; no separate paste/search box was added.
- Parser now handles `từ ... đến ...` / `den` ranges, skips common non-photo numbers like dates, times, phone numbers, and basic quantity phrases, and supports simple exclusion phrases such as `bỏ ảnh 1235`.
- Added `npm run verify:search` with representative parser cases, including ignored `thứ 7`, money transfer, height (`m8`), and weight/body-edit numbers.
- Verified `npm run verify:search`, `npm run lint`, `npm run build`, and `npm run dist` pass. `npm run dist` initially failed because running `release\win-unpacked\FPhoto.exe` processes locked the output folder; after those processes exited, dist succeeded.
- Installed `sql.js` and `@types/sql.js` to avoid native SQLite dependencies.
- Added `src/main/photo-index.ts` with a persisted AppData SQLite database at `app.getPath('userData')\fphoto.sqlite`.
- Added initial DB schema: `folders`, `photos`, and `scan_runs`.
- Folder scan now upserts indexed photo rows by path, marks previously indexed missing files as deleted, records scan runs, and returns scan summary counts.
- Renderer now shows scan index summary: indexed count, new files, changed files, and missing files.
- Verified packaged app contains `node_modules\sql.js\dist\sql-wasm.wasm` inside `release\win-unpacked\resources\app.asar`.
- Verified Phase 17 with `npm run verify:search`, `npm run lint`, `npm run build`, and `npm run dist`.

## In Progress
- Manual validation: SQLite scan summary, Smart Search cases, RAW preview, removable-drive safety, GitHub Release, and clean-machine installer testing.

## Next Steps
1. Manually test SQLite scan summary with a disposable folder: first scan should show new files, second scan should show zero new/changed/missing, then add/edit/delete files and rescan.
2. Manually test Smart Search examples from README in the existing search box.
3. Manually test RAW preview with RAF/CR2/CR3/NEF/ARW/DNG samples.
4. Manually test removable-drive safety with a real SD card or USB stick (banner shows, Move disabled, Copy still works).
5. Create GitHub Release and test installer on a clean Windows machine without Node.js.

## Commands
Planned commands:

```powershell
npm install
npm run dev
npm run build
npm run lint
npm run verify:search
npm run dist
```

## Important Decisions
- Keep `PROJECT_STATUS.md` updated after each phase so another chat/agent can continue from this file.
- Use `sql.js` for the app index/cache because it avoids native module rebuilds and is more portable than `better-sqlite3` for installer users.
- Do not add EXIF panels, thumbnails, or code signing until the core scan/search/copy workflow is stable.
- v1.0 should prioritize safe copy-only workflow: choose folder, scan files, filter by code, copy matches.
- Source/build outputs stay in `D:\PJPHOTO` where possible. npm/Electron caches may still use Windows AppData on drive C.
- Vite is pinned to v7 because the current `electron-vite` release does not support Vite 8 yet.
- `package.json` main points to `out/main/index.js` because `electron-vite` outputs to `out` by default.
- Photo scan currently recurses subfolders and indexes common photo/RAW extensions by filename only. It does not decode images.
- SQLite index currently stores path/name/size/modified time/extension/base name/file type plus scan-run summary. It does not yet drive search results; renderer still filters the latest scan result in memory.
- Search matching compares numeric sequences in filenames, so `EX0001`, `IMG_0001`, and `DSC0001` all match input `1`.
- Smart Search remains rule-based/offline; no AI/API is used.
- UI is intentionally functional/temporary. Core workflow is prioritized first; visual polish can be redesigned later without replacing main/preload/shared logic.
- `signAndEditExecutable` is disabled in the Windows electron-builder config to avoid a local Windows symlink privilege issue when extracting `winCodeSign`. Re-enable it later if the machine has Developer Mode/admin symlink support and app icon/version resource editing is needed.
- Destination folder is selected directly through the Windows dialog. If a new folder is needed, create it in that dialog instead of inside the app.
- Inverse filtering is handled in the renderer by selecting the result set; filesystem copy remains unchanged in Electron main.
- File type filtering is renderer-only and applies before matched/non-matched result selection.
- Preview avoids full RAW decoding. RAW support uses embedded thumbnails via `exifr`, ExifTool fallback, and AppData cache.
- Preview IPC limits direct image reads to supported web formats and files under 80MB to avoid UI lag.
- Some RAW formats may not be supported by `exifr.thumbnail()`; `.RAF` can still require a different preview strategy later.
- ExifTool fallback increases installer size because the vendored binary is bundled.
- Grouped view is renderer-only; copy still uses the selected result file list, so no backend copy behavior changed.
- Move is implemented in Electron main as copy -> size verify -> unlink source. It should still be tested only with disposable files first.
- Removable-drive detection uses `Win32_LogicalDisk.DriveType == 2` via PowerShell CIM (no native module; `wmic` is gone on this Windows 11 build). Detection fails open (null = treated as non-removable) so a query failure never blocks local-drive work; the backend Move guard is the hard stop. USB sticks are also treated as removable by design.

## Known Issues
- GitHub push may require user login/confirmation if Git Credential Manager is not already authenticated.
- Node.js is currently v24.14.1, not LTS. If Electron or native packages fail, consider switching to Node.js 22 LTS.
- npm install produced deprecation warnings from transitive Electron tooling packages, but `npm audit` reported 0 vulnerabilities.
- The Windows installer and executable use generated icon assets from `LOGO.png`.
- GitHub Release creation may require `gh` authentication or browser login.
- Clean-machine installer testing requires another Windows environment or VM without Node.js.

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
Read this file first, then inspect the latest Git status and package scripts before continuing. Smart Search and the SQLite index/cache foundation are upgraded.
Keep filesystem writes in Electron main/preload only. Renderer should pass matched file paths and destination folder to a safe preload API.
Next best step: run `npm run dev` or the packaged app, then test SQLite scan summary, Smart Search examples, scan/search/copy/move with disposable files, Files/Groups view, RAW+JPEG pairs, empty search, JPEG/RAW filters, matched/non-matched mode, maximized window, JPEG/PNG preview clicks, and RAW preview clicks.
