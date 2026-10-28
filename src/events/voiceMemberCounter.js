const { Events } = require("discord.js");
const db = require("../database/client");

async function updateMemberCountChannel(guild) {
  try {
    const database = db.getDb();
    if (!database) return;

    const config = await database.get(
      "SELECT member_count_channel_id FROM guild_config WHERE guild_id = ?",
      [guild.id],
    );
    if (!config || !config.member_count_channel_id) return;

    const channel = guild.channels.cache.get(config.member_count_channel_id);
    if (!channel) return;

    // Tổng số quân số thực tế trong máy chủ
    const memberCount = guild.memberCount;
    const newName = `👥 Thành Viên: ${memberCount.toLocaleString("vi-VN")}`;

    // Chỉ đổi tên nếu tên cũ khác tên mới để tránh spam rate-limit API Discord
    if (channel.name !== newName) {
      await channel.setName(newName);
      console.log(
        `[MEMBER_COUNTER] Đã đổi tên kênh Voice đếm quân số server ${guild.name}: "${newName}"`,
      );
    }
  } catch (err) {
    console.error("[MEMBER_COUNTER_ERROR]", err);
  }
}

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    // Cập nhật quân số khi có người vừa join
    await updateMemberCountChannel(member.guild);
  },
};
