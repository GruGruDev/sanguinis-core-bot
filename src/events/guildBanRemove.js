const { sendLog } = require("../utils/logger");

module.exports = {
  name: "guildBanRemove",
  async execute(ban) {
    await sendLog(ban.guild, "MODERATION", {
      title: "🔓 THÀNH VIÊN ĐƯỢC ÂN XÁ (UNBAN)",
      color: "#22c55e",
      description: `Tài khoản <@${ban.user.id}> (\`${ban.user.id}\`) vừa được gỡ cấm (Unban).`,
      thumbnail: ban.user.displayAvatarURL(),
    });
  },
};
