const { sendLog } = require("../utils/logger");

module.exports = {
  name: "roleDelete",
  async execute(role) {
    if (!role.guild) return;

    await sendLog(role.guild, "ROLE", {
      title: "🗑️ ROLE ĐÃ BỊ XÓA",
      color: "#ef4444",
      description: `Role **${role.name}** (\`${role.id}\`) vừa bị xóa khỏi máy chủ.`,
      fields: [
        { name: "🏷️ Tên Role Đã Xóa", value: role.name, inline: true },
        { name: "🎨 Mã Màu Cũ", value: `\`${role.hexColor}\``, inline: true },
      ],
    });
  },
};
