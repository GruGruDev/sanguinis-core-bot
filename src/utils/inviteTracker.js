/**
 * Helper theo dõi invite (mã mời) trong bộ nhớ bot.
 * Dùng để phát hiện mã mời nào được sử dụng khi có thành viên mới gia nhập.
 */

function getCache(client) {
  if (!client) return new Map();
  if (!client.inviteCache) client.inviteCache = new Map();
  return client.inviteCache;
}

async function cacheGuildInvites(client, guild) {
  if (!client || !guild) return;
  const cache = getCache(client);
  try {
    const invites = await guild.invites.fetch();
    const map = new Map();
    invites.forEach((inv) => map.set(inv.code, inv.uses || 0));
    cache.set(guild.id, map);
  } catch (err) {
    // Bot có thể thiếu quyền Manage Server / Create Invite
  }
}

async function cacheAllGuildInvites(client) {
  if (!client) return;
  for (const guild of client.guilds.cache.values()) {
    await cacheGuildInvites(client, guild);
  }
}

module.exports = { getCache, cacheGuildInvites, cacheAllGuildInvites };