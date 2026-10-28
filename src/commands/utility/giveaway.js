const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");
const db = require("../../database/client");

// Hàm đổi định dạng thời gian ngắn (ví dụ: 1d, 2h, 30m) ra miligiây
function parseDuration(str) {
  const regex = /^(\d+)([smhd])$/i;
  const match = str.match(regex);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case "s":
      return num * 1000;
    case "m":
      return num * 60 * 1000;
    case "h":
      return num * 60 * 60 * 1000;
    case "d":
      return num * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Khởi tạo sự kiện Giveaway phát quà")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption((opt) =>
      opt
        .setName("prize")
        .setDescription("Phần thưởng Giveaway (Ví dụ: VIP Role, 100.000 VNĐ)")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("duration")
        .setDescription("Thời gian diễn ra (Ví dụ: 10m, 2h, 1d)")
        .setRequired(true),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("winners")
        .setDescription("Số lượng người may mắn thắng giải (Mặc định: 1)")
        .setRequired(false),
    ),

  async execute(interaction) {
    const prize = interaction.options.getString("prize");
    const durationStr = interaction.options.getString("duration");
    const winnersCount = interaction.options.getInteger("winners") || 1;

    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return interaction.reply({
        content:
          "❌ Định dạng thời gian không hợp lệ! Hãy dùng dạng `10m` (10 phút), `2h` (2 giờ), `1d` (1 ngày).",
        ephemeral: true,
      });
    }

    const endTime = Date.now() + durationMs;
    const endTimestamp = Math.floor(endTime / 1000);

    const embed = new EmbedBuilder()
      .setTitle(`🎉 GIVEAWAY: ${prize.toUpperCase()}`)
      .setColor("#800020")
      .setDescription(
        `Nhấn vào nút **"🎉 Tham Gia"** bên dưới để tham gia sự kiện phát quà!\n\n• **Người tổ chức:** ${interaction.user}\n• **Số người chiến thắng:** \`${winnersCount}\`\n• **Kết thúc vào:** <t:${endTimestamp}:R> (<t:${endTimestamp}:f>)`,
      )
      .setFooter({ text: "Sanguinis Event System • 0 Lượt Tham Gia" })
      .setTimestamp(endTime);

    const joinBtn = new ButtonBuilder()
      .setCustomId("btn_join_giveaway")
      .setLabel("Tham Gia")
      .setEmoji("🎉")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(joinBtn);

    await interaction.reply({
      content: "🎁 Đã khởi tạo Giveaway thành công!",
      ephemeral: true,
    });
    const msg = await interaction.channel.send({
      embeds: [embed],
      components: [row],
    });

    // Lưu vào CSDL SQLite
    const database = db.getDb();
    await database.run(
      `INSERT INTO giveaways (message_id, channel_id, guild_id, prize, winners_count, end_time, hosted_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        msg.id,
        interaction.channel.id,
        interaction.guild.id,
        prize,
        winnersCount,
        endTime,
        interaction.user.id,
      ],
    );
  },
};
