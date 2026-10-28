const { sendLog } = require("../utils/logger");

module.exports = {
  name: "channelDelete",
  async execute(channel) {
    if (!channel.guild) return;

    await sendLog(channel.guild, "CHANNEL", {
      title: "🗑️ KÊNH ĐÃ BỊ XÓA",
      color: "#ef4444",
      description: `Kênh **#${channel.name}** (\`${channel.id}\`) vừa bị xóa khỏi máy chủ.`,
    });
  },
};
