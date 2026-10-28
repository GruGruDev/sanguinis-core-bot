const { Events, EmbedBuilder } = require("discord.js");
const db = require("../database/client");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, bot) {
    // 1. XỬ LÝ NÚT BẤM VERIFY TẠI 📜｜quy-định
    if (
      interaction.isButton() &&
      interaction.customId === "btn_verify_member"
    ) {
      await interaction.deferReply({ ephemeral: true });

      const database = db.getDb();
      const config = await database.get(
        "SELECT * FROM guild_config WHERE guild_id = ?",
        [interaction.guild.id],
      );

      if (!config || !config.verify_role_id) {
        return interaction.editReply({
          content: "❌ Máy chủ chưa thiết lập Role Verify trên Dashboard!",
        });
      }

      const verifyRole = interaction.guild.roles.cache.get(
        config.verify_role_id,
      );
      if (!verifyRole) {
        return interaction.editReply({
          content: "❌ Không tìm thấy Role Verify trong máy chủ!",
        });
      }

      if (interaction.member.roles.cache.has(verifyRole.id)) {
        return interaction.editReply({
          content: "⚠️ Bạn đã hoàn tất xác minh từ trước rồi!",
        });
      }

      try {
        // Cấp Role Verify chính thức (Member)
        await interaction.member.roles.add(verifyRole);

        // Gỡ các Role tạm khi mới join (Ví dụ: @Outsider)
        if (config.auto_roles) {
          const autoRoleIds = config.auto_roles
            .split(",")
            .map((r) => r.trim())
            .filter((r) => r);
          for (const roleId of autoRoleIds) {
            if (interaction.member.roles.cache.has(roleId)) {
              await interaction.member.roles.remove(roleId).catch(() => {});
            }
          }
        }

        return interaction.editReply({
          content: `✅ **Xác minh thành công!** Bạn đã được nâng cấp thành <@&${verifyRole.id}>.`,
        });
      } catch (err) {
        console.error("[VERIFY_ERROR]", err);
        return interaction.editReply({
          content:
            "❌ Bot thiếu quyền quản lý Role! Hãy kéo vị trí Role của Bot lên cao hơn.",
        });
      }
    }

    // 2. XỬ LÝ NÚT BẤM THAM GIA GIVEAWAY
    if (
      interaction.isButton() &&
      interaction.customId === "btn_join_giveaway"
    ) {
      await interaction.deferReply({ ephemeral: true });

      const database = db.getDb();
      const giveaway = await database.get(
        "SELECT * FROM giveaways WHERE message_id = ?",
        [interaction.message.id],
      );

      if (!giveaway || giveaway.ended === 1) {
        return interaction.editReply({
          content: "❌ Sự kiện Giveaway này đã kết thúc!",
        });
      }

      const participant = await database.get(
        "SELECT * FROM giveaway_participants WHERE message_id = ? AND user_id = ?",
        [interaction.message.id, interaction.user.id],
      );

      if (participant) {
        await database.run(
          "DELETE FROM giveaway_participants WHERE message_id = ? AND user_id = ?",
          [interaction.message.id, interaction.user.id],
        );

        const countData = await database.get(
          "SELECT COUNT(*) as total FROM giveaway_participants WHERE message_id = ?",
          [interaction.message.id],
        );

        const oldEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
        oldEmbed.setFooter({
          text: `Sanguinis Event System • ${countData.total} Lượt Tham Gia`,
        });
        await interaction.message.edit({ embeds: [oldEmbed] });

        return interaction.editReply({
          content: "🔴 Bạn đã **hủy tham gia** sự kiện Giveaway này.",
        });
      }

      if (
        giveaway.required_role_id &&
        !interaction.member.roles.cache.has(giveaway.required_role_id)
      ) {
        return interaction.editReply({
          content: `❌ Bạn cần phải có Role <@&${giveaway.required_role_id}> để tham gia Giveaway này!`,
        });
      }

      if (giveaway.min_account_age > 0) {
        const accountAgeDays =
          (Date.now() - interaction.user.createdTimestamp) /
          (1000 * 60 * 60 * 24);
        if (accountAgeDays < giveaway.min_account_age) {
          return interaction.editReply({
            content: `❌ Tài khoản Discord của bạn phải tạo tối thiểu **${giveaway.min_account_age} ngày**!`,
          });
        }
      }

      if (giveaway.min_server_age > 0) {
        const joinedAgeHours =
          (Date.now() - interaction.member.joinedTimestamp) / (1000 * 60 * 60);
        if (joinedAgeHours < giveaway.min_server_age) {
          return interaction.editReply({
            content: `❌ Bạn phải tham gia máy chủ này tối thiểu **${giveaway.min_server_age} giờ**!`,
          });
        }
      }

      if (giveaway.min_level > 0) {
        const userLevelData = await database.get(
          "SELECT level FROM users WHERE id = ?",
          [interaction.user.id],
        );
        const userLevel = userLevelData ? userLevelData.level : 0;
        if (userLevel < giveaway.min_level) {
          return interaction.editReply({
            content: `❌ Bạn phải đạt tối thiểu **Level ${giveaway.min_level}** trong máy chủ!`,
          });
        }
      }

      if (giveaway.min_messages > 0) {
        let userMessageCount = 0;
        try {
          const userStats = await database.get(
            "SELECT message_count FROM user_stats WHERE guild_id = ? AND user_id = ?",
            [interaction.guild.id, interaction.user.id],
          );
          userMessageCount = userStats
            ? Number(userStats.message_count) || 0
            : 0;
        } catch (err) {}

        if (userMessageCount < giveaway.min_messages) {
          return interaction.editReply({
            content: `❌ Bạn phải có tối thiểu **${giveaway.min_messages} tin nhắn** trong máy chủ để tham gia Giveaway này!`,
          });
        }
      }

      await database.run(
        "INSERT INTO giveaway_participants (message_id, user_id) VALUES (?, ?)",
        [interaction.message.id, interaction.user.id],
      );

      const countData = await database.get(
        "SELECT COUNT(*) as total FROM giveaway_participants WHERE message_id = ?",
        [interaction.message.id],
      );

      const oldEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
      oldEmbed.setFooter({
        text: `Sanguinis Event System • ${countData.total} Lượt Tham Gia`,
      });
      await interaction.message.edit({ embeds: [oldEmbed] });

      return interaction.editReply({
        content:
          "🎉 Bạn đã **đăng ký tham gia** Giveaway thành công! Chúc bạn may mắn.",
      });
    }

    // 3. XỬ LÝ SLASH COMMANDS
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, bot);
    } catch (error) {
      console.error(
        `[EXECUTE_ERROR] Lỗi lệnh /${interaction.commandName}:`,
        error,
      );
    }
  },
};
