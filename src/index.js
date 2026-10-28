require("dotenv").config();
const expressApp = require("./web/server");
const { botInstance } = require("./bot");
const { initGiveawayScheduler } = require("./services/giveawayScheduler");

const PORT = process.env.PORT || 3000;

// 1. Mở ngay Web Server trên 0.0.0.0 để Render phát hiện Port lập tức
expressApp.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 [WEB] Dashboard đang lắng nghe tại port: ${PORT} (0.0.0.0)`);
  console.log(`🩸 [SYSTEM] Render Port Scan thành công!`);
});

// 2. Khởi chạy Discord Bot & Scheduler độc lập trong nền
(async () => {
  try {
    console.log("🩸 [BOT] Đang kết nối Discord Client...");
    await botInstance.start();

    if (botInstance.client) {
      initGiveawayScheduler(botInstance.client);
      console.log("🏆 [GIVEAWAY] Bộ lập lịch sự kiện đã kích hoạt.");
    }

    console.log("✅ [SYSTEM] Hệ thống Sanguinis đã sẵn sàng hoạt động!");
  } catch (error) {
    console.error("❌ Lỗi trong quá trình khởi chạy Bot Discord:", error);
  }
})();
