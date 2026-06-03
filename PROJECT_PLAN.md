# 📋 Photo Filter App - Project Plan

> App desktop Windows giúp photographer lọc nhanh file ảnh theo mã (EX0001, EX0005...) thay vì dùng Windows Explorer. Đóng gói thành file `.exe` installer cho user tải về cài.

---

## 🎯 Mục tiêu sản phẩm

- **Pain point:** Windows Explorer không search được nhiều mã file cùng lúc (vd: EX0001, EX0005, EX0023). Photographer phải làm thủ công, mất thời gian.
- **Solution:** Desktop app cho phép nhập nhiều mã / range / paste text tự do để lọc file nhanh.
- **Target user:** Photographer cá nhân, studio nhỏ.
- **Platform:** Windows (ưu tiên), có thể mở rộng macOS sau.

---

## 🛠️ Tech Stack

```yaml
Frontend:
  - React 18
  - TypeScript
  - Tailwind CSS
  - Vite (dev server, build tool)
  - react-window (virtual scroll cho list dài)

Desktop:
  - Electron (latest stable)
  - electron-builder (đóng gói)
  - electron-vite (template tích hợp sẵn)

Backend (local):
  - Node.js fs/promises
  - better-sqlite3 (từ v1.1)
  - exifr (từ v1.2)
  - chokidar (watch folder, optional)

Tooling:
  - ESLint + Prettier
  - Git + GitHub
```

---

## 📦 MVP - Version 1.0

**Target:** 3-4 tuần

### Sprint 1: Foundation (3-4 ngày)

**Deliverable:** Project chạy được, có cửa sổ desktop hiện ra

- [ ] Setup project Electron + React + TypeScript
- [ ] Config Vite + Tailwind CSS
- [ ] Setup ESLint + Prettier
- [ ] Tạo Git repo, commit initial
- [ ] Layout khung: header, sidebar, main content area
- [ ] Build script chạy được (`npm run dev`)

### Sprint 2: Core Search Engine (5-6 ngày)

**Deliverable:** Tính năng search hoạt động end-to-end

- [ ] Native dialog "Chọn folder ảnh"
- [ ] Scan folder, đọc danh sách file (Electron IPC)
- [ ] Parser cho input search:
  - Comma-separated: `EX0001, EX0005, EX0023`
  - Range: `EX0001-EX0050`
  - Mixed: `1, 5, 23-30, 47`
  - Free text: `"em chọn 1, 5, từ 10 đến 15"` → extract số
- [ ] Filter file theo list mã
- [ ] Group RAW + JPEG cùng base name
- [ ] Hiện kết quả: count, list file, total size

### Sprint 3: File Actions (3-4 ngày)

**Deliverable:** Lọc xong làm được việc với file

- [ ] Copy file sang folder mới
- [ ] Auto tạo folder theo template `[Client]_[Date]_Final`
- [ ] Progress bar khi copy (file ảnh lớn)
- [ ] Mode lọc ngược: lọc file KHÔNG match
- [ ] Mở folder kết quả trong Explorer sau khi xong

### Sprint 4: Memory Card Support (2-3 ngày)

**Deliverable:** App làm việc được với thẻ nhớ

- [ ] Detect ổ removable
- [ ] Banner cảnh báo "đang ở thẻ nhớ - read-only mode"
- [ ] Disable Move/Delete khi ở thẻ
- [ ] Optimize scan: chỉ đọc tên file, không decode RAW

### Sprint 5: Package & Release (2-3 ngày)

**Deliverable:** File `.exe` installer phân phối được

- [ ] Tạo icon app
- [ ] Config `electron-builder` cho NSIS installer
- [ ] Build `.exe` setup
- [ ] Test cài trên máy clean (không có Node.js)
- [ ] Upload GitHub Release
- [ ] Viết README + screenshot

**🚀 Ship MVP**

---

## 📦 Version 1.1 - Quality of Life

**Target:** 2 tuần sau MVP

### Sprint 6: Smart Paste (3-4 ngày)

- [ ] Paste box riêng cho input từ chat khách
- [ ] Detect số trong text tự nhiên (regex thông minh hơn)
- [ ] Preview kết quả parse trước khi search
- [ ] Lịch sử các lần search gần đây

### Sprint 7: SQLite Index (4-5 ngày)

- [ ] Setup `better-sqlite3`
- [ ] Schema: `folders`, `photos`, `scan_history`
- [ ] Cache index sau lần scan đầu
- [ ] Detect file mới/bị xóa khi scan lại
- [ ] Volume serial number để nhận diện thẻ nhớ cũ

### Sprint 8: Job Management (3-4 ngày)

- [ ] Concept "Job" = 1 lần chụp cho 1 khách
- [ ] Form tạo job: tên khách, ngày, ghi chú
- [ ] List job: hiện job đã tạo
- [ ] Lưu mã ảnh đã giao cho từng job
- [ ] Search lại job cũ: "khách này đã nhận tấm nào?"

**🚀 Ship v1.1**

---

## 📦 Version 1.2 - Power Features

**Target:** 2 tuần sau v1.1

### Sprint 9: EXIF Reading (3-4 ngày)

- [ ] Cài `exifr` library
- [ ] Đọc EXIF: ngày chụp, ISO, khẩu, shutter, lens, body
- [ ] Filter theo EXIF: vd "ảnh chụp sáng nay", "ảnh ISO > 3200"
- [ ] Hiện EXIF info khi click vào file

### Sprint 10: Thumbnail Preview (3-4 ngày)

- [ ] Đọc embedded thumbnail trong RAW (nhanh)
- [ ] Generate thumbnail cho JPEG
- [ ] Grid view xem ảnh
- [ ] Cache thumbnail vào AppData
- [ ] Lazy load khi scroll

### Sprint 11: Status & Tags (2-3 ngày)

- [ ] Mark file: "đã giao khách", "đã edit", "khách thích"
- [ ] Filter theo status
- [ ] Color label / star rating
- [ ] Đọc XMP sidecar từ Lightroom (nếu có)

### Sprint 12: ZIP Export (2 ngày)

- [ ] Nén kết quả lọc thành ZIP
- [ ] Progress bar
- [ ] Split nếu quá lớn (vd > 5GB chia nhiều part)

**🚀 Ship v1.2**

---

## 📦 Version 2.0 - Cloud & Mobile (Roadmap dài hạn)

Để sau khi có user feedback từ v1.x:

- Tích hợp Google Drive API (đối chiếu Drive vs local)
- Companion mobile app (React Native) - browser ảnh trên điện thoại
- Auto-backup config sang cloud
- Multi-language

---

## 🗂️ Project Structure dự kiến

```
photo-filter/
├── src/
│   ├── main/              ← Electron main process
│   │   ├── index.ts       ← Entry point
│   │   ├── ipc/           ← IPC handlers
│   │   ├── fs/            ← File system operations
│   │   └── db/            ← SQLite (sprint 7+)
│   ├── renderer/          ← React UI
│   │   ├── App.tsx
│   │   ├── components/    ← UI components
│   │   ├── pages/         ← Search, Jobs, Settings
│   │   ├── hooks/         ← React hooks
│   │   └── lib/           ← Utilities
│   └── shared/            ← Types dùng chung 2 process
├── electron-builder.yml
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🎯 Success Metrics cho MVP

- ✅ Search 5000 file ra kết quả < 1 giây
- ✅ Copy 100 file RAW (vd 200GB) không crash
- ✅ Installer < 200MB
- ✅ App khởi động < 3 giây
- ✅ Đọc được thẻ SD/CF mà không sửa file gốc

---

## ⚠️ Rủi ro cần lưu ý

| Rủi ro | Mức độ | Giải pháp |
|--------|--------|-----------|
| Scan thẻ nhớ chậm khi nhiều file | Cao | Stream từng batch, không load all vào RAM |
| RAW file quá lớn, copy chậm | Trung | Progress bar + có thể cancel |
| Windows defender flag .exe lạ | Trung | Code signing certificate (sau MVP) |
| UI lag khi list 10000 file | Cao | Virtual scrolling (react-window) |
| Khác biệt RAW format (CR3, NEF, ARW...) | Thấp | Test với nhiều format, fallback theo extension |

---

## 📋 Pre-requisites - Cài đặt môi trường

### Bắt buộc

1. **Node.js** (LTS version)
   - Tải: https://nodejs.org
   - Verify: `node -v` và `npm -v`

2. **Git**
   - Tải: https://git-scm.com/download/win
   - Verify: `git --version`

3. **VSCode**
   - Tải: https://code.visualstudio.com

### VSCode Extensions

**Bắt buộc:**
- ES7+ React/Redux/React-Native snippets
- ESLint
- Prettier - Code formatter
- Tailwind CSS IntelliSense

**Nên có:**
- GitLens
- Error Lens
- Auto Rename Tag

---

## 💡 Ý tưởng tính năng cho tương lai

Đã brainstorm trong các phase trước, lưu lại để reference:

### Search & Filter
- Search theo range (EX0001-EX0050) ✅ MVP
- Paste tự do từ chat khách ✅ v1.1
- Filter theo loại file (RAW/JPEG/TIFF)
- Filter theo EXIF (ngày, ISO, lens, body) ✅ v1.2
- Filter theo rating/color label từ Lightroom ✅ v1.2

### Actions
- Copy/Move sang folder khác ✅ MVP
- Auto tạo folder theo template ✅ MVP
- Rename batch theo template
- Export ZIP ✅ v1.2
- Mở folder trong Explorer ✅ MVP

### Metadata
- Đọc EXIF ✅ v1.2
- Thumbnail preview ✅ v1.2
- Đọc XMP sidecar ✅ v1.2
- Hiện EXIF info khi click

### Workflow
- Index folder (cache) ✅ v1.1
- So sánh 2 folder (gốc vs edited)
- Tìm duplicate
- Search across nhiều ổ cứng
- Job management theo khách ✅ v1.1
- Lịch sử giao khách ✅ v1.1

### Memory Card
- Detect removable drive ✅ MVP
- Read-only mode ✅ MVP
- Cache theo volume serial ✅ v1.1
- Eject từ trong app

### UX nâng cao
- Quick cull mode (Keep/Reject như Photo Mechanic)
- Watch folder (auto-update khi cắm thẻ)
- Bulk rename với preview
- Undo/Redo
- Keyboard shortcuts

---

## 🚦 Trạng thái hiện tại

- [x] Brainstorm tính năng
- [x] Chọn tech stack (Electron + React + TS)
- [x] Lập project plan
- [ ] Cài đặt môi trường (Node.js, Git, VSCode extensions)
- [ ] **→ Sprint 1: Foundation** (bước tiếp theo)
