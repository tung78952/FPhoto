# FPhoto Project Status

## Current Phase
Phase 20: The final in-scope features are implemented and pass `npm run lint`, `npm run build`, and `npm run verify:search` — EXIF (read/display/filter), thumbnail grid view (lazy load + cache), and volume-serial memory-card identification. All feature work for v1.x is now code-complete. Remaining work is manual testing of these on real files/cards, then GitHub Release and clean-machine installer testing. Search history, Job management, Status & tags, ZIP export, and all of v2.0 are out of scope (see "Out of Scope (Dropped)").

## Goal
Build a Windows desktop app for photographers to quickly filter photo files by image codes and copy matched files safely.

## Out of Scope (Dropped)
These were on the original `PROJECT_PLAN.md` roadmap but have been dropped by the user on 2026-06-04. Do NOT report them as "remaining work" anymore.
- Search history / recent searches (Sprint 6) — dropped.
- Job management per client (Sprint 8) — dropped.
- Status & tags / XMP sidecar (Sprint 11) — dropped.
- ZIP export (Sprint 12) — dropped.
- All of Version 2.0 (Google Drive, mobile companion, cloud backup, multi-language) — deferred, not being worked on for now.

Still in scope after the drop: EXIF (Sprint 9), Thumbnail grid (Sprint 10), and Volume-serial card identification (Sprint 7 remainder).

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
- Folder scan now upserts indexed photo rows by path, marks previously indexed missing files as deleted internally, and records scan runs for cache/history.
- The technical debug counter UI was removed; SQLite is now used visibly for fast reload of previously scanned folders.
- Verified packaged app contains `node_modules\sql.js\dist\sql-wasm.wasm` inside `release\win-unpacked\resources\app.asar`.
- Verified Phase 17 with `npm run verify:search`, `npm run lint`, `npm run build`, and `npm run dist`.
- Fixed Smart Search regression where plain numeric inputs such as `1`, `0001`, `1,2,3`, `001, 004, 009`, and `1 2 3` parsed as empty because the parser required explicit photo context.
- Added regression cases for plain numeric lists and space-separated code lists to `npm run verify:search`.
- Verified the fix with `npm run verify:search`, `npm run lint`, `npm run build`, and extra parser spot-checks for plain code inputs plus noise cases (`thứ 7`, transfer amount, weight/body-edit numbers).
- Removed technical SQLite summary counters from the renderer UI because they were confusing for the app workflow.
- Added a cached folder load API backed by SQLite. When a previously scanned folder is selected, the renderer can show cached files immediately and offers Rescan to refresh from disk.
- SQLite still records scan runs internally, but the visible user flow is now simple: load cached list fast, or scan normally if there is no cache.
- Recorded the dropped-feature scope decision (Search history, Job management, Status & tags, ZIP export dropped; v2.0 deferred) in this file so it is not re-reported as remaining work.
- Added EXIF reading via `exifr.parse` in Electron main, with a `photo:get-exif` (lazy, cached) and `photo:index-exif` (batch with `exif:progress`) IPC.
- Added a `photo_exif` SQLite table with an mtime-guarded cache and batch upsert; EXIF is read on demand, not during scan.
- Renderer shows EXIF (date taken, camera, lens, ISO, aperture, shutter, focal length) in the preview panel and offers a "Load EXIF" filter by date-taken range and ISO range.
- Added a thumbnail grid view as a third list-view mode; `ThumbnailCell` lazy-loads via `IntersectionObserver` so only visible cells fetch.
- Added a `photo:get-thumbnail` IPC that tries `exifr.thumbnail()` first (small, covers RAW + most JPEG), falls back to the full preview for web formats, and caches the data URL in the existing preview cache (`-thumb` key).
- Added volume-serial memory-card identification: `getDriveInfo` returns DriveType + VolumeSerialNumber in one PowerShell query; scans persist `volume_serial`, and a removable folder with no exact-path cache is matched by volume serial + path tail with cached paths remapped to the current drive letter.

## In Progress
- Manual validation of the new features + carry-over testing, then release. All code is committed/pushed; the remaining items below need real files/hardware that the build environment does not have.

## Next Steps
Manual tests for the new features (need real photos):
1. EXIF display: in the app, scan a folder with RAW/JPEG, click a file, confirm the preview panel shows date taken, camera, lens, ISO, aperture, shutter, focal length.
2. EXIF filter: click "Load EXIF" (watch the progress bar), then set a date range and/or ISO min/max and confirm the matched/result counts narrow correctly.
3. Thumbnail grid: switch List view to "Grid", scroll, and confirm thumbnails lazy-load (only visible ones), RAW+JPEG both show, clicking a cell selects/previews it.
4. Volume serial: scan a memory card, replug it so Windows assigns a different drive letter, reselect the same folder, and confirm the cached list loads (paths remapped to the new letter).

Carry-over manual tests:
5. SQLite cache: scan a folder once, restart/choose another folder, reselect → "Loaded previous scan" appears; Rescan after add/delete updates the list.
6. Smart Search plain inputs: `1`, `0001`, `1,2,3`, `001, 004, 009`, `1 2 3`, `lay anh 0001 0005 0010`.
7. RAW preview with RAF/CR2/CR3/NEF/ARW/DNG samples.
8. Removable-drive safety on a real SD card/USB (banner shows, Move disabled, Copy works).
9. Create GitHub Release and test the installer on a clean Windows machine without Node.js.

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
- Scope trimmed on 2026-06-04: Search history, Job management, Status & tags, and ZIP export are dropped; all of v2.0 is deferred. See "Out of Scope (Dropped)". Remaining buildable features are EXIF, Thumbnail grid, and Volume-serial card identification.
- Use `sql.js` for the app index/cache because it avoids native module rebuilds and is more portable than `better-sqlite3` for installer users.
- Do not add EXIF panels, thumbnails, or code signing until the core scan/search/copy workflow is stable.
- v1.0 should prioritize safe copy-only workflow: choose folder, scan files, filter by code, copy matches.
- Source/build outputs stay in `D:\PJPHOTO` where possible. npm/Electron caches may still use Windows AppData on drive C.
- Vite is pinned to v7 because the current `electron-vite` release does not support Vite 8 yet.
- `package.json` main points to `out/main/index.js` because `electron-vite` outputs to `out` by default.
- Photo scan currently recurses subfolders and indexes common photo/RAW extensions by filename only. It does not decode images.
- SQLite index currently stores path/name/size/modified time/extension/base name/file type plus scan-run history. It now drives quick reload for previously scanned folders; renderer still filters the visible file list in memory.
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
- EXIF is read on demand (via a "Load EXIF" button), not during scan, to avoid slowing scans of thousands of files. EXIF is cached in the `photo_exif` table with an mtime guard and re-read when a file changes. EXIF filtering excludes files that have no EXIF for the chosen criteria.
- Thumbnails prefer `exifr.thumbnail()` (small embedded thumbnail, works for RAW and most camera JPEGs); web formats without an embedded thumbnail fall back to the full preview. The grid lazy-loads via `IntersectionObserver`, caps at 500 cells, and memoizes results per session (cleared on folder change). `react-window` remains an optional future optimization for >500.
- Volume serial and drive type are fetched together in a single PowerShell query (`getDriveInfo`). The volume-serial cache fallback only triggers for removable drives on an exact-path cache miss, and remaps cached file paths to the drive letter the card currently mounted under.

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
Read this file first, then inspect the latest Git status and package scripts before continuing. All in-scope v1.x features are code-complete: scan/search/copy/move, removable-drive safety, SQLite cache, EXIF (read/display/filter), thumbnail grid, and volume-serial card identification. See "Out of Scope (Dropped)" — do NOT re-add Search history, Job management, Status & tags, ZIP export, or v2.0 unless the user asks.
Keep filesystem writes in Electron main/preload only. Renderer should pass matched file paths and destination folder to a safe preload API.
Next best step: run `npm run dev` or the packaged app and walk the "Next Steps" manual tests (EXIF display/filter, thumbnail grid lazy load, volume-serial card recognition, plus the carry-over tests). After manual sign-off, do the GitHub Release and clean-machine installer test.
