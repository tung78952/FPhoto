# FPhoto

FPhoto is a Windows desktop app for photographers to scan a photo folder, filter files by image codes, and copy matched files safely to a destination folder.

## Current MVP Features

- Choose a photo folder with a native Windows dialog.
- Recursively scan common photo and RAW file extensions by filename only.
- Search by codes and ranges:
  - `EX0001, EX0005`
  - `EX0001-EX0020`
  - `1, 5, 10-20`
  - simple free text that contains numbers
- Show scanned count, matched count, total size, and matched size.
- Choose a parent destination folder and type the result folder name manually.
- Copy matched files without modifying originals.
- Auto-rename copied files if the destination already has the same filename.
- Open the destination folder in Explorer.

## Basic Usage

1. Choose the source photo folder.
2. Enter image codes or ranges.
3. Choose the parent destination folder.
4. Type the result folder name, for example `AnhTuan_Final`.
5. Copy matched files.

Example output path:

```text
D:\Wedding\AnhTuan_Final
```

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
release\FPhoto Setup 0.1.0.exe
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

## Notes

- The current UI is functional and temporary. Core workflow is prioritized first; visual polish can be redesigned later.
- The app is copy-only for safety. It does not move or delete source photo files.
- The current installer uses the default Electron icon and has no code-signing certificate.
