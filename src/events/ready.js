const { Events } = require("discord.js");
const { cacheAllGuildInvites } = require("../utils/inviteTracker");

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    try {
      await cacheAllGuildInvites(client);
      console.log("[INVITE] Đã cache danh sách mã mời của tất cả máy chủ.");
    } catch (err) {
      console.error("[READY_INVITE_CACHE_ERROR]", err);
    }
  },
};