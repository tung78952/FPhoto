# FPhoto Project Plan

## Product Goal
FPhoto is a Windows desktop app for photographers and small studios. It filters large photo folders by image code, previews results, and safely copies or moves matched files without relying on Windows Explorer.

## Current Target
Ship the first public Windows release after final smoke testing.

## Current Tech Stack
- Electron
- React 19
- TypeScript
- Vite / electron-vite
- Tailwind CSS
- sql.js
- exifr
- exiftool-vendored
- electron-builder NSIS installer

## Release Scope: v1.0

### Completed
- [x] Electron + React + TypeScript foundation.
- [x] Folder selection and recursive photo scanning.
- [x] Smart Search in one search box.
- [x] Matched/unmatched result mode.
- [x] File type filter: All, JPEG, RAW, Other.
- [x] Files, Groups, and Grid views.
- [x] Safe Copy workflow.
- [x] Move workflow with confirmation and destination-size verification.
- [x] Removable-drive safety: warning banner, Move locked in UI, backend Move guard.
- [x] SQLite cache using `sql.js`.
- [x] Cached folder reload and Rescan.
- [x] Volume-serial memory-card cache fallback.
- [x] Safe preview IPC for JPEG/PNG/WebP/GIF/BMP and RAW embedded previews.
- [x] ExifTool fallback for RAW previews.
- [x] EXIF display and EXIF filter.
- [x] Optimized thumbnail grid: 420px thumbnails, virtualized renderer grid, capped thumbnail request queue, bounded RAM cache.
- [x] App logo and Windows icon generation from `LOGO.png`.
- [x] Installer metadata and NSIS installer config.
- [x] Full frontend redesign from `design_handoff_fphoto_redesign` Option B.
- [x] Light/Dark mode.
- [x] Offline bundled fonts.
- [x] Parser regression test script: `npm run verify:search`.

### Final Release Checklist
- [ ] Final smoke test optimized UI in Electron.
- [ ] Run `npm run verify:search`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `npm run dist`.
- [ ] Test installer on a clean Windows machine/VM without Node.js.
- [ ] Create GitHub Release and upload `FPhoto-Setup-1.0.0.exe`.
- [ ] Build a simple public website/download page.
- [ ] Add website Download button linking to the GitHub Release `.exe`.

## Publish Plan

### Installer
- Use `npm run dist` to generate the NSIS installer in `release\`.
- Upload the `.exe` as a GitHub Release asset.
- User downloads the installer and installs FPhoto like a normal Windows desktop app.
- Node.js is not required on the user's machine.

### Website
- Create a separate static website/download page for FPhoto.
- The website should show the product name, short value proposition, screenshots or preview media, requirements, and a clear Download button.
- The Download button should point to the latest GitHub Release installer asset.
- Hosting options:
  - GitHub Pages first, because it is simple and works well for a static download page.
  - Custom domain later if wanted.
- Keep the installer file on GitHub Releases instead of committing `.exe` binaries into the website repo.

## Dropped Scope
These are intentionally removed from the current product plan.
- Search history / recent searches.
- Separate paste/search-history workflow.
- Job management per client.
- Status, tags, rating, color labels, and XMP sidecar workflow.
- ZIP export.

## Deferred Scope
These can be reconsidered after real user feedback.
- Google Drive integration.
- Mobile companion app.
- Cloud backup.
- Multi-language.
- Auto-update system.
- Code signing certificate.
- macOS build.

## Success Criteria For v1.0
- Search/filter large folders quickly without UI freeze.
- Grid scrolling remains smooth on weaker machines.
- Copy/Move large RAW/JPEG selections without crash.
- Removable-drive sources are protected from accidental Move.
- Installer works on a clean Windows machine without Node.js.
- Public website lets users download the `.exe` installer cleanly.

## Notes
- Do not re-add dropped features unless the user explicitly asks.
- Keep backend/IPC stable when changing UI.
- Keep release work focused: smoke test, package, clean-machine install test, GitHub Release, website/download page.
