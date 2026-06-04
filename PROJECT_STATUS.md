# FPhoto Project Status

## Current Phase
Phase 22: App feature work and frontend redesign are code-complete AND now committed. The redesign + Vietnamese UI + docs were committed in `ae5b0ac`; the app logo + Windows icon were switched to the v2 cream design in `36e874e`. Release gates (`verify:search`, `lint`, `build`) all pass on the latest commit. Remaining work is release prep only: smoke test, decide version number, rebuild installer, clean-machine install test, GitHub Release, and a public website/download page.

### Handoff note (for a new chat/session)
- The redesign is safely in git — no uncommitted-risk anymore.
- Loose untracked files intentionally NOT committed: `FPhoto.zip`, `LOGO_v2.png` (now redundant; its content is in `LOGO.png` + `src/renderer/src/assets/logo-mark.png`), `FRONTEND_REDESIGN_BRIEF.md`, `design_handoff_fphoto_redesign/`. `.gitignore` was deliberately not changed.
- **Open decision before packaging/release:** version number stays `0.1.0` or bumps to `1.0.0`? `package.json` is `0.1.0`; installer artifact name is `FPhoto-Setup-0.1.0.exe`.
- Commits not pushed to remote yet (`ae5b0ac`, `36e874e`) — push when ready.

## Goal
Build a Windows desktop app for photographers to quickly filter photo files by image codes and safely copy or move matched files.

## Repository
GitHub: https://github.com/tung78952/FPhoto.git

## Tech Stack
- Electron
- React 19
- TypeScript
- Vite / electron-vite
- Tailwind CSS
- sql.js
- exifr
- exiftool-vendored
- electron-builder
- ESLint / Prettier

## Completed
- Built Electron + React + TypeScript desktop app.
- Added safe preload APIs and Electron IPC for selecting folders, scanning photos, reading cached scans, preview/thumbnail/EXIF, copying/moving files, and opening folders.
- Implemented recursive photo scanning for common JPEG/PNG/WebP/TIFF/BMP/GIF/RAW formats.
- Implemented Smart Search in one search box: numeric shorthand, comma/space lists, ranges, Vietnamese natural text ranges, exclusion phrases, and noise filtering for dates/times/money/height/weight.
- Added `npm run verify:search` regression tests for parser behavior.
- Added file type filter: All, JPEG, RAW, Other.
- Added matched/unmatched result mode.
- Added Files, Groups, and Grid result views.
- Added safe Copy/Move workflow. Move requires confirmation, verifies destination size, then deletes source.
- Added duplicate destination filename handling with `(2)`, `(3)`, etc.
- Added copy/move progress events and result toast.
- Added removable-drive protection: app warns for SD/USB/removable sources, locks Move in renderer, and refuses Move in backend if a source is removable.
- Added SQLite cache with `sql.js` at `app.getPath('userData')\fphoto.sqlite`.
- Added fast cached folder reload plus Rescan flow.
- Added volume-serial memory-card identification so cached card paths can survive Windows drive-letter changes.
- Added image preview through safe IPC. Renderer no longer loads local `file://` paths directly.
- Added RAW preview using `exifr.thumbnail()` plus ExifTool fallback: `extractPreview`, `extractJpgFromRaw`, and `extractThumbnail`.
- Added EXIF display and EXIF filter by date-taken range and ISO range. EXIF is loaded on demand and cached with mtime guard.
- Added thumbnail grid view.
- Optimized grid performance: custom virtualized grid, capped in-flight thumbnail requests, bounded RAM thumbnail cache, and resized 420px `thumb-v2` thumbnail cache instead of full-size preview data.
- Added app logo from `LOGO.png`, generated `build\icon.png` and `build\icon.ico`, and wired installer icon metadata.
- Rebuilt UI from `design_handoff_fphoto_redesign` Option B ("Bold Focus") while keeping backend/IPC contracts stable.
- Added Light/Dark mode.
- Bundled offline fonts with `@fontsource`: Be Vietnam Pro for UI/body, Source Serif 4 for H1, JetBrains Mono for paths/metadata.
- Updated ESLint ignores so design handoff prototype files are not linted as production code.
- Removed unused `react-window` dependency after replacing it with the custom virtualized grid.
- Verified latest state with `npm run verify:search`, `npm run lint`, and `npm run build`.
- Committed the full frontend redesign, Vietnamese UI, Light/Dark, offline fonts, and docs in `ae5b0ac`.
- Switched the in-app logo and the Windows app/installer icon to the v2 cream design and regenerated `build/icon.ico` + `build/icon.png` in `36e874e`.

## Dropped Scope
These were in the original roadmap but the user dropped them on 2026-06-04. Do not report them as remaining work unless the user explicitly reopens them.
- Search history / recent searches.
- Separate paste/search-history workflow. Smart Search stays in the single existing search box.
- Job management per client.
- Status, tags, rating, color labels, and XMP sidecar workflow.
- ZIP export.

## Deferred Scope
These are later ideas, not blockers for the current release.
- Version 2.0 ideas: Google Drive integration, mobile companion, cloud backup, multi-language.
- Code signing certificate to reduce Windows SmartScreen warnings.
- Auto-update or download API.
- macOS build.

## In Progress
- Release preparation only. App feature work is code-complete.

## Next Steps
1. Final smoke test in Electron (`npm run dev`): Light/Dark mode, new v2 logo in header/footer/empty-state, folder rail, Smart Search, Files/Groups/Grid views, optimized grid scrolling, preview panel, EXIF filter, Copy/Move, removable-drive Move lock, toast, and Move confirmation.
2. Decide the release version (keep `0.1.0` or bump to `1.0.0`); update `package.json` if bumping.
3. Release gates already pass on the latest commit. Re-run `npm run verify:search`, `npm run lint`, `npm run build` if more changes land, then `npm run dist` to rebuild the installer (includes the new v2 icon).
4. Test the produced `release\FPhoto-Setup-<version>.exe` on a clean Windows machine or VM without Node.js.
5. Create a GitHub Release and upload the installer `.exe` (push commits first; needs `gh` auth).
6. Create a simple public website/download page for FPhoto. The page should present the app and have a Download button that points to the GitHub Release installer asset, optionally hosted on GitHub Pages with a custom domain later.

## Commands
```powershell
npm install
npm run dev
npm run verify:search
npm run lint
npm run build
npm run dist
```

## Important Decisions
- Keep `PROJECT_STATUS.md` updated so another chat/agent can continue from this file.
- Keep main/preload/shared APIs stable; frontend redesign should not break backend/IPC.
- Use `sql.js` for app cache to avoid native SQLite rebuild/installer issues.
- Search is rule-based/offline; no AI/API is used.
- Photo scan indexes filenames and metadata only; it does not decode full images during scan.
- EXIF is read on demand, not during scan.
- RAW preview avoids full RAW decoding and uses embedded preview/ExifTool fallback only.
- Grid thumbnails are resized/cache to 420px `thumb-v2` and shown through the custom virtualized grid.
- Publish direction: upload installer to GitHub Releases first, then build a separate static website/download page linking to that release asset.
- `signAndEditExecutable` is disabled in electron-builder because local Windows symlink privileges can block `winCodeSign` extraction. Re-enable later only if signing/version-resource editing is needed and the machine supports it.

## Known Issues / Release Notes
- GitHub Release creation may require `gh` authentication or browser login.
- Clean-machine installer testing requires another Windows environment or VM without Node.js.
- Unsigned Windows installers may trigger SmartScreen warnings until code signing is added.
- Website/download page is planned but not built yet.
- Local `node_modules\react-window` may still exist if Windows blocked `npm uninstall`, but it has been removed from `package.json` and `package-lock.json`.

## Notes For Next Agent
Read this file first, then inspect `git status --short` and `package.json` scripts. Do not re-add dropped features: Search history, separate paste/history workflow, Job management, Status/tags/XMP, ZIP export, or v2.0 cloud/mobile features unless the user explicitly asks. The next best step is final UI smoke testing, then packaging, clean-machine installer testing, GitHub Release, and the public website/download page.
