const { sendLog, LOG_COLORS } = require("../utils/logger");

module.exports = {
  name: "roleUpdate",
  async execute(oldRole, newRole) {
    if (!oldRole.guild) return;

    const changes = [];
    if (oldRole.name !== newRole.name) {
      changes.push(`• **Tên:** \`${oldRole.name}\` ➡️ \`${newRole.name}\``);
    }
    if (oldRole.hexColor !== newRole.hexColor) {
      changes.push(
        `• **Màu sắc:** \`${oldRole.hexColor}\` ➡️ \`${newRole.hexColor}\``,
      );
    }

    if (changes.length === 0) return;

    await sendLog(oldRole.guild, "ROLE", {
      title: "🎭 [NHẬT KÝ VAI TRÒ] THAY ĐỔI CẤU HÌNH ROLE",
      color: LOG_COLORS.MUTATE, // #8b5cf6 Tím Arcane
      description: `Role <@&${newRole.id}> vừa được cập nhật thông số:`,
      fields: [{ name: "📋 Chi Tiết Thay Đổi", value: changes.join("\n") }],
    });
  },
};
