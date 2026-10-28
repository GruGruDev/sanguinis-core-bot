const { EmbedBuilder } = require("discord.js");
const db = require("../database/client");

const LOG_TYPES = {
  SERVER: "server_log_channel_id",
  MEMBER: "member_log_channel_id",
  MODERATION: "moderation_log_channel_id",
  PERMISSION: "permission_log_channel_id",
  ROLE: "role_log_channel_id",
  CHANNEL: "channel_log_channel_id",
  MESSAGE: "message_log_channel_id",
  VOICE: "voice_log_channel_id",
  INVITE: "invite_log_channel_id",
  SECURITY: "security_log_channel_id",
  ANTI_NUKE: "anti_nuke_log_channel_id",
  ANTI_RAID: "anti_raid_log_channel_id",
  BOT: "bot_log_channel_id",
};

// Chuẩn bảng màu GEN SANGUINIS
const LOG_COLORS = {
  SUCCESS: "#10b981", // Xanh độc dược: Thêm mới / Member Join / Tạo Role/Kênh / Unban / Link mời
  DANGER: "#dc2626",  // Đỏ thẫm: Xóa bỏ / Kick / Ban / Xóa Tin nhắn / Vi phạm / Anti-Nuke
  MUTATE: "#8b5cf6",  // Tím Arcane: Chỉnh sửa phân quyền / Sửa tin nhắn / Cập nhật Server / Voice
  WARN: "#f59e0b",    // Vàng kim: Cảnh báo bảo mật / Anti-Phishing phát hiện link lạ / Anti-Raid
};

const DEFAULT_FOOTER = "🩸 SANGUINIS AUDIT PROTOCOL • Hệ thống Giám sát Huyết Ấn";

/**
 * Gửi nhật ký Embed bảo mật chuẩn SANGUINIS với cơ chế Safe Fetching
 */
async function sendLog(
  guild,
  type,
  { title, color = "#800020", description, fields = [], thumbnail, footer },
) {
  if (!guild) return;

  try {
    const database = db.getDb();
    if (!database) return;

    const config = await database.get(
      "SELECT * FROM guild_config WHERE guild_id = ?",
      [guild.id],
    );
    if (!config) return;

    const channelKey = LOG_TYPES[type];
    if (!channelKey) return;
    const logChannelId = config[channelKey];

    if (!logChannelId || logChannelId.trim() === "") return;

    // Safe Fetching: Dùng guild.channels.fetch nếu cache trống hoặc chưa tải xong
    let channel = guild.channels.cache.get(logChannelId);
    if (!channel) {
      channel = await guild.channels.fetch(logChannelId).catch(() => null);
    }
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .setDescription(description || null)
      .setTimestamp();

    if (fields && fields.length > 0) {
      embed.addFields(fields);
    }
    if (thumbnail) {
      embed.setThumbnail(thumbnail);
    }

    embed.setFooter({
      text: footer || DEFAULT_FOOTER,
    });

    await channel
      .send({ embeds: [embed] })
      .catch((err) => console.error(`[SEND_LOG_ERROR] [${type}]`, err));
  } catch (err) {
    console.error(`[LOGGER_EXECUTE_ERROR] [${type}]`, err);
  }
}

module.exports = {
  sendLog,
  LOG_TYPES,
  LOG_COLORS,
  DEFAULT_FOOTER,
};
