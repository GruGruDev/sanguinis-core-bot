const { sendLog } = require("../utils/logger");

module.exports = {
  name: "guildBanAdd",
  async execute(ban) {
    await sendLog(ban.guild, "MODERATION", {
      title: "⛔ THÀNH VIÊN BỊ BAN KHỎI SERVER",
      color: "#dc2626",
      description: `Tài khoản <@${ban.user.id}> đã bị cấm (Ban) khỏi máy chủ.`,
      fields: [
        {
          name: "👤 Người bị Ban",
          value: `${ban.user.tag} (\`${ban.user.id}\`)`,
          inline: true,
        },
        {
          name: "📝 Lý do",
          value: ban.reason || "*(Không ghi lý do)*",
          inline: true,
        },
      ],
      thumbnail: ban.user.displayAvatarURL(),
    });
  },
};
