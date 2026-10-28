const { sendLog } = require("../utils/logger");

module.exports = {
  name: "channelCreate",
  async execute(channel) {
    if (!channel.guild) return;

    const typeNames = {
      0: "Kênh Chat (Text)",
      2: "Kênh Voice",
      4: "Danh Mục (Category)",
      5: "Kênh Thông Báo",
    };

    await sendLog(channel.guild, "CHANNEL", {
      title: "📁 KÊNH MỚI ĐÃ ĐƯỢC TẠO",
      color: "#22c55e",
      description: `Kênh <#${channel.id}> vừa được tạo trong máy chủ.`,
      fields: [
        { name: "📌 Tên Kênh", value: channel.name, inline: true },
        {
          name: "📂 Loại Kênh",
          value: typeNames[channel.type] || `Type ${channel.type}`,
          inline: true,
        },
        { name: "🆔 Channel ID", value: `\`${channel.id}\``, inline: true },
      ],
    });
  },
};
