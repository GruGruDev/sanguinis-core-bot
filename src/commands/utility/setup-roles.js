const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-roles")
    .setDescription("Tạo menu tự chọn Vai trò (Self-Roles)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle("🎮 CHỌN VAI TRÒ CỦA BẠN")
      .setColor("#1f293d")
      .setDescription(
        "Sử dụng menu thả xuống bên dưới để nhận thông báo cho các tựa game bạn yêu thích.",
      );

    const select = new StringSelectMenuBuilder()
      .setCustomId("self_roles_select")
      .setPlaceholder("Lựa chọn tựa game...")
      .setMinValues(0)
      .setMaxValues(3) // Cho phép chọn tối đa 3
      .addOptions(
        { label: "Liên Minh Huyền Thoại", value: "role_id_lmht", emoji: "⚔️" },
        { label: "Valorant", value: "role_id_valo", emoji: "🔫" },
        { label: "CS:GO 2", value: "role_id_csgo", emoji: "💣" },
      );

    const row = new ActionRowBuilder().addComponents(select);

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({
      content: "Đã tạo menu chọn role thành công!",
      ephemeral: true,
    });
  },
};
