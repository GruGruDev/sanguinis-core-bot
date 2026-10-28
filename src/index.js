require("dotenv").config();
const { botInstance } = require("./bot");
const expressApp = require("./web/server");
const { initGiveawayScheduler } = require("./services/giveawayScheduler");

(async () => {
  try {
    // 1. Khởi chạy Discord Bot
    await botInstance.start();
    initGiveawayScheduler(botInstance.client);
    // 2. Khởi chạy Web Dashboard
    const PORT = process.env.PORT || 3000;
    expressApp.listen(PORT, () => {
      console.log(`[WEB] Dashboard chạy tại: http://localhost:${PORT}`);
      console.log("[SYSTEM] Khởi chạy hoàn tất toàn bộ hệ thống!");
    });
  } catch (error) {
    console.error("❌ Lỗi trong quá trình khởi chạy hệ thống:", error);
  }
})();
