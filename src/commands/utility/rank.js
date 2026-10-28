const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../../database/client");

function getXpForLevel(level) {
  return 5 * level ** 2 + 50 * level + 100;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Xem cấp độ và XP cá nhân hoặc của người khác")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Người dùng muốn kiểm tra")
        .setRequired(false),
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const targetUser =
        interaction.options.getUser("user") || interaction.user;
      const database = db.getDb();

      let userData = await database.get("SELECT * FROM users WHERE id = ?", [
        targetUser.id,
      ]);

      if (!userData) {
        await database.run(
          "INSERT INTO users (id, balance, xp, level, last_xp_time) VALUES (?, 0, 0, 1, 0)",
          [targetUser.id],
        );
        userData = { id: targetUser.id, balance: 0, xp: 0, level: 1 };
      }

      const allUsers = await database.all(
        "SELECT id, xp FROM users ORDER BY xp DESC",
      );
      let userRank = allUsers.findIndex((u) => u.id === targetUser.id) + 1;
      if (userRank === 0) userRank = allUsers.length || 1;

      const currentLevel = userData.level || 1;
      const currentXp = userData.xp || 0;
      const nextLevelXp = getXpForLevel(currentLevel);

      // Lấy avatar thực tế từ Guild Member hoặc User
      const avatarUrl = targetUser.displayAvatarURL({
        dynamic: true,
        size: 512,
      });

      const embed = new EmbedBuilder()
        .setTitle(`📊 THÔNG TIN LEVEL • ${targetUser.username.toUpperCase()}`)
        .setColor("#800020")
        .setThumbnail(avatarUrl)
        .addFields(
          { name: "🏆 Thứ Hạng", value: `#${userRank}`, inline: true },
          {
            name: "⭐ Cấp Độ (Level)",
            value: `Level ${currentLevel}`,
            inline: true,
          },
          {
            name: "✨ XP Hiện Tại",
            value: `${currentXp.toLocaleString("vi-VN")} /${nextLevelXp.toLocaleString("vi-VN")} XP`,
            inline: true,
          },
        )
        .setFooter({ text: "Sanguinis Core • Arcane Leveling System" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("[RANK_COMMAND_ERROR]", error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: "❌ Có lỗi xảy ra khi lấy thông tin Rank!",
        });
      } else {
        await interaction.reply({
          content: "❌ Có lỗi xảy ra khi lấy thông tin Rank!",
          ephemeral: true,
        });
      }
    }
  },
};
