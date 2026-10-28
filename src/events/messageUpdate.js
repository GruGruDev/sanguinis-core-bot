const { sendLog } = require("../utils/logger");

module.exports = {
  name: "messageUpdate",
  async execute(oldMessage, newMessage) {
    if (!oldMessage.guild || oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    await sendLog(oldMessage.guild, "MESSAGE", {
      title: "✏️ TIN NHẮN ĐÃ BỊ CHỈNH SỬA",
      color: "#f59e0b",
      description: `Tin nhắn của <@${oldMessage.author.id}> tại kênh <#${oldMessage.channel.id}> vừa được sửa. [Xem tin nhắn](${newMessage.url})`,
      fields: [
        {
          name: "📝 Trước khi sửa",
          value: (oldMessage.content || "*(Trống)*").substring(0, 1024),
        },
        {
          name: "✨ Sau khi sửa",
          value: (newMessage.content || "*(Trống)*").substring(0, 1024),
        },
      ],
      thumbnail: oldMessage.author.displayAvatarURL(),
    });
  },
};
