const { sendLog } = require("../utils/logger");
const { getCache } = require("../utils/inviteTracker");

module.exports = {
  name: "inviteDelete",
  async execute(invite, client) {
    if (!invite || !invite.guild) return;

    // Xóa khỏi cache
    if (client) {
      try {
        const cache = getCache(client);
        const map = cache.get(invite.guild.id);
        if (map) map.delete(invite.code);
      } catch (_) {}
    }

    await sendLog(invite.guild, "INVITE", {
      title: "🗑️ MÃ MỜI ĐÃ BỊ THU HỒI / XÓA",
      color: "#ef4444",
      description: `Mã mời \`${invite.code}\` vừa bị xóa hoặc hết hạn sử dụng.`,
      fields: [
        { name: "🔑 Mã Link", value: `\`${invite.code}\``, inline: true },
        {
          name: "👤 Người tạo",
          value: invite.inviter ? `<@${invite.inviter.id}>` : "Không rõ",
          inline: true,
        },
        {
          name: "📌 Kênh Đích",
          value: invite.channel ? `<#${invite.channel.id}>` : "N/A",
          inline: true,
        },
        {
          name: "👥 Lượt Dùng Tối Đa",
          value:
            invite.maxUses === 0 ? "Không giới hạn" : `${invite.maxUses} lượt`,
          inline: true,
        },
        {
          name: "⏱️ Hạn Dùng",
          value:
            invite.maxAge === 0 ? "Vĩnh viễn" : `${invite.maxAge / 3600} giờ`,
          inline: true,
        },
      ],
    });
  },
};