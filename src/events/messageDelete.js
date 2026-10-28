const { sendLog } = require("../utils/logger");

module.exports = {
  name: "messageDelete",
  async execute(message) {
    if (!message.guild || message.author?.bot) return;

    const content = message.content
      ? message.content
      : "*(Tin nhắn không chứa văn bản/chỉ chứa ảnh/embed)*";

    await sendLog(message.guild, "MESSAGE", {
      title: "🗑️ TIN NHẮN ĐÃ BỊ XÓA",
      color: "#ef4444",
      description: `Tin nhắn của <@${message.author.id}> bị xóa tại kênh <#${message.channel.id}>.`,
      fields: [
        {
          name: "👤 Người gửi",
          value: `${message.author.tag} (\`${message.author.id}\`)`,
          inline: true,
        },
        { name: "📌 Kênh", value: `<#${message.channel.id}>`, inline: true },
        { name: "💬 Nội dung tin nhắn", value: content.substring(0, 1024) },
      ],
      thumbnail: message.author.displayAvatarURL(),
    });
  },
};
