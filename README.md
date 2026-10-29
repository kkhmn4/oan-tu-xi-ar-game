# ✌️✊✋ Game AR Oẳn Tù Xì · Manabie AI Lab

> **Bản nâng cấp cho máy tính bảng (29/10/2026)**, fork từ `hoang-tuannguyen-manabie/oan-tu-xi-ar-game`:
> - Giao diện sáng màu cho học sinh nhỏ: nền kem, thẻ trắng viền dày, bàn tay và Bot 3D.
> - Mỗi lượt đi theo 4 bước rõ ràng: **Ra tay, Chốt, Lắc tay, Mở thẻ**. Người chơi giơ Búa, Kéo hoặc Bao và giữ yên cho vòng quanh tay chạy đầy thì máy chốt; sau đó lắc tay qua lại (hướng nào cũng được) cho vòng cam đầy dần: đầy 1/3 máy hô OẲN, 2/3 hô TÙ, đầy hết hô XÌ và mở thẻ. Ngừng lắc thì hiện "Lắc tay để tiếp tục". Chơi bằng nút: bấm một thế tay là chốt, máy tự hô.
> - Một tiêu điểm duy nhất: chữ lệnh to ở trên, tay người chơi đối mặt thẻ của máy ở giữa, nhịp ở dưới; viền màn hình đỏ lúc XÌ, đổi màu theo kết quả. Chữ Nunito (dấu chồng tiếng Việt rõ ở cỡ lớn).
> - Không thấy tay lúc chốt thì chơi lại lượt đó (không tự gán Búa). Có thẻ "LƯỢT n" báo lượt mới, màn nghỉ đổi bạn giữa hai vòng.
> - Không có camera hoặc mất mạng thì chơi bằng 3 nút bấm. Không hiện hình camera, chỉ vẽ khung xương bàn tay.
> - **Tối ưu máy tính bảng RAM 4 GB:** nhận diện tay chạy trong Web Worker (`public/mediapipe/hand-worker.js`), giao diện không khựng; lúc nạp sẵn ở trang đầu, worker chạy thử để chọn GPU hay CPU; khung camera thu nhỏ còn 320 px (256 px ở chế độ nhẹ) trước khi nhận diện, chỉ nhận diện ở các pha cần tay; thư viện và mô hình tự phục vụ ở `public/mediapipe/` (đúng phiên bản, trình duyệt giữ 30 ngày); giao diện React chỉ vẽ lại khi trạng thái hiển thị đổi; máy có RAM ≤ 4 GB hoặc ≤ 4 nhân CPU tự bật chế độ nhẹ (ép bằng `?lite=1` hoặc `?lite=0`). Đo với CPU chậm 4 lần: từ 1,3 lên khoảng 50 khung/giây.
> - Logic lượt: `src/utils/engine.ts`. Triển khai Netlify theo `netlify.toml`. `npm run dev` và `npm run build` tự chép thư viện MediaPipe từ `node_modules` vào `public/mediapipe/`.
>
> Phần dưới là mô tả của bản gốc.

Ứng dụng trò chơi tương tác thực tế ảo tăng cường (**Augmented Reality**) "Oẳn Tù Xì" (Rock - Paper - Scissors) nhận diện cử chỉ bàn tay qua Camera AI thời gian thực, xây dựng riêng cho các sự kiện Workshop & Team Building của **Manabie AI Lab**.

---

## 🌟 Điểm Nổi Bật & Tính Năng Chính

1. **Khởi Tạo Đội & Chọn Nhân Vật (Zero-Scroll Modal):**
   - Người chơi điền thông tin **Tên nhóm** và **Tên lớp** trước khi vào trận.
   - Lưới chọn **36 nhân vật** đặc sắc hiển thị trực quan, vừa vặn toàn màn hình mà **không cần cuộn trang (no scroll)**.
   - Asset nhân vật được trích xuất trực tiếp từ sprite sheet `asset/Character.png` trong thư mục dự án.

2. **Nhận Diện Cử Chỉ Bàn Tay AR (MediaPipe Hand Landmark):**
   - Chế độ theo dõi **1 bàn tay duy nhất** (`numHands: 1`) độ chính xác cao.
   - Thuật toán giải phẫu học hình học bàn tay 21 điểm (Landmark Geometry) tự động nhận diện 3 thế tay chuẩn xác:
     - ✌️ **KÉO (Scissors):** Ngón trỏ và ngón giữa duỗi thẳng, ngón đeo nhẫn và ngón út co lại.
     - ✊ **BÚA (Rock):** Tất cả 4 ngón tay co sát lòng bàn tay thành nắm đấm.
     - ✋ **BAO (Paper):** Tất cả các ngón tay duỗi mở rộng tự nhiên.
   - Skeleton bàn tay phát sáng công nghệ cao kết nối các khớp đốt ngón tay mượt mà.

3. **Luật Chơi & Thể Thức Thi Đấu 2 Vòng (10 Lượt):**
   - **Tổng cộng 10 lượt đấu**, chia thành **2 vòng (Round 1 và Round 2)**, mỗi vòng **5 lượt**.
   - **Khoảng nghỉ giữa vòng (Intermission Gap):** Sau khi hoàn thành Round 1, đồng hồ đếm ngược **5 giây** xuất hiện để người chơi 2 / đồng đội chuẩn bị vào vị trí.
   - **Nhịp điệu đếm ngược "OẲN - TÙ - XÌ":**
     - Trước mỗi lượt đấu, màn hình hiển thị chữ **OẲN** (giây thứ 3) ➔ **TÙ** (giây thứ 2) ➔ **XÌ** (giây thứ 1).
     - Hiệu ứng **rung lắc màn hình (screen shake & pulse vibration)** cùng âm thanh nhịp điệu sinh động.
     - Tại thời khắc chạm mốc **0s**, hệ thống chốt thế tay sau cùng của người chơi, đồng thời AI bung ra lựa chọn ngẫu nhiên.
   - **Quy tắc thắng thua:**
     - ✌️ Kéo thắng ✋ Bao (+100 điểm)
     - ✊ Búa thắng ✌️ Kéo (+100 điểm)
     - ✋ Bao thắng ✊ Búa (+100 điểm)
     - Hòa nhau (+30 điểm hữu nghị)
     - Thua cuộc (0 điểm)

4. **Hiệu Ứng Đấu Trường AI Hiện Đại:**
   - Visual đấu trường AR kế thừa từ dòng game AI Manabie (Mascot trợ lý, hướng dẫn vị trí đứng, viền camera phát sáng).
   - Tích hợp bộ thẻ bài và logic RPS kinh điển từ `casino-rock-paper-scissors`.
   - Hiệu ứng va chạm (Clash Shockwave), tia lửa điện tử, âm thanh Synth Web Audio độ trễ 0ms.

5. **Tối Ưu Phần Cứng & Giải Phóng Tài Nguyên:**
   - Tự động tắt luồng Camera AR (`MediaStream.getTracks().forEach(t => t.stop())`) và ngắt giải thuật AI ngay khi kết thúc trận đấu hoặc bấm thoát ra ngoài, triệt tiêu 100% hiện tượng hao pin / nóng máy / giật lag.

---

## 🛠️ Ngăn Xếp Công Nghệ (Tech Stack)

- **Giao diện & Ứng dụng:** [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Đóng gói & Chạy Dev:** [Vite 6](https://vitejs.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Thị giác máy tính AI:** [@mediapipe/tasks-vision](https://www.npmjs.com/package/@mediapipe/tasks-vision)
- **Hệ thống âm thanh:** Bộ tổng hợp âm thanh đa tần số Web Audio API Synth (Zero external audio file dependencies)

---

## 🚀 Cài Đặt & Khởi Chạy

### 1. Cài đặt dependencies (nếu chưa có):
```bash
npm install
```

### 2. Chạy môi trường phát triển (Dev Server):
```bash
npm run dev
```
Trò chơi sẽ sẵn sàng tại: `http://localhost:3302/`

### 3. Build kiểm tra bản phát hành (Production Build):
```bash
npm run build
npm run preview
```

---

## 📁 Cấu Trúc Dự Án

```
game-ar-oan-tu-ti-demo-manabie/
├── asset/
│   └── Character.png          # Sprite sheet 36 nhân vật gốc
├── public/
│   ├── assets/
│   │   ├── characters/        # Sprite sheet nhân vật phục vụ web
│   │   ├── rps/               # Thẻ bài Rock, Paper, Scissors trích xuất từ casino-rps
│   │   └── fonts/             # Font chữ Be Vietnam Pro & JetBrains Mono
│   └── mascots/               # Linh vật Manabie
├── src/
│   ├── components/
│   │   ├── PlayerSetupModal.tsx  # Modal chọn nhân vật & điền thông tin (no scroll)
│   │   ├── Intro.tsx             # Màn hình bắt đầu, giới thiệu thể thức & luật đấu
│   │   ├── Game.tsx              # Đấu trường AR, luồng camera & nhận diện cử chỉ tay
│   │   └── Debrief.tsx           # Tổng kết 2 vòng đấu, bảng phân tích lịch sử 10 lượt
│   ├── data/
│   │   ├── characters.ts         # Bản đồ tọa độ 36 nhân vật trên sprite sheet
│   │   ├── rps.ts                # Định nghĩa Kéo, Búa, Bao & ma trận thắng thua
│   │   └── brand.ts              # Tài nguyên nhận diện thương hiệu Manabie
│   ├── utils/
│   │   ├── audio.ts              # Web Audio Synthesizer (tiếng Oẳn, Tù, Xì, va chạm, win)
│   │   ├── gesture.ts            # Thuật toán phân tích cử chỉ tay Kéo - Búa - Bao
│   │   └── engine.ts             # Vòng lặp trận đấu, 2 rounds, 5s intermission, shake screen
│   ├── App.tsx                   # Điều hướng các trạng thái game
│   ├── main.tsx                  # Điểm khởi động ứng dụng React
│   └── index.css                 # Bộ hiệu ứng animation & CSS tokens
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

*Phát triển bởi Đội ngũ Công nghệ Manabie AI Lab · 2026*
