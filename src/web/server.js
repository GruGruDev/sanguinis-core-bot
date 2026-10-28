const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const passport = require("passport");
const { Strategy } = require("passport-discord");
const path = require("path");
const { EmbedBuilder } = require("discord.js");
const db = require("../database/client");
const { client } = require("../bot");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Cấu hình Session lưu bền vững vào File SQLite
app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.sqlite",
      dir: path.join(__dirname, "../../"),
    }),
    secret: process.env.SESSION_SECRET || "sanguinis_secret_2026",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

if (process.env.CLIENT_ID && process.env.CLIENT_SECRET) {
  passport.use(
    new Strategy(
      {
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: `http://localhost:${PORT}/auth/discord/callback`,
        scope: ["identify", "guilds"],
        prompt: "none",
      },
      (accessToken, refreshToken, profile, done) =>
        process.nextTick(() => done(null, profile)),
    ),
  );
}

app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function isAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/auth/discord");
}

app.get("/auth/discord", (req, res, next) => {
  passport.authenticate("discord", { prompt: "none" })(req, res, next);
});

app.get(
  "/auth/discord/callback",
  passport.authenticate("discord", { failureRedirect: "/" }),
  (req, res) => res.redirect("/dashboard"),
);

app.get("/logout", (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.redirect("/");
    });
  });
});

app.get("/", (req, res) => {
  res.render("home", { clientId: process.env.CLIENT_ID });
});

app.get("/dashboard", isAuth, (req, res) => {
  const adminGuilds = req.user.guilds.filter(
    (g) =>
      (parseInt(g.permissions) & 0x20) === 0x20 ||
      (parseInt(g.permissions) & 0x8) === 0x8,
  );
  res.render("servers", { user: req.user, adminGuilds });
});

// Trang Cấu Hình Server Cụ Thể
app.get("/dashboard/:guildId", isAuth, async (req, res) => {
  const { guildId } = req.params;

  const adminGuilds = req.user.guilds.filter(
    (g) =>
      (parseInt(g.permissions) & 0x20) === 0x20 ||
      (parseInt(g.permissions) & 0x8) === 0x8,
  );

  const guild = client.guilds.cache.get(guildId);

  if (!guild) {
    return res
      .status(404)
      .send(
        "❌ Bot chưa tham gia Server này hoặc chưa kết nối xong Discord API!",
      );
  }

  try {
    await guild.channels.fetch();
    await guild.roles.fetch();

    const textChannels = guild.channels.cache
      .filter((ch) => ch.type === 0)
      .map((ch) => ({ id: ch.id, name: ch.name }));

    const voiceChannels = guild.channels.cache
      .filter((ch) => ch.type === 2)
      .map((ch) => ({ id: ch.id, name: ch.name }));

    const roles = guild.roles.cache
      .filter((r) => r.name !== "@everyone" && !r.managed)
      .map((r) => ({ id: r.id, name: r.name }));

    await guild.members.fetch();
    const guildMembers = guild.members.cache.map((member) => ({
      id: member.user.id,
      username: member.user.username,
      tag: member.user.tag,
    }));

    const database = db.getDb();
    let config = await database.get(
      "SELECT * FROM guild_config WHERE guild_id = ?",
      [guildId],
    );
    if (!config) config = {};

    const giveaways = await database.all(
      "SELECT * FROM giveaways WHERE guild_id = ? ORDER BY end_time DESC LIMIT 10",
      [guildId],
    );

    const history = await database.all(
      "SELECT * FROM giveaway_history WHERE guild_id = ? ORDER BY id DESC LIMIT 15",
      [guildId],
    );

    res.render("dashboard", {
      user: req.user,
      guild: guild,
      targetGuild: guild,
      adminGuilds: adminGuilds,
      config: config,
      textChannels: textChannels,
      voiceChannels: voiceChannels,
      roles: roles,
      guildMembers: guildMembers || [],
      giveaways: giveaways || [],
      history: history || [],
    });
  } catch (error) {
    console.error("[DASHBOARD_FETCH_ERROR]", error);
    res.status(500).send("Lỗi tải thông tin Server từ Discord API!");
  }
});

// API Lưu Cấu Hình Hệ Thống & 13 Kênh Security Logs Vào DB
app.post("/api/config/:guildId", isAuth, async (req, res) => {
  const { guildId } = req.params;
  let {
    minXp,
    maxXp,
    cooldown,
    noXpChannels,
    noXpRoles,
    levelUpChannelId,
    xpBoostRoles,
    xpBoostMultiplier,
    welcomeChannelId,
    welcomeMessage,
    welcomeBannerUrl,
    dmWelcomeEnabled,
    dmWelcomeMessage,
    leaveChannelId,
    leaveMessage,
    leaveBannerUrl,
    dmLeaveEnabled,
    dmLeaveMessage,
    memberLogChannelId,
    autoRoles,
    accountAgeDays,
    verifyRoleId,
    memberCountChannelId,
    // 🔴 13 KÊNH SECURITY LOGS
    serverLogChannelId,
    moderationLogChannelId,
    permissionLogChannelId,
    roleLogChannelId,
    channelLogChannelId,
    messageLogChannelId,
    voiceLogChannelId,
    inviteLogChannelId,
    securityLogChannelId,
    antiNukeLogChannelId,
    antiRaidLogChannelId,
    botLogChannelId,
  } = req.body;

  if (Array.isArray(autoRoles)) autoRoles = autoRoles.join(",");
  if (Array.isArray(noXpChannels)) noXpChannels = noXpChannels.join(",");
  if (Array.isArray(noXpRoles)) noXpRoles = noXpRoles.join(",");
  if (Array.isArray(xpBoostRoles)) xpBoostRoles = xpBoostRoles.join(",");

  const database = db.getDb();
  await database.run(
    `
    INSERT INTO guild_config (
      guild_id, min_xp, max_xp, cooldown, no_xp_channels, no_xp_roles, level_up_channel_id, xp_boost_roles, xp_boost_multiplier,
      welcome_channel_id, welcome_message, welcome_banner_url, dm_welcome_enabled, dm_welcome_message,
      leave_channel_id, leave_message, leave_banner_url, dm_leave_enabled, dm_leave_message,
      member_log_channel_id, auto_roles, account_age_days, verify_role_id, member_count_channel_id,
      server_log_channel_id, moderation_log_channel_id, permission_log_channel_id, role_log_channel_id,
      channel_log_channel_id, message_log_channel_id, voice_log_channel_id, invite_log_channel_id,
      security_log_channel_id, anti_nuke_log_channel_id, anti_raid_log_channel_id, bot_log_channel_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      min_xp = ?, max_xp = ?, cooldown = ?, no_xp_channels = ?, no_xp_roles = ?, level_up_channel_id = ?, xp_boost_roles = ?, xp_boost_multiplier = ?,
      welcome_channel_id = ?, welcome_message = ?, welcome_banner_url = ?, dm_welcome_enabled = ?, dm_welcome_message = ?,
      leave_channel_id = ?, leave_message = ?, leave_banner_url = ?, dm_leave_enabled = ?, dm_leave_message = ?,
      member_log_channel_id = ?, auto_roles = ?, account_age_days = ?, verify_role_id = ?, member_count_channel_id = ?,
      server_log_channel_id = ?, moderation_log_channel_id = ?, permission_log_channel_id = ?, role_log_channel_id = ?,
      channel_log_channel_id = ?, message_log_channel_id = ?, voice_log_channel_id = ?, invite_log_channel_id = ?,
      security_log_channel_id = ?, anti_nuke_log_channel_id = ?, anti_raid_log_channel_id = ?, bot_log_channel_id = ?
  `,
    [
      guildId,
      Number(minXp) || 15,
      Number(maxXp) || 25,
      Number(cooldown) || 60,
      noXpChannels || "",
      noXpRoles || "",
      levelUpChannelId || "",
      xpBoostRoles || "",
      Number(xpBoostMultiplier) || 2,
      welcomeChannelId || "",
      welcomeMessage || "",
      welcomeBannerUrl || "",
      dmWelcomeEnabled ? 1 : 0,
      dmWelcomeMessage || "",
      leaveChannelId || "",
      leaveMessage || "",
      leaveBannerUrl || "",
      dmLeaveEnabled ? 1 : 0,
      dmLeaveMessage || "",
      memberLogChannelId || "",
      autoRoles || "",
      Number(accountAgeDays) || 0,
      verifyRoleId || "",
      memberCountChannelId || "",
      serverLogChannelId || "",
      moderationLogChannelId || "",
      permissionLogChannelId || "",
      roleLogChannelId || "",
      channelLogChannelId || "",
      messageLogChannelId || "",
      voiceLogChannelId || "",
      inviteLogChannelId || "",
      securityLogChannelId || "",
      antiNukeLogChannelId || "",
      antiRaidLogChannelId || "",
      botLogChannelId || "",

      Number(minXp) || 15,
      Number(maxXp) || 25,
      Number(cooldown) || 60,
      noXpChannels || "",
      noXpRoles || "",
      levelUpChannelId || "",
      xpBoostRoles || "",
      Number(xpBoostMultiplier) || 2,
      welcomeChannelId || "",
      welcomeMessage || "",
      welcomeBannerUrl || "",
      dmWelcomeEnabled ? 1 : 0,
      dmWelcomeMessage || "",
      leaveChannelId || "",
      leaveMessage || "",
      leaveBannerUrl || "",
      dmLeaveEnabled ? 1 : 0,
      dmLeaveMessage || "",
      memberLogChannelId || "",
      autoRoles || "",
      Number(accountAgeDays) || 0,
      verifyRoleId || "",
      memberCountChannelId || "",
      serverLogChannelId || "",
      moderationLogChannelId || "",
      permissionLogChannelId || "",
      roleLogChannelId || "",
      channelLogChannelId || "",
      messageLogChannelId || "",
      voiceLogChannelId || "",
      inviteLogChannelId || "",
      securityLogChannelId || "",
      antiNukeLogChannelId || "",
      antiRaidLogChannelId || "",
      botLogChannelId || "",
    ],
  );

  console.log(`[DASHBOARD] Đã lưu cấu hình cho server: ${guildId}`);
  res.redirect(`/dashboard/${guildId}`);
});

// 🔴 API GỠ CẢNH CÁO KHỎI HỆ THỐNG
app.post("/api/warn/delete/:warnId", isAuth, async (req, res) => {
  const { warnId } = req.params;
  const database = db.getDb();

  try {
    await database.run("DELETE FROM user_warns WHERE id = ?", [warnId]);
    return res.json({
      success: true,
      message: "✅ Đã gỡ cảnh cáo thành công!",
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "❌ Lỗi gỡ cảnh cáo!" });
  }
});

// 🔴 API ÉP KẾT THÚC GIVEAWAY NGAY TỨC THÌ
app.post("/api/giveaway/end/:messageId", isAuth, async (req, res) => {
  const { messageId } = req.params;
  const database = db.getDb();

  try {
    await database.run(
      "UPDATE giveaways SET end_time = ? WHERE message_id = ?",
      [Date.now(), messageId],
    );
    return res.json({
      success: true,
      message: "✅ Đã ép kết thúc Giveaway thành công!",
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "❌ Không thể kết thúc Giveaway!" });
  }
});

// 🔴 API QUAY SỐ LẠI NGƯỜI THẮNG (REROLL)
app.post("/api/giveaway/reroll/:messageId", isAuth, async (req, res) => {
  const { messageId } = req.params;
  const database = db.getDb();

  try {
    const gw = await database.get(
      "SELECT * FROM giveaways WHERE message_id = ?",
      [messageId],
    );
    if (!gw)
      return res
        .status(404)
        .json({ success: false, message: "❌ Không tìm thấy Giveaway!" });

    const participants = await database.all(
      "SELECT user_id FROM giveaway_participants WHERE message_id = ?",
      [messageId],
    );
    if (!participants || participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: "❌ Không có ai tham gia để Reroll!",
      });
    }

    const newWinner =
      participants[Math.floor(Math.random() * participants.length)];
    const guild = client.guilds.cache.get(gw.guild_id);
    const channel = guild?.channels.cache.get(gw.channel_id);

    if (channel) {
      await channel.send(
        `🎉 **[REROLL]** Người chiến thắng mới của phần quà **${gw.prize}** là: <@${newWinner.user_id}>! Chúc mừng!`,
      );
    }

    return res.json({
      success: true,
      message: `✅ Đã Reroll người thắng mới thành công!`,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "❌ Lỗi trong quá trình Reroll!" });
  }
});

const DEFAULT_WELCOME_GIF =
  "https://media.giphy.com/media/vVjkN5PFzWizSI3wKn/giphy.gif";

app.post("/api/test-welcome/:guildId", isAuth, async (req, res) => {
  const { guildId } = req.params;
  const database = db.getDb();
  const config = await database.get(
    "SELECT * FROM guild_config WHERE guild_id = ?",
    [guildId],
  );

  if (!config || !config.welcome_channel_id) {
    return res.status(400).json({
      success: false,
      message: "❌ Chưa chọn Kênh Chào Mừng trên Dashboard!",
    });
  }

  const guild = client.guilds.cache.get(guildId);
  if (guild) {
    const channel = guild.channels.cache.get(config.welcome_channel_id);
    if (channel) {
      let bodyText = (
        config.welcome_message ||
        "Chào mừng {user} đã gia nhập {guild} 🩸!\n\n📜 Đọc #rules\n🎮 Chọn role tại #roles\n💬 Chat tại #general"
      )
        .replace(/{user}/g, `<@${req.user.id}>`)
        .replace(/{guild}/g, guild.name)
        .replace(/{memberCount}/g, guild.memberCount.toLocaleString("vi-VN"));

      const userAvatar = req.user.avatar
        ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png?size=1024`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(req.user.discriminator || "0") % 5}.png`;

      const bannerUrl =
        config.welcome_banner_url && config.welcome_banner_url.trim() !== ""
          ? config.welcome_banner_url.trim()
          : DEFAULT_WELCOME_GIF;

      const embed = new EmbedBuilder()
        .setTitle(`🩸 CHÀO MỪNG, ${req.user.username}`)
        .setColor("#800020")
        .setThumbnail(userAvatar)
        .setDescription(bodyText)
        .setImage(bannerUrl)
        .setFooter({
          text: `Member #${guild.memberCount.toLocaleString("vi-VN")} • ID: ${req.user.id}`,
        })
        .setTimestamp();

      await channel
        .send({ content: `👋 Welcome <@${req.user.id}>`, embeds: [embed] })
        .catch((err) => console.error(err));
      return res.json({
        success: true,
        message: "✅ Đã gửi Test Welcome thành công!",
      });
    }
  }

  return res.status(500).json({
    success: false,
    message: "❌ Không tìm thấy kênh Discord tương ứng!",
  });
});

const DEFAULT_GOODBYE_GIF =
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYjEyaXlmYm1qcGcwNmFneXNjamZndjY0NHl4bHZjeGs2Z3JjNjUwayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Ru9sjtZ09XOEg/giphy.gif";

app.post("/api/test-goodbye/:guildId", isAuth, async (req, res) => {
  const { guildId } = req.params;
  const database = db.getDb();
  const config = await database.get(
    "SELECT * FROM guild_config WHERE guild_id = ?",
    [guildId],
  );

  if (!config || !config.leave_channel_id) {
    return res.status(400).json({
      success: false,
      message: "❌ Chưa chọn Kênh Tạm Biệt trên Dashboard!",
    });
  }

  const guild = client.guilds.cache.get(guildId);
  if (guild) {
    const channel = guild.channels.cache.get(config.leave_channel_id);
    if (channel) {
      let bodyText = (
        config.leave_message || "**{user}** đã rời khỏi máy chủ {guild}."
      )
        .replace(/{user\.tag}/g, `**${req.user.username}**`)
        .replace(/{user\.username}/g, `**${req.user.username}**`)
        .replace(/{user}/g, `**${req.user.username}**`)
        .replace(/{guild}/g, guild.name);

      const userAvatar = req.user.avatar
        ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png?size=1024`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(req.user.discriminator || "0") % 5}.png`;

      const bannerUrl =
        config.leave_banner_url && config.leave_banner_url.trim() !== ""
          ? config.leave_banner_url.trim()
          : DEFAULT_GOODBYE_GIF;

      const embed = new EmbedBuilder()
        .setTitle(`🚪 TẠM BIỆT, ${req.user.username.toUpperCase()}`)
        .setColor("#708090")
        .setThumbnail(userAvatar)
        .setDescription(bodyText)
        .setImage(bannerUrl)
        .setFooter({ text: `ID Thành Viên: ${req.user.id}` })
        .setTimestamp();

      await channel
        .send({ embeds: [embed] })
        .catch((err) => console.error(err));
      return res.json({
        success: true,
        message: "✅ Đã gửi tin nhắn test Tạm Biệt thành công!",
      });
    }
  }

  return res.status(500).json({
    success: false,
    message: "❌ Không tìm thấy kênh Discord tương ứng!",
  });
});

app.post("/api/test-dm-welcome/:guildId", isAuth, async (req, res) => {
  const { guildId } = req.params;
  const database = db.getDb();
  const config = await database.get(
    "SELECT * FROM guild_config WHERE guild_id = ?",
    [guildId],
  );

  if (!config || !config.dm_welcome_message) {
    return res
      .status(400)
      .json({ success: false, message: "❌ Chưa nhập Nội dung DM Chào mừng!" });
  }

  try {
    const user = await client.users.fetch(req.user.id);
    const guild = client.guilds.cache.get(guildId);

    let text = config.dm_welcome_message
      .replace(/{user}/g, `<@${req.user.id}>`)
      .replace(/{guild}/g, guild ? guild.name : "Sanguinis");

    await user.send(`🧪 **[TEST DM WELCOME]**\n\n${text}`);
    return res.json({
      success: true,
      message: "✅ Đã gửi DM Chào mừng thử nghiệm thành công!",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "❌ Không thể gửi DM (Bạn có thể đang tắt DM người lạ)!",
    });
  }
});

app.post("/api/test-dm-leave/:guildId", isAuth, async (req, res) => {
  const { guildId } = req.params;
  const database = db.getDb();
  const config = await database.get(
    "SELECT * FROM guild_config WHERE guild_id = ?",
    [guildId],
  );

  if (!config || !config.dm_leave_message) {
    return res
      .status(400)
      .json({ success: false, message: "❌ Chưa nhập Nội dung DM Tạm biệt!" });
  }

  try {
    const user = await client.users.fetch(req.user.id);
    const guild = client.guilds.cache.get(guildId);

    let text = config.dm_leave_message
      .replace(/{user\.tag}/g, `<@${req.user.id}>`)
      .replace(/{user\.username}/g, req.user.username)
      .replace(/{user}/g, `<@${req.user.id}>`)
      .replace(/{guild}/g, guild ? guild.name : "Sanguinis");

    await user.send(`🧪 **[TEST DM LEAVE]**\n\n${text}`);
    return res.json({
      success: true,
      message: "✅ Đã gửi DM Tạm biệt thử nghiệm thành công!",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "❌ Không thể gửi DM (Bạn có thể đang tắt DM người lạ)!",
    });
  }
});

// 🔴 API TẠO GIVEAWAY ĐẦY ĐỦ ĐIỀU KIỆN
app.post("/api/giveaway/create/:guildId", isAuth, async (req, res) => {
  const { guildId } = req.params;
  const {
    channelId,
    prize,
    duration,
    winners,
    requiredRoleId,
    minAccountAge,
    minServerAge,
    minLevel,
    minMessages,
    minParticipants,
    riggedWinners,
  } = req.body;

  if (!channelId || !prize || !duration) {
    return res.status(400).json({
      success: false,
      message: "❌ Vui lòng nhập Kênh, Phần thưởng và Thời gian!",
    });
  }

  function parseDuration(str) {
    const match = str.match(/^(\d+)([smhd])$/i);
    if (!match) return null;
    const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return parseInt(match[1]) * mult[match[2].toLowerCase()];
  }

  const durationMs = parseDuration(duration);
  if (!durationMs) {
    return res.status(400).json({
      success: false,
      message: "❌ Thời gian sai định dạng (Ví dụ: 10m, 2h, 1d)!",
    });
  }

  const guild = client.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(channelId);
  if (!channel) {
    return res.status(404).json({
      success: false,
      message: "❌ Không tìm thấy Kênh Discord!",
    });
  }

  try {
    const winnersCount = Number(winners) || 1;
    const endTime = Date.now() + durationMs;
    const endTimestamp = Math.floor(endTime / 1000);

    let reqText = [];
    if (requiredRoleId)
      reqText.push(`• **Role bắt buộc:** <@&${requiredRoleId}>`);
    if (Number(minAccountAge) > 0)
      reqText.push(`• **Tuổi Acc tối thiểu:** \`${minAccountAge}\` ngày`);
    if (Number(minServerAge) > 0)
      reqText.push(`• **Thời gian ở Server:** \`${minServerAge}\` giờ`);
    if (Number(minLevel) > 0)
      reqText.push(`• **Cấp độ (Level) tối thiểu:** \`Level ${minLevel}\``);
    if (Number(minMessages) > 0)
      reqText.push(`• **Số tin nhắn tối thiểu:** \`${minMessages}\` msgs`);
    if (Number(minParticipants) > 0)
      reqText.push(
        `• **Quân số tham gia tối thiểu:** \`${minParticipants}\` người`,
      );

    const condFormatted =
      reqText.length > 0
        ? `\n\n📌 **ĐIỀU KIỆN THAM GIA:**\n${reqText.join("\n")}`
        : "";

    const {
      EmbedBuilder,
      ActionRowBuilder,
      ButtonBuilder,
      ButtonStyle,
    } = require("discord.js");

    const embed = new EmbedBuilder()
      .setTitle(`🎉 GIVEAWAY: ${prize.toUpperCase()}`)
      .setColor("#800020")
      .setDescription(
        `Nhấn vào nút **"🎉 Tham Gia"** bên dưới để tham gia sự kiện!${condFormatted}\n\n• **Người tổ chức:** <@${req.user.id}>\n• **Số giải thắng:** \`${winnersCount}\`\n• **Kết thúc:** <t:${endTimestamp}:R> (<t:${endTimestamp}:f>)`,
      )
      .setFooter({ text: "Sanguinis Event System • 0 Lượt Tham Gia" })
      .setTimestamp(endTime);

    const joinBtn = new ButtonBuilder()
      .setCustomId("btn_join_giveaway")
      .setLabel("Tham Gia")
      .setEmoji("🎉")
      .setStyle(ButtonStyle.Primary);

    const msg = await channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(joinBtn)],
    });

    const riggedWinnersStr = Array.isArray(riggedWinners)
      ? riggedWinners.join(",")
      : "";

    const database = db.getDb();
    await database.run(
      `INSERT INTO giveaways (
        message_id, channel_id, guild_id, prize, winners_count, end_time, hosted_by,
        required_role_id, min_account_age, min_server_age, min_level, min_messages, min_participants, rigged_winners
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        msg.id,
        channelId,
        guildId,
        prize,
        winnersCount,
        endTime,
        req.user.id,
        requiredRoleId || "",
        Number(minAccountAge) || 0,
        Number(minServerAge) || 0,
        Number(minLevel) || 0,
        Number(minMessages) || 0,
        Number(minParticipants) || 0,
        riggedWinnersStr,
      ],
    );

    return res.json({
      success: true,
      message: "🎉 Tạo Giveaway đầy đủ điều kiện thành công!",
    });
  } catch (err) {
    console.error("[CREATE_GIVEAWAY_ERROR]", err);
    return res.status(500).json({
      success: false,
      message: "❌ Lỗi tạo Giveaway!",
    });
  }
});

// 🔴 API XÓA GIVEAWAY KHỎI DATABASE & DASHBOARD
app.post("/api/giveaway/delete/:messageId", isAuth, async (req, res) => {
  const { messageId } = req.params;
  const database = db.getDb();

  try {
    await database.run("DELETE FROM giveaways WHERE message_id = ?", [
      messageId,
    ]);
    await database.run(
      "DELETE FROM giveaway_participants WHERE message_id = ?",
      [messageId],
    );
    return res.json({
      success: true,
      message: "🗑️ Đã xóa Giveaway khỏi danh sách!",
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "❌ Không thể xóa Giveaway!" });
  }
});

module.exports = app;
