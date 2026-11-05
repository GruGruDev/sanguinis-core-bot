const { Events, EmbedBuilder } = require("discord.js");
const db = require("../database/client");
const { sendLog } = require("../utils/logger");

// Công thức tính XP cần để lên cấp (Arcane standard)
function getXpForLevel(level) {
  const lvl = parseInt(level, 10) || 1;
  return 5 * lvl ** 2 + 50 * lvl + 100;
}

const spamTracker = new Map();

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const database = db.getDb();
    if (!database) return;

    // 🔴 1. BỘ QUÉT BẢO MẬT: PHÁT HIỆN SPAM LINK DISCORD QUẢNG CÁO (SECURITY LOG)
    const discordInviteRegex =
      /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discord\.com\/invite)\/[a-zA-Z0-9]+/gi;

    if (discordInviteRegex.test(message.content)) {
      if (!message.member.permissions.has("Administrator")) {
        // Tự động xóa tin nhắn spam
        await message.delete().catch(() => {});

        // Gửi Log báo động an ninh
        await sendLog(message.guild, "SECURITY", {
          title: "🚨 [BÁO ĐỘNG AN NINH] PHÁT HIỆN LIÊN KẾT SPAM LẠ",
          color: "#f59e0b",
          description: `Thành viên <@${message.author.id}> vừa phát tán liên kết mời không được kiểm chứng và đã bị **TỰ ĐỘNG THU HỒI TIN NHẮN**!`,
          fields: [
            {
              name: "👤 Người vi phạm",
              value: `${message.author.tag} (\`${message.author.id}\`)`,
              inline: true,
            },
            {
              name: "📌 Tại kênh",
              value: `<#${message.channel.id}>`,
              inline: true,
            },
            {
              name: "💬 Nội dung quảng cáo",
              value: `\`\`\`${message.content.substring(0, 1000)}\`\`\``,
            },
          ],
          thumbnail: message.author.displayAvatarURL(),
        });

        // Cảnh báo người dùng
        const warningMsg = await message.channel.send(
          `⚠️ <@${message.author.id}>, bạn không được phép gửi link mời Server Discord khác tại đây!`,
        );
        setTimeout(() => warningMsg.delete().catch(() => {}), 5000);
        return; // Dừng lại, không cộng XP cho tin nhắn spam
      }
    }

    // Lấy cấu hình server
    const config = await database.get(
      "SELECT * FROM guild_config WHERE guild_id = ?",
      [message.guild.id],
    );
    if (!config) return;

    // 🔴 1.5. GIỚI HẠN NƠI GỬI LINK / ẢNH / VIDEO (FIXED PLACE)
    const mediaChannelId = (config.media_channel_id || "").trim();
    if (mediaChannelId && !message.member.permissions.has("Administrator")) {
      const hasLink = /https?:\/\/\S+/i.test(message.content || "");
      const hasAttachment = message.attachments && message.attachments.size > 0;
      if ((hasLink || hasAttachment) && message.channel.id !== mediaChannelId) {
        await message.delete().catch(() => {});

        // Theo dõi spam
        const key = `${message.guild.id}:${message.author.id}`;
        const now = Date.now();
        let entry = spamTracker.get(key);
        if (!entry || now - entry.first > 10 * 60 * 1000) {
          entry = { count: 0, first: now };
        }
        entry.count += 1;
        spamTracker.set(key, entry);

        let actionText = "Cảnh báo";
        try {
          if (entry.count >= 5) {
            await message.guild.members.ban(message.author, {
              reason: "Spam link/ảnh/video sai chỗ (Sanguinis)",
            }).catch(() => {});
            actionText = "BAN vĩnh viễn";
          } else if (entry.count >= 3) {
            await message.member.timeout(10 * 60 * 1000, "Spam link/ảnh/video sai chỗ (Sanguinis)").catch(() => {});
            actionText = "Timeout 10 phút";
          } else if (entry.count === 2) {
            await message.member.timeout(5 * 60 * 1000, "Spam link/ảnh/video sai chỗ (Sanguinis)").catch(() => {});
            actionText = "Timeout 5 phút";
          }
        } catch (_) {}

        const warnText =
          `⚠️ Bạn chỉ được gửi link, ảnh hoặc video tại kênh <#${mediaChannelId}>. ` +
          `Tin nhắn của bạn đã bị thu hồi. (Vi phạm #${entry.count} - ${actionText})`;
        await message.author.send(warnText).catch(() => {});

        await sendLog(message.guild, "SECURITY", {
          title: "🔗 CẢNH BÁO: GỬI LINK/ẢNH/VIDEO SAI CHỖ",
          color: "#f59e0b",
          description: `Thành viên <@${message.author.id}> gửi link/ảnh/video ngoài kênh cho phép <#${mediaChannelId}> và đã bị thu hồi.`,
          fields: [
            { name: "👤 Người vi phạm", value: `${message.author.tag} (${message.author.id})`, inline: true },
            { name: "📌 Kênh", value: `<#${message.channel.id}>`, inline: true },
            { name: "🔁 Vi phạm", value: `#${entry.count} - ${actionText}`, inline: true },
          ],
          thumbnail: message.author.displayAvatarURL(),
        });

        return; // Không cộng XP
      }
    }

    // 🔴 2. KIỂM TRA KÊNH CẤM TÍCH XP
    if (config.no_xp_channels) {
      const bannedChannels = config.no_xp_channels
        .split(",")
        .map((c) => c.trim());
      if (bannedChannels.includes(message.channel.id)) return;
    }

    // 🔴 3. KIỂM TRA ROLE CẤM TÍCH XP
    if (config.no_xp_roles) {
      const bannedRoles = config.no_xp_roles.split(",").map((r) => r.trim());
      if (message.member.roles.cache.some((r) => bannedRoles.includes(r.id)))
        return;
    }

    // 🔴 4. XỬ LÝ COOLDOWN TÍCH XP
    let user = await database.get("SELECT * FROM users WHERE id = ?", [
      message.author.id,
    ]);
    const now = Math.floor(Date.now() / 1000);
    const cooldown = parseInt(config.cooldown, 10) || 60;

    if (!user) {
      await database.run(
        "INSERT INTO users (id, balance, xp, level, last_xp_time) VALUES (?, 0, 0, 1, ?)",
        [message.author.id, now],
      );
      user = {
        id: message.author.id,
        balance: 0,
        xp: 0,
        level: 1,
        last_xp_time: now,
      };
    } else {
      const lastXpTime = parseInt(user.last_xp_time, 10) || 0;
      if (now - lastXpTime < cooldown) {
        return; // Đang trong thời gian Cooldown
      }
    }

    // 🔴 5. TÍNH XP RANDOM & HỆ SỐ BOOST (X2/X3/X5 XP)
    const minXp = parseInt(config.min_xp, 10) || 15;
    const maxXp = parseInt(config.max_xp, 10) || 25;
    let xpGained = Math.floor(Math.random() * (maxXp - minXp + 1)) + minXp;

    if (config.xp_boost_roles) {
      const boostRoles = config.xp_boost_roles.split(",").map((r) => r.trim());
      const hasBoostRole = message.member.roles.cache.some((r) =>
        boostRoles.includes(r.id),
      );
      if (hasBoostRole) {
        const multiplier = parseInt(config.xp_boost_multiplier, 10) || 2;
        xpGained *= multiplier;
      }
    }

    // ÉP KIỂU SỐ HỌC TUYỆT ĐỐI ĐỂ CHỐNG NỐI CHUỖI
    const currentXp = parseInt(user.xp, 10) || 0;
    let currentLevel = parseInt(user.level, 10) || 1;
    const newXp = currentXp + xpGained;

    let newLevel = currentLevel;
    let neededXp = getXpForLevel(newLevel);
    let leveledUp = false;

    while (newXp >= neededXp) {
      newLevel += 1;
      neededXp = getXpForLevel(newLevel);
      leveledUp = true;
    }

    // Cập nhật Database
    await database.run(
      "UPDATE users SET xp = ?, level = ?, last_xp_time = ? WHERE id = ?",
      [newXp, newLevel, now, message.author.id],
    );

    // 🔴 6. GỬI THÔNG BÁO LÊN CẤP (LEVEL UP)
    if (leveledUp) {
      const userAvatar = message.author.displayAvatarURL({
        extension: "png",
        size: 512,
      });

      const embed = new EmbedBuilder()
        .setTitle("🎉 CHÚC MỪNG LÊN CẤP!")
        .setColor("#FFD700")
        .setThumbnail(userAvatar)
        .setDescription(
          `Chúc mừng ${message.author} đã đạt **Level ${newLevel}**! 🎉\n\n✨ **Tổng XP:** \`${newXp.toLocaleString("vi-VN")} XP\``,
        )
        .setFooter({ text: `Sanguinis Leveling System • Arcane Style` })
        .setTimestamp();

      const successContent = `🎉 Chúc mừng ${message.author} đã đạt level **${newLevel}**! 🎊`;

      if (config.level_up_channel_id === "DM") {
        await message.author.send({ embeds: [embed] }).catch(() => {});
      } else if (
        config.level_up_channel_id &&
        config.level_up_channel_id !== ""
      ) {
        const targetChannel = message.guild.channels.cache.get(
          config.level_up_channel_id,
        );
        if (targetChannel) {
          await targetChannel
            .send({
              content: successContent,
              embeds: [embed],
            })
            .catch(() => {});
        } else {
          await message.channel
            .send({
              content: successContent,
              embeds: [embed],
            })
            .catch(() => {});
        }
      } else {
        await message.channel
          .send({
            content: successContent,
            embeds: [embed],
          })
          .catch(() => {});
      }
    }
  },
};
