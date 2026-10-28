const { Events } = require("discord.js");
const { sendLog } = require("../utils/logger");

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    const guild = newState.guild || oldState.guild;
    const member = newState.member || oldState.member;
    if (!guild || !member || member.user.bot) return;

    // 1. Vào kênh thoại
    if (!oldState.channelId && newState.channelId) {
      const ch =
        newState.channel ||
        (await guild.channels.fetch(newState.channelId).catch(() => null));
      return sendLog(guild, "VOICE", {
        title: "🔊 THÀNH VIÊN VÀO KÊNH VOICE",
        color: "#22c55e",
        description: `<@${member.id}> vừa tham gia kênh thoại **#${ch ? ch.name : "kênh-voice"}**.`,
        thumbnail: member.user.displayAvatarURL(),
      });
    }

    // 2. Rời kênh thoại
    if (oldState.channelId && !newState.channelId) {
      const ch =
        oldState.channel ||
        (await guild.channels.fetch(oldState.channelId).catch(() => null));
      return sendLog(guild, "VOICE", {
        title: "🔇 THÀNH VIÊN RỜI KÊNH VOICE",
        color: "#ef4444",
        description: `<@${member.id}> vừa rời khỏi kênh thoại **#${ch ? ch.name : "kênh-voice"}**.`,
        thumbnail: member.user.displayAvatarURL(),
      });
    }

    // 3. Chuyển kênh thoại
    if (
      oldState.channelId &&
      newState.channelId &&
      oldState.channelId !== newState.channelId
    ) {
      const oldCh =
        oldState.channel ||
        (await guild.channels.fetch(oldState.channelId).catch(() => null));
      const newCh =
        newState.channel ||
        (await guild.channels.fetch(newState.channelId).catch(() => null));
      return sendLog(guild, "VOICE", {
        title: "🔄 THÀNH VIÊN CHUYỂN KÊNH VOICE",
        color: "#3b82f6",
        description: `<@${member.id}> đã chuyển từ **#${oldCh ? oldCh.name : "kênh-cũ"}** ➡️ **#${newCh ? newCh.name : "kênh-mới"}**.`,
        thumbnail: member.user.displayAvatarURL(),
      });
    }
  },
};
