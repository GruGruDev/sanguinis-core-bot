const { Events, EmbedBuilder } = require("discord.js");
const db = require("../database/client");
const { sendLog } = require("../utils/logger");

const DEFAULT_WELCOME_GIF =
  "https://media.giphy.com/media/NbdKvBAIga3KxkAGeH/giphy.gif";

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member, bot) {
    const database = db.getDb();
    if (!database) return;

    const config = await database.get(
      "SELECT * FROM guild_config WHERE guild_id = ?",
      [member.guild.id],
    );
    if (!config) return;

    // 🔴 1. KIỂM TRA TUỔI TÀI KHOẢN (ANTI-ALT / ANTI-RAID)
    const minAgeDays = Number(config.account_age_days) || 0;
    if (minAgeDays > 0) {
      const createdTimestamp = member.user.createdTimestamp;
      const accountAgeDays =
        (Date.now() - createdTimestamp) / (1000 * 60 * 60 * 24);

      if (accountAgeDays < minAgeDays) {
        console.log(
          `[ANTI-ALT] Đã kick ${member.user.tag} (Tuổi acc: ${accountAgeDays.toFixed(1)} ngày < ${minAgeDays} ngày)`,
        );

        // Gửi Log Báo Động sang kênh anti-raid-log
        await sendLog(member.guild, "ANTI_RAID", {
          title: "🥖 PHÁT HIỆN ACC CLONE (ANTI-RAID)",
          color: "#dc2626",
          description: `Thành viên <@${member.id}> gia nhập có tuổi tài khoản chỉ **${accountAgeDays.toFixed(1)} ngày** (Yêu cầu tối thiểu: **${minAgeDays} ngày**). Bot đã tự động KICK!`,
          fields: [
            {
              name: "👤 Tài khoản",
              value: `${member.user.tag} (\`${member.id}\`)`,
              inline: true,
            },
            {
              name: "📅 Ngày tạo Acc",
              value: `<t:${Math.floor(createdTimestamp / 1000)}:R>`,
              inline: true,
            },
          ],
          thumbnail: member.user.displayAvatarURL(),
        });

        await member
          .send(
            `❌ Tài khoản của bạn không đủ điều kiện tham gia **${member.guild.name}** (Yêu cầu tuổi tài khoản tối thiểu: ${minAgeDays} ngày).`,
          )
          .catch(() => {});

        await member
          .kick("Tài khoản chưa đủ tuổi tối thiểu (Anti-Alt Check)")
          .catch(() => {});
        return; // Dừng các bước tiếp theo
      }
    }

    // 🔴 2. GỬI MEMBER LOG (Kênh member-log cho BQL)
    await sendLog(member.guild, "MEMBER", {
      title: "📥 THÀNH VIÊN MỚI GIA NHẬP",
      color: "#22c55e",
      description: `<@${member.id}> vừa tham gia máy chủ **${member.guild.name}**.`,
      fields: [
        { name: "👤 User Tag", value: member.user.tag, inline: true },
        { name: "🆔 User ID", value: `\`${member.id}\``, inline: true },
        {
          name: "👥 Tổng Quân Số",
          value: `\`${member.guild.memberCount}\` thành viên`,
          inline: true,
        },
      ],
      thumbnail: member.user.displayAvatarURL(),
    });

    // 🔴 3. TỰ ĐỘNG GÁN ROLE BAN ĐẦU (Ví dụ: @Outsider)
    if (config.auto_roles) {
      const autoRoleIds = config.auto_roles
        .split(",")
        .map((r) => r.trim())
        .filter((r) => r);
      for (const roleId of autoRoleIds) {
        const role = member.guild.roles.cache.get(roleId);
        if (role) {
          await member.roles
            .add(role)
            .catch((err) =>
              console.error(
                `[AUTOROLE_ERROR] Không thể thêm role ${roleId}:`,
                err,
              ),
            );
        }
      }
    }

    // 🔴 4. GỬI TIN NHẮN CHÀO MỪNG CÔNG KHAI
    if (config.welcome_channel_id) {
      const channel = member.guild.channels.cache.get(
        config.welcome_channel_id,
      );
      if (channel) {
        let bodyText = (
          config.welcome_message || "Chào mừng {user} đã gia nhập {guild} 🩸!"
        )
          .replace(/{user}/g, `${member}`)
          .replace(/{guild}/g, member.guild.name);

        const bannerUrl =
          config.welcome_banner_url && config.welcome_banner_url.trim() !== ""
            ? config.welcome_banner_url.trim()
            : DEFAULT_WELCOME_GIF;

        const embed = new EmbedBuilder()
          .setTitle(`🩸 CHÀO MỪNG THÀNH VIÊN MỚI!`)
          .setColor("#800020")
          .setThumbnail(
            member.user.displayAvatarURL({ extension: "png", size: 1024 }),
          )
          .setDescription(bodyText)
          .setImage(bannerUrl)
          .setFooter({ text: `ID: ${member.id}` })
          .setTimestamp();

        await channel
          .send({ content: `${member}`, embeds: [embed] })
          .catch(() => {});
      }
    }

    // 🔴 5. GỬI DM KHI JOIN (NẾU BẬT)
    if (Number(config.dm_welcome_enabled) === 1 && config.dm_welcome_message) {
      let dmText = config.dm_welcome_message
        .replace(/{user}/g, `${member.user.username}`)
        .replace(/{guild}/g, member.guild.name);

      await member.send({ content: dmText }).catch(() => {});
    }
  },
};
