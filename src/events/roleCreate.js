const { sendLog } = require("../utils/logger");

module.exports = {
  name: "roleCreate",
  async execute(role) {
    if (!role.guild) return;

    await sendLog(role.guild, "ROLE", {
      title: "🎭 ROLE MỚI ĐÃ ĐƯỢC TẠO",
      color: "#22c55e",
      description: `Role **${role.name}** (<@&${role.id}>) vừa được khởi tạo.`,
      fields: [
        { name: "🏷️ Tên Role", value: role.name, inline: true },
        { name: "🆔 Role ID", value: `\`${role.id}\``, inline: true },
        { name: "🎨 Mã Màu Hex", value: `\`${role.hexColor}\``, inline: true },
      ],
    });
  },
};
