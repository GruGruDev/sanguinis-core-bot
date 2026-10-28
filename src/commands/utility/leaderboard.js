const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../../database/client");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("top") // Đổi tên thành /top để không bị trùng với Arcane/Peak Bot
    .setDescription("Xem Bảng Xếp Hạng Top 10 Cấp Độ & XP trên Server"),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const database = db.getDb();
      const topUsers = await database.all(
        "SELECT * FROM users ORDER BY xp DESC LIMIT 10",
      );

      if (!topUsers || topUsers.length === 0) {
        return interaction.editReply({
          content: "❌ Chưa có dữ liệu bảng xếp hạng!",
        });
      }

      let description = "";
      const medals = ["🥇", "🥈", "🥉"];

      for (let i = 0; i < topUsers.length; i++) {
        const u = topUsers[i];
        const medal = medals[i] || `\`#${i + 1}\``;
        description += `${medal} <@${u.id}> • **Level ${u.level || 1}** (${(u.xp || 0).toLocaleString("vi-VN")} XP)\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle("🏆 BẢNG XẾP HẠNG TOP LEVEL SANGUINIS")
        .setColor("#FFD700")
        .setDescription(description)
        .setFooter({ text: `Yêu cầu bởi ${interaction.user.username}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("[LEADERBOARD_ERROR]", error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: "❌ Có lỗi xảy ra khi lấy dữ liệu Bảng Xếp Hạng!",
        });
      } else {
        await interaction.reply({
          content: "❌ Có lỗi xảy ra khi lấy dữ liệu Bảng Xếp Hạng!",
          ephemeral: true,
        });
      }
    }
  },
};
