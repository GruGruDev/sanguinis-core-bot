const { sendLog } = require("../utils/logger");

module.exports = {
  name: "inviteCreate",
  async execute(invite) {
    if (!invite.guild) return;

    await sendLog(invite.guild, "INVITE", {
      title: "🔗 LINK MỜI MỚI ĐÃ ĐƯỢC TẠO",
      color: "#3b82f6",
      description: `Một liên kết mời tham gia máy chủ vừa được khởi tạo bởi <@${invite.inviter?.id}>.`,
      fields: [
        { name: "🔑 Mã Link", value: `\`${invite.code}\``, inline: true },
        {
          name: "📌 Kênh Đích",
          value: `<#${invite.channel?.id}>`,
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
