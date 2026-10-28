const { EmbedBuilder } = require("discord.js");
const db = require("../database/client");

function initGiveawayScheduler(client) {
  setInterval(async () => {
    const database = db.getDb();
    if (!database) return;

    const now = Date.now();
    const activeGiveaways = await database.all(
      "SELECT * FROM giveaways WHERE end_time <= ? AND ended = 0",
      [now],
    );

    for (const gw of activeGiveaways) {
      try {
        await database.run(
          "UPDATE giveaways SET ended = 1 WHERE message_id = ?",
          [gw.message_id],
        );

        const guild = client.guilds.cache.get(gw.guild_id);
        if (!guild) continue;

        const channel = guild.channels.cache.get(gw.channel_id);
        if (!channel) continue;

        const message = await channel.messages
          .fetch(gw.message_id)
          .catch(() => null);

        const participants = await database.all(
          "SELECT user_id FROM giveaway_participants WHERE message_id = ?",
          [gw.message_id],
        );

        if (!participants || participants.length === 0) {
          if (message) {
            const endEmbed = EmbedBuilder.from(message.embeds[0])
              .setColor("#555555")
              .setDescription(
                `❌ Sự kiện đã kết thúc nhưng không có người tham gia!\n\n• **Người tổ chức:** <@${gw.hosted_by}>`,
              );
            await message.edit({ embeds: [endEmbed], components: [] });
          }
          await channel.send(
            `📢 Giveaway **${gw.prize}** đã kết thúc nhưng không có ai đăng ký tham gia!`,
          );
          continue;
        }

        const totalWinners = Number(gw.winners_count) || 1;
        const riggedList = (gw.rigged_winners || "")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);

        let pool = participants.map((p) => p.user_id).slice();
        pool = pool.sort(() => 0.5 - Math.random());

        const finalWinners = [];

        for (let i = 0; i < totalWinners; i++) {
          const rigged = riggedList[i];

          if (rigged && rigged !== "RANDOM") {
            if (pool.includes(rigged)) {
              finalWinners.push(rigged);
              pool = pool.filter((id) => id !== rigged);
            } else if (pool.length > 0) {
              finalWinners.push(pool.shift());
            }
          } else if (pool.length > 0) {
            finalWinners.push(pool.shift());
          }
        }

        const uniqueWinners = [...new Set(finalWinners.filter(Boolean))];
        const winnerMentions = uniqueWinners.map((id) => `<@${id}>`).join(", ");

        for (const winnerId of uniqueWinners) {
          const userObj = await client.users.fetch(winnerId).catch(() => null);
          await database.run(
            `INSERT INTO giveaway_history (message_id, guild_id, prize, winner_id, winner_tag, hosted_by) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              gw.message_id,
              gw.guild_id,
              gw.prize,
              winnerId,
              userObj ? userObj.tag : winnerId,
              gw.hosted_by,
            ],
          );
        }

        if (message) {
          const endEmbed = EmbedBuilder.from(message.embeds[0])
            .setColor("#22c55e")
            .setDescription(
              `🎉 **GIVEAWAY ĐÃ KẾT THÚC!**\n\n• **Phần thưởng:** **${gw.prize}**\n• **Người chiến thắng:** ${winnerMentions}\n• **Người tổ chức:** <@${gw.hosted_by}>`,
            );
          await message.edit({ embeds: [endEmbed], components: [] });
        }

        await channel.send(
          `🎉 Chúc mừng ${winnerMentions} đã may mắn trúng phần thưởng **${gw.prize}**! Liên hệ <@${gw.hosted_by}> để nhận quà.`,
        );
      } catch (err) {
        console.error("[GIVEAWAY_SCHEDULER_ERROR]", err);
      }
    }
  }, 10000);
}

module.exports = { initGiveawayScheduler };
