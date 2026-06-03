# FPhoto

FPhoto is a Windows desktop app for photographers to scan a photo folder, filter files by image codes, and copy matched files safely to a destination folder.

## Current MVP Features

- Choose a photo folder with a native Windows dialog.
- Recursively scan common photo and RAW file extensions by filename only.
- Persist a lightweight SQLite index/cache so previously scanned folders can load their file list quickly.
- Search by codes and ranges:
  - `EX0001, EX0005`
  - `EX0001-EX0020`
  - `1, 5, 10-20`
  - simple free text that contains numbers
- Smart Search stays in the same search box and ignores common non-photo numbers such as time, date, phone numbers, and basic quantity phrases.
- Show scanned count, matched count, total size, and matched size.
- Switch between matched files and non-matched files for inverse filtering.
- Filter scanned files by type: All, JPEG, RAW, or Other.
- Click a file to preview supported image formats in the app. Preview is loaded through Electron IPC instead of direct `file://` paths.
- Switch between file list view and grouped view. Grouped view combines files with the same base name, such as RAW + JPEG pairs.
- Preview RAW files when an embedded thumbnail is available.
- Choose a destination folder directly. Create a new folder in the Windows folder picker if needed.
- Copy matched files without modifying originals.
- Move files after confirmation. Move verifies copied file size before deleting the source file.
- Auto-rename copied files if the destination already has the same filename.
- Open the destination folder in Explorer.

## Basic Usage

1. Choose the source photo folder.
2. Enter image codes or ranges.
3. Choose the file type filter if needed.
4. Choose whether to use matched files or non-matched files.
5. Use file view or grouped view to review results.
6. Choose the destination folder.
7. Choose Copy or Move.
8. Process the selected result set.

If the search box is empty, the app uses all scanned files in the selected file type. This is useful for copying all JPEG or all RAW files to another folder.

Smart Search examples to test:

```text
1
0001
1,2,3
001, 004, 009
1 2 3
em chọn ảnh 1, 5, từ 10 đến 12 nha
em chọn 5 tấm, gửi trước 20h, lấy ảnh 001, 004, 009
DSC_1234 đến DSC_1236, bỏ ảnh 1235
```

RAW preview uses embedded thumbnails through `exifr`, then falls back to vendored ExifTool preview extraction for broader RAW support such as RAF. Preview data is cached under the app user data folder. Some RAW formats may not expose an embedded preview, so those files can still show a placeholder. Direct preview is limited to reasonably sized JPEG/PNG/WebP/GIF/BMP files plus RAW embedded previews.

## Requirements

- Node.js
- npm
- Git

## Install Dependencies

```powershell
npm install
```

## Run In Development

```powershell
npm run dev
```

## Verify Code

```powershell
npm run lint
npm run build
```

## Build Windows Installer

```powershell
npm run dist
```

The installer is generated at:

```text
release\FPhoto-Setup-0.1.0.exe
```

## Heavy Folders That Can Be Deleted

These folders are generated and can be deleted when cleaning disk space:

```text
node_modules\
out\
release\
```

After deleting `node_modules`, run `npm install` again before developing.

Electron/electron-builder may also use cache under Windows AppData, especially:

```text
C:\Users\<user>\AppData\Local\electron-builder\Cache
```

FPhoto also stores RAW preview cache under the app user data folder. It can be deleted safely if needed; previews will be regenerated on demand. ExifTool is bundled for RAW preview fallback, so the installer is larger than before.

FPhoto stores its scan index at the app user data folder as `fphoto.sqlite`. It is used to load previously scanned folders quickly and can be deleted safely if needed; the next scan will rebuild it.

## Notes

- The current UI is functional and temporary. Core workflow is prioritized first; visual polish can be redesigned later.
- Copy is the default safe action. Move requires confirmation and deletes source files only after copy verification.
- The current installer has no code-signing certificate.
- App icon assets are generated from `LOGO.png` with `npm run generate:icon` and stored in `build\`.
