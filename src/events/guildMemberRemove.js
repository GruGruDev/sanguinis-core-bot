const { Events, EmbedBuilder } = require("discord.js");
const db = require("../database/client");
const { sendLog } = require("../utils/logger");

const DEFAULT_GOODBYE_GIF =
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYjEyaXlmYm1qcGcwNmFneXNjamZndjY0NHl4bHZjeGs2Z3JjNjUwayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Ru9sjtZ09XOEg/giphy.gif";

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member, bot) {
    const database = db.getDb();
    if (!database) return;

    const config = await database.get(
      "SELECT * FROM guild_config WHERE guild_id = ?",
      [member.guild.id],
    );
    if (!config) return;

    // 🔴 1. CẬP NHẬT KÊNH VOICE ĐẾM MEMBER KHI CÓ NGƯỜI LEAVE
    if (config.member_count_channel_id) {
      const vc = member.guild.channels.cache.get(
        config.member_count_channel_id,
      );
      if (vc) {
        const newName = `👥 Thành Viên: ${member.guild.memberCount.toLocaleString("vi-VN")}`;
        if (vc.name !== newName) {
          await vc.setName(newName).catch(() => {});
        }
      }
    }

    // 🔴 2. GỬI DM KHI RỜI SERVER (DM ON LEAVE)
    if (config.dm_leave_enabled && config.dm_leave_message) {
      let dmText = config.dm_leave_message
        .replace(/{user\.tag}/g, `<@${member.id}>`)
        .replace(/{user\.username}/g, member.user.username)
        .replace(/{user}/g, `<@${member.id}>`)
        .replace(/{guild}/g, member.guild.name);

      await member.send(dmText).catch(() => {});
    }

    // 🔴 3. GỬI TIN NHẮN TẠM BIỆT CÔNG KHAI (Xử lý tên hiển thị chuẩn đẹp)
    if (config.leave_channel_id) {
      const channel = member.guild.channels.cache.get(config.leave_channel_id);
      if (channel) {
        let bodyText = (
          config.leave_message || "**{user}** đã rời khỏi máy chủ {guild}."
        )
          .replace(/{user\.tag}/g, `**${member.user.username}**`)
          .replace(/{user\.username}/g, `**${member.user.username}**`)
          .replace(/{user}/g, `**${member.user.username}**`)
          .replace(/{guild}/g, member.guild.name);

        const userAvatar = member.user.displayAvatarURL({
          extension: "png",
          size: 1024,
        });
        const bannerUrl =
          config.leave_banner_url && config.leave_banner_url.trim() !== ""
            ? config.leave_banner_url.trim()
            : DEFAULT_GOODBYE_GIF;

        const embed = new EmbedBuilder()
          .setTitle(`🚪 TẠM BIỆT, ${member.user.username.toUpperCase()}`)
          .setColor("#708090")
          .setThumbnail(userAvatar)
          .setDescription(bodyText)
          .setImage(bannerUrl)
          .setFooter({ text: `ID Thành Viên: ${member.id}` })
          .setTimestamp();

        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    // 🔴 4. MEMBER LOG (Đồng bộ với hệ thống Logger Security Logs)
    await sendLog(member.guild, "MEMBER", {
      title: "📤 THÀNH VIÊN ĐÃ RỜI MÁY CHỦ",
      color: "#ef4444",
      description: `Thành viên **${member.user.username}** (<@${member.id}>) vừa rời khỏi máy chủ.`,
      fields: [
        { name: "👤 User Tag", value: member.user.tag, inline: true },
        { name: "🆔 User ID", value: `\`${member.id}\``, inline: true },
        {
          name: "👥 Quân Số Còn Lại",
          value: `\`${member.guild.memberCount.toLocaleString("vi-VN")}\` người`,
          inline: true,
        },
      ],
      thumbnail: member.user.displayAvatarURL(),
    });

    // Giữ tương thích với Kênh Member Log riêng lẻ nếu được gán
    if (
      config.member_log_channel_id &&
      config.member_log_channel_id !== config.member_log_channel_id
    ) {
      const logChannel = member.guild.channels.cache.get(
        config.member_log_channel_id,
      );
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle("📤 [NHẬT KÝ] THÀNH VIÊN RỜI MÁY CHỦ")
          .setColor("#FF0000")
          .setThumbnail(member.user.displayAvatarURL())
          .addFields(
            { name: "• Tài khoản", value: `${member.user.tag}`, inline: true },
            { name: "• ID Discord", value: `\`${member.id}\``, inline: true },
            {
              name: "• Quân số",
              value: `Còn lại **${member.guild.memberCount.toLocaleString("vi-VN")}** người`,
              inline: false,
            },
          )
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
      }
    }
  },
};
