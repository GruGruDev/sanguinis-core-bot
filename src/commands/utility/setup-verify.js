const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-verify")
    .setDescription("Tạo khung xác minh (Verify Button) cho máy chủ")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle("🛡️ XÁC MINH THÀNH VIÊN • SANGUINIS CORE")
      .setColor("#800020")
      .setDescription(
        'Chào mừng bạn đến với máy chủ!\n\nNhấn vào nút **"✅ Xác Minh"** bên dưới để hoàn tất xác minh và mở khóa các kênh trong server.',
      )
      .setFooter({ text: "Sanguinis Verification System" })
      .setTimestamp();

    const verifyBtn = new ButtonBuilder()
      .setCustomId("btn_verify_member")
      .setLabel("Xác Minh")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(verifyBtn);

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({
      content: "✅ Đã khởi tạo bảng Xác Minh thành công!",
      ephemeral: true,
    });
  },
};
