const { Events, EmbedBuilder } = require("discord.js");
const db = require("../database/client");
const { sendLog, LOG_COLORS } = require("../utils/logger");

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

    // 🔴 1. KIỂM TRA BOT MỚI (BOT LOG)
    if (member.user.bot) {
      await sendLog(member.guild, "BOT", {
        title: "🤖 ỦY THÁC ỨNG DỤNG / BOT MỚI",
        color: LOG_COLORS.SUCCESS,
        description: `Bot <@${member.id}> (\`${member.user.tag}\`) vừa được thêm vào máy chủ **${member.guild.name}**.`,
        fields: [
          { name: "🆔 Bot ID", value: `\`${member.id}\``, inline: true },
          {
            name: "📅 Ngày Khởi Tạo",
            value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
            inline: true,
          },
        ],
        thumbnail: member.user.displayAvatarURL(),
      });
    }

    // 🔴 2. KIỂM TRA TUỔI TÀI KHOẢN (ANTI-ALT / ANTI-RAID)
    const minAgeDays = Number(config.account_age_days) || 0;
    if (minAgeDays > 0 && !member.user.bot) {
      const createdTimestamp = member.user.createdTimestamp;
      const accountAgeDays =
        (Date.now() - createdTimestamp) / (1000 * 60 * 60 * 24);

      if (accountAgeDays < minAgeDays) {
        console.log(
          `[ANTI-ALT] Đã kick ${member.user.tag} (Tuổi acc: ${accountAgeDays.toFixed(1)} ngày < ${minAgeDays} ngày)`,
        );

        // Gửi Log Báo Động sang kênh anti-raid-log
        await sendLog(member.guild, "ANTI_RAID", {
          title: "🛡️ PHÒNG TUYẾN ANTI-RAID: TRỤC XUẤT CLONE",
          color: LOG_COLORS.DANGER,
          description: `Thành viên <@${member.id}> có tuổi tài khoản chỉ **${accountAgeDays.toFixed(1)} ngày** (Yêu cầu tối thiểu: **${minAgeDays} ngày**). Phòng tuyến đã tự động TRỤC XUẤT (Kick)!`,
          fields: [
            {
              name: "👤 Danh tính",
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
            `❌ Bạn không đủ điều kiện gia nhập **${member.guild.name}** do tài khoản chưa đủ tuổi tối thiểu (${minAgeDays} ngày).`,
          )
          .catch(() => {});

        await member
          .kick("Tài khoản chưa đủ tuổi tối thiểu (Sanguinis Anti-Alt Check)")
          .catch(() => {});
        return; // Dừng các bước tiếp theo
      }
    }

    // 🔴 3. GỬI MEMBER LOG (Kênh member-log cho BQL)
    if (!member.user.bot) {
      await sendLog(member.guild, "MEMBER", {
        title: "👤 [NHẬT KÝ QUÂN SỐ] THÀNH VIÊN MỚI GIA NHẬP",
        color: LOG_COLORS.SUCCESS,
        description: `<@${member.id}> đã bước qua cổng thành **${member.guild.name}**.`,
        fields: [
          { name: "👤 User Tag", value: member.user.tag, inline: true },
          { name: "🆔 User ID", value: `\`${member.id}\``, inline: true },
          {
            name: "👥 Tổng Quân Số",
            value: `\`${member.guild.memberCount.toLocaleString("vi-VN")}\` người`,
            inline: true,
          },
        ],
        thumbnail: member.user.displayAvatarURL(),
      });
    }

    // 🔴 4. TỰ ĐỘNG GÁN ROLE BAN ĐẦU (Auto Roles)
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

    // 🔴 5. GỬI TIN NHẮN CHÀO MỪNG CÔNG KHAI
    if (config.welcome_channel_id && !member.user.bot) {
      const channel = member.guild.channels.cache.get(
        config.welcome_channel_id,
      );
      if (channel) {
        let bodyText = (
          config.welcome_message || "Chào mừng {user} đã gia nhập {guild} 🩸!"
        )
          .replace(/{user}/g, `${member}`)
          .replace(/{guild}/g, member.guild.name)
          .replace(
            /{memberCount}/g,
            member.guild.memberCount.toLocaleString("vi-VN"),
          );

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
          .setFooter({
            text: `🩸 SANGUINIS AUDIT PROTOCOL • Quân số: #${member.guild.memberCount}`,
          })
          .setTimestamp();

        await channel
          .send({ content: `${member}`, embeds: [embed] })
          .catch(() => {});
      }
    }

    // 🔴 6. GỬI DM KHI JOIN (NẾU BẬT)
    if (
      Number(config.dm_welcome_enabled) === 1 &&
      config.dm_welcome_message &&
      !member.user.bot
    ) {
      let dmText = config.dm_welcome_message
        .replace(/{user}/g, `${member.user.username}`)
        .replace(/{guild}/g, member.guild.name);

      await member.send({ content: dmText }).catch(() => {});
    }
  },
};
