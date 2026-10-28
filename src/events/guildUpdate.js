const { sendLog } = require("../utils/logger");

module.exports = {
  name: "guildUpdate",
  async execute(oldGuild, newGuild) {
    const changes = [];

    if (oldGuild.name !== newGuild.name) {
      changes.push(
        `• **Tên Server:** \`${oldGuild.name}\` ➡️ \`${newGuild.name}\``,
      );
    }
    if (oldGuild.icon !== newGuild.icon) {
      changes.push(
        `• **Icon Server:** [Ảnh Cũ](${oldGuild.iconURL()}) ➡️ [Ảnh Mới](${newGuild.iconURL()})`,
      );
    }
    if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
      changes.push(
        `• **Vanity URL:** \`${oldGuild.vanityURLCode || "Không có"}\` ➡️ \`${newGuild.vanityURLCode || "Không có"}\``,
      );
    }

    if (changes.length === 0) return;

    await sendLog(newGuild, "SERVER", {
      title: "📜 THAY ĐỔI CẤU HÌNH MÁY CHỦ",
      color: "#f59e0b",
      description: `Cấu hình máy chủ **${newGuild.name}** vừa được cập nhật:`,
      fields: [{ name: "📋 Chi Tiết Thay Đổi", value: changes.join("\n") }],
      thumbnail: newGuild.iconURL(),
    });
  },
};
