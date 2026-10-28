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
    const logChannelId = config[channelKey];

    if (!logChannelId || logChannelId.trim() === "") return;

    // Fetch trực tiếp từ Discord API nếu Cache trống
    const channel =
      guild.channels.cache.get(logChannelId) ||
      (await guild.channels.fetch(logChannelId).catch(() => null));
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .setDescription(description || null)
      .setTimestamp();

    if (fields && fields.length > 0) embed.addFields(fields);
    if (thumbnail) embed.setThumbnail(thumbnail);
    if (footer) embed.setFooter({ text: footer });
    else
      embed.setFooter({
        text: `Sanguinis Audit Logger • Server: ${guild.name}`,
      });

    await channel
      .send({ embeds: [embed] })
      .catch((err) => console.error(`[SEND_LOG_ERROR] [${type}]`, err));
  } catch (err) {
    console.error(`[LOGGER_EXECUTE_ERROR] [${type}]`, err);
  }
}

module.exports = { sendLog, LOG_TYPES };
