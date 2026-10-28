# 🩸 SANGUINIS CORE BOT & WEB DASHBOARD

> Hệ thống Discord Bot quản trị toàn diện, bảo mật cấp độ cao và Web Dashboard quản lý trực quan theo phong cách Arcane / Cyberpunk Dark Crimson.

---

## 🌟 Tính Năng Nổi Bật

### 1. 🛡️ Hệ Thống 13 Kênh Security & Audit Logs Chuyên Biệt

Tự động theo dõi, phân loại và gửi Embed thông báo theo thời gian thực tới 13 kênh log độc lập:

- **`📜 server-log`**: Cập nhật thay đổi tên, icon, banner, vanity URL của máy chủ.
- **`👤 member-log`**: Theo dõi thành viên tham gia, rời máy chủ, biến động quân số.
- **`🛡️ moderation-log`**: Lịch sử Mute, Kick, Ban, Unban và Timeout thành viên.
- **`🔐 permission-log`**: Thay đổi phân quyền kênh và cấu hình Role.
- **`🎭 role-log`**: Tạo mới, chỉnh sửa màu sắc/tên và xóa Role.
- **`📁 channel-log`**: Khởi tạo, chỉnh sửa và dọn dẹp Text/Voice/Category.
- **`💬 message-log`**: Bắt sự kiện xóa tin nhắn, chỉnh sửa tin nhắn (so sánh trước & sau).
- **`🔊 voice-log`**: Lắng nghe trạng thái tham gia, rời phòng, chuyển kênh thoại.
- **`🔗 invite-log`**: Ghi nhận người tạo link mời, hạn dùng và mã liên kết.
- **`🚨 security-log`**: Cơ chế Anti-Phishing, tự động quét và xóa tin nhắn phát tán link mời Discord lạ.
- **`☢️ anti-nuke-log`**: Cảnh báo các hành vi phá hoại hàng loạt từ tài khoản có quyền hạn.
- **`🥖 anti-raid-log`**: Quét tuổi tài khoản (Account Age) khi gia nhập, tự động kick các tài khoản Clone/Alt mới tạo.
- **`🤖 bot-log`**: Theo dõi việc thêm/xóa bot vào máy chủ.

### 2. 🎁 Quản Lý Giveaway Nâng Cao & Rigged Winners

- **Điều kiện tham gia đa tầng:** Yêu cầu Role bắt buộc, tuổi tài khoản Discord, số giờ tham gia máy chủ, Level tối thiểu, số lượng tin nhắn tối thiểu và số người tham gia tối thiểu.
- **Cơ chế trao giải linh hoạt:** Hỗ trợ quay số ngẫu nhiên (Random) hoặc chỉ định người thắng cho từng vị trí Top (`rigged_winners`) thông qua Web UI.
- **Lịch sử & Reroll:** Bảng theo dõi lịch sử trao giải (`giveaway_history`), tính năng Kết Thúc Ngay và Reroll trực tiếp từ Web Dashboard.

### 3. 🌐 Web Dashboard (Express, EJS, TailwindCSS, SweetAlert2)

- Đăng nhập an toàn qua Discord OAuth2 với session lưu trữ bền vững trên SQLite.
- Đồng bộ real-time danh sách Role, Thành viên, Text Channel, Voice Channel.
- Hệ thống thông báo cảnh báo và hộp thoại xác nhận phong cách Dark Blood bằng SweetAlert2.
- Cho phép gửi tin nhắn Test Welcome, Test Goodbye và Test DM trực tiếp từ giao diện Web.

### 4. ⚡ Hệ Thống Leveling & Tích XP (Phong Cách Arcane)

- Công thức tính Level chuẩn xác ($5 \times \text{level}^2 + 50 \times \text{level} + 100$).
- Thiết lập Cooldown, XP ngẫu nhiên mỗi tin nhắn.
- Bộ lọc kênh cấm tích XP (`no_xp_channels`) và Role cấm tích XP (`no_xp_roles`).
- Hệ số nhân Boost XP ($x2, x3, x5$) dành cho các Role được chỉ định.

---

## 🛠️ Công Nghệ Sử Dụng

- **Runtime:** Node.js (v18+)
- **Bot Library:** [Discord.js v14](https://discord.js.org/)
- **Web Framework:** Express.js, EJS Template Engine
- **Database:** SQLite (`sqlite3`, `sqlite`)
- **Styling & UI:** TailwindCSS, FontAwesome 6, SweetAlert2
- **Authentication:** Passport.js (`passport-discord`), Express Session (`connect-sqlite3`)

---

## 🚀 Hướng Dẫn Cài Đặt & Triển Khai Cục Bộ

### 1. Clone Kho Lưu Trữ

````bash
git clone [https://github.com/GruGruDev/sanguinis-core-bot.git](https://github.com/GruGruDev/sanguinis-core-bot.git)
cd sanguinis-core-bot
2. Cài Đặt Gói Phụ Thuộc
Bash
npm install
3. Thiết Lập Biến Môi Trường (.env)
Tạo file .env ở thư mục gốc với cấu trúc:

Đoạn mã
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
CLIENT_SECRET=your_client_secret_here
SESSION_SECRET=sanguinis_secret_key_2026
GUILD_ID=your_primary_guild_id
PORT=3000
Lưu ý: Trong Discord Developer Portal > OAuth2 > Redirects, thêm URL sau:

http://localhost:3000/auth/discord/callback

4. Đăng Ký Slash Commands Lên Discord
Bash
node deploy-commands.js
5. Khởi Chạy Ứng Dụng
Chế độ phát triển (Development với Nodemon):

Bash
npm run dev
Chế độ chạy thực tế (Production):

Bash
npm start
Truy cập Web Dashboard tại: http://localhost:3000

📂 Cấu Trúc Thư Mục
Plaintext
sanguinis-core-bot/
├── src/
│   ├── commands/          # Slash commands (economy, moderation, utility)
│   ├── database/          # Cấu trúc CSDL SQLite & Migration
│   ├── events/            # 13+ sự kiện Discord & Security Listeners
│   ├── handlers/          # Tự động nạp commands và events
│   ├── modules/           # Module mở rộng (Leveling XP)
│   ├── services/          # Các tiến trình ngầm (Giveaway Scheduler)
│   ├── utils/             # Helper xử lý nhật ký (Logger trung tâm)
│   ├── web/               # Express App, Routes & Views (EJS)
│   ├── bot.js             # Khởi tạo Client Discord
│   └── index.js           # Điểm khởi động toàn bộ hệ thống
├── deploy-commands.js     # Script đăng ký Slash Command lên Discord API
└── package.json
📜 Giấy Phép (License)
Dự án được phân phối dưới giấy phép MIT License.


---

### Các bước Commit và Push `README.md` lên GitHub:

Sau khi lưu file `README.md`, bạn mở terminal tại thư mục dự án và chạy các lệnh sau:

```powershell
git add README.md
git commit -m "docs: add comprehensive project README"
git push origin main
````
