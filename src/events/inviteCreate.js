const { sendLog } = require("../utils/logger");
const { getCache } = require("../utils/inviteTracker");

module.exports = {
  name: "inviteCreate",
  async execute(invite, client) {
    if (!invite.guild) return;

    // Cập nhật cache invite để theo dõi lượt dùng
    if (client) {
      try {
        const cache = getCache(client);
        const map = cache.get(invite.guild.id) || new Map();
        map.set(invite.code, invite.uses || 0);
        cache.set(invite.guild.id, map);
      } catch (_) {}
    }

    await sendLog(invite.guild, "INVITE", {
      title: "🔗 LINK MỜI MỚI ĐÃ ĐƯỢC TẠO",
      color: "#3b82f6",
      description: `Một liên kết mời tham gia máy chủ vừa được khởi tạo bởi <@${invite.inviter?.id}>.`,
      fields: [
        { name: "🔑 Mã Link", value: `\`${invite.code}\``, inline: true },
        {
          name: "📌 Kênh Đích",
          value: invite.channel ? `<#${invite.channel.id}>` : "N/A",
          inline: true,
        },
        {
          name: "⏱️ Hạn Dùng",
          value:
            invite.maxAge === 0 ? "Vĩnh viễn" : `${invite.maxAge / 3600} giờ`,
          inline: true,
        },
        {
          name: "👥 Lượt Dùng Tối Đa",
          value:
            invite.maxUses === 0 ? "Không giới hạn" : `${invite.maxUses} lượt`,
          inline: true,
        },
      ],
    });
  },
};