const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const passport = require("passport");
const { Strategy } = require("passport-discord");
const path = require("path");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const db = require("../database/client");
const { client } = require("../bot");

const app = express();
const PORT = process.env.PORT || 3000;

// Bật trust proxy khi chạy trên Render / Reverse Proxy
app.set("trust proxy", true);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Cấu hình Session lưu bền vững vào File SQLite với cơ chế an toàn
let sessionStore;
try {
  sessionStore = new SQLiteStore({
    db: "sessions.sqlite",
    dir: path.join(__dirname, "../../"),
    createDirIfNotExists: true,
  });
} catch (e) {
  console.warn("⚠️ [SESSION] Fallback MemoryStore:", e.message);
  sessionStore = new session.MemoryStore();
}

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "sanguinis_secret_2026",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: "auto",
      sameSite: "lax",
    },
  }),
);

passport.serializeUser((user, done) => {
  // Tối ưu hóa kích thước session, chỉ lưu các trường cần thiết
  const minimalUser = {
    id: user.id,
    username: user.username,
    discriminator: user.discriminator,
    avatar: user.avatar,
    guilds: (user.guilds || []).map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      permissions: g.permissions,
      owner: g.owner,
    })),
  };
  done(null, minimalUser);
});
passport.deserializeUser((obj, done) => done(null, obj));

// Chuẩn hóa và làm sạch biến môi trường OAuth
const CLIENT_ID = (process.env.CLIENT_ID || "").trim().replace(/^["']|["']$/g, "");
const CLIENT_SECRET = (process.env.CLIENT_SECRET || "").trim().replace(/^["']|["']$/g, "");

// Xác định Callback URL động và khử triệt để dấu gạch chéo cuối gây lỗi redirect_uri_mismatch
let rawBaseUrl =
  process.env.DASHBOARD_URL ||
  (process.env.RENDER_EXTERNAL_HOSTNAME
    ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
    : `http://localhost:${PORT}`);

const BASE_URL = rawBaseUrl.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
const CALLBACK_URL = `${BASE_URL}/auth/discord/callback`;

console.log(`🌐 [SANGUINIS WEB] BASE_URL: ${BASE_URL}`);
console.log(`🔗 [SANGUINIS OAUTH] Callback URL: ${CALLBACK_URL}`);

if (CLIENT_ID && CLIENT_SECRET) {
  passport.use(
    new Strategy(
      {
        clientID: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        callbackURL: CALLBACK_URL,
        scope: ["identify", "guilds"],
      },
      (accessToken, refreshToken, profile, done) =>
        process.nextTick(() => done(null, profile)),
    ),
  );
} else {
  console.warn("⚠️ [SANGUINIS OAUTH] Thiếu CLIENT_ID hoặc CLIENT_SECRET trong Environment Variables!");
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
  passport.authenticate("discord")(req, res, next);
});

app.get("/auth/discord/callback", (req, res, next) => {
  if (req.query.error) {
    console.warn(`⚠️ [OAUTH_DENIED] Người dùng từ chối hoặc Discord báo lỗi: ${req.query.error_description || req.query.error}`);
    return res.redirect("/");
  }

  passport.authenticate("discord", (err, user, info) => {
    if (err) {
      console.error("❌ [OAUTH_ERROR] Chi tiết lỗi khi xác thực Discord Callback:", err);

      let errorDetails = err.message || "Lỗi không xác định";
      let helpMsg = "Vui lòng kiểm tra lại cấu hình tài khoản và đường link trong Discord Developer Portal.";

      // Bóc tách chi tiết nếu là lỗi từ Discord Token API
      if (err.oauthError && err.oauthError.data) {
        try {
          const parsed = JSON.parse(err.oauthError.data);
          errorDetails = `${parsed.error}: ${parsed.error_description || ""}`;
          if (parsed.error === "redirect_uri_mismatch") {
            helpMsg = `Redirect URI trên Discord Developer Portal chưa khớp!\n\nCallback URL chuẩn hiện tại của Bot là:\n👉 ${CALLBACK_URL}\n\nHãy vào Discord Developer Portal -> Ứng dụng -> OAuth2 -> Redirects để thêm chính xác URL trên.`;
          } else if (parsed.error === "invalid_client") {
            helpMsg = `Client Secret trên Render không đúng hoặc đã bị Reset!\n\nHãy vào Discord Developer Portal -> OAuth2 -> Nhấn "Reset Secret" và dán Secret mới vào biến CLIENT_SECRET trên Render.`;
          } else if (parsed.error === "invalid_grant") {
            helpMsg = `Mã xác thực (code) đã hết hạn hoặc đã được sử dụng. Vui lòng bấm "Thử Lại" để đăng nhập lại.`;
          }
        } catch (_) {
          errorDetails = err.oauthError.data;
        }
      }

      return res.status(500).send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Lỗi Xác Thực • SANGUINIS</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-[#08080a] text-gray-200 min-h-screen flex items-center justify-center p-4 font-sans">
          <div class="max-w-lg w-full bg-[#121218] border border-red-900/60 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-red-950/50 text-center">
            <div class="w-16 h-16 rounded-2xl bg-red-950/80 border border-red-800/60 flex items-center justify-center text-3xl mx-auto mb-4 text-red-500">
              🩸
            </div>
            <h1 class="text-xl font-bold text-white uppercase tracking-wider mb-2">LỖI XÁC THỰC OAUTH2 DISCORD</h1>
            <p class="text-xs text-red-400 font-mono bg-red-950/40 p-3 rounded-xl border border-red-900/40 mb-4 text-left break-all">
              ${errorDetails}
            </p>
            <div class="text-left bg-[#0c0c10] p-4 rounded-xl border border-gray-800 mb-5 text-xs text-gray-300 space-y-2">
              <p class="font-bold text-amber-400">📌 Hướng dẫn khắc phục:</p>
              <p class="text-[11px] text-gray-400 whitespace-pre-line leading-relaxed">${helpMsg}</p>
              <div class="pt-2 border-t border-gray-800">
                <span class="text-gray-400 text-[10px] uppercase font-bold block mb-1">Redirect URI chuẩn cần có trong Discord Developer Portal:</span>
                <code class="text-emerald-400 font-mono text-[11px] select-all bg-black/60 px-2 py-1 rounded block break-all">${CALLBACK_URL}</code>
              </div>
            </div>
            <div class="flex gap-3">
              <a href="/auth/discord" class="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-900 to-red-700 hover:from-red-800 hover:to-red-600 text-white font-bold text-xs uppercase tracking-wider transition">
                Thử Lại
              </a>
              <a href="/" class="py-3 px-5 rounded-xl bg-[#181820] hover:bg-[#222230] text-gray-300 font-bold text-xs uppercase tracking-wider transition">
                Về Trang Chủ
              </a>
            </div>
          </div>
        </body>
        </html>
      `);
    }

    if (!user) {
      console.warn("⚠️ [OAUTH_NO_USER] Không tìm thấy thông tin User từ Discord:", info);
      return res.redirect("/");
    }

    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error("❌ [LOGIN_ERROR] Lỗi khi lưu User vào Session:", loginErr);
        return next(loginErr);
      }
      return res.redirect("/dashboard");
    });
  })(req, res, next);
});

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

// Điều Khoản Dịch Vụ (Terms of Service)
app.get("/terms", (req, res) => {
  res.render("terms");
});

// Chính Sách Bảo Mật (Privacy Policy)
app.get("/privacy", (req, res) => {
  res.render("privacy");
});

app.get("/dashboard", isAuth, (req, res) => {
  const adminGuilds = (req.user.guilds || []).filter(
    (g) =>
      (parseInt(g.permissions) & 0x20) === 0x20 ||
      (parseInt(g.permissions) & 0x8) === 0x8,
  );
  res.render("servers", {
    user: req.user,
    adminGuilds,
    clientId: process.env.CLIENT_ID,
  });
});

// Trang Cấu Hình Server Cụ Thể
app.get("/dashboard/:guildId", isAuth, async (req, res) => {
  const { guildId } = req.params;

  const adminGuilds = (req.user.guilds || []).filter(
    (g) =>
      (parseInt(g.permissions) & 0x20) === 0x20 ||
      (parseInt(g.permissions) & 0x8) === 0x8,
  );

  let guild = client.guilds.cache.get(guildId);
  if (!guild) {
    guild = await client.guilds.fetch(guildId).catch(() => null);
  }

  if (!guild) {
    return res
      .status(404)
      .send(
        "❌ Bot chưa tham gia Server này hoặc chưa kết nối xong Discord API! Hãy mời Bot vào server trước.",
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

    await guild.members.fetch().catch(() => {});
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
      clientId: process.env.CLIENT_ID,
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

  if (
    req.xhr ||
    (req.headers.accept && req.headers.accept.includes("application/json")) ||
    req.query.ajax === "1"
  ) {
    return res.json({
      success: true,
      message:
        "🩸 Toàn bộ cấu hình Huyết Ấn đã được lưu vào cơ sở dữ liệu thành công!",
    });
  }

  res.redirect(`/dashboard/${guildId}`);
});

// METADATA CHO 13 LOẠI SECURITY LOGS THEO CHUẨN SANGUINIS
const LOG_META = {
  SERVER: {
    icon: "📜",
    title: "📜 [TEST AUDIT] NHẬT KÝ CẬP NHẬT MÁY CHỦ",
    desc: "Kênh ghi nhận biến động cấu hình tổng quan, tên, biểu tượng máy chủ và vanity URL.",
    color: "#8b5cf6",
  },
  MEMBER: {
    icon: "👤",
    title: "👤 [TEST AUDIT] NHẬT KÝ BIẾN ĐỘNG QUÂN SỐ",
    desc: "Kênh ghi nhận thành viên gia nhập hoặc rời khỏi phòng tuyến máy chủ.",
    color: "#10b981",
  },
  MODERATION: {
    icon: "⚔️",
    title: "⚔️ [TEST AUDIT] NHẬT KÝ KỶ LUẬT & TRỪNG PHẠT",
    desc: "Kênh ghi nhận án lệnh trừng phạt: Trục xuất (Kick), Phong ấn (Ban), Cách ly (Timeout).",
    color: "#dc2626",
  },
  PERMISSION: {
    icon: "🔐",
    title: "🔐 [TEST AUDIT] NHẬT KÝ BIẾN ĐỘNG PHÂN QUYỀN",
    desc: "Kênh ghi nhận các chỉnh sửa quyền hạn bảo mật của kênh và máy chủ.",
    color: "#8b5cf6",
  },
  ROLE: {
    icon: "🎭",
    title: "🎭 [TEST AUDIT] NHẬT KÝ QUẢN TRỊ VAI TRÒ (ROLE)",
    desc: "Kênh ghi nhận sự kiện khởi tạo, thay đổi màu sắc và tiêu hủy vai trò.",
    color: "#10b981",
  },
  CHANNEL: {
    icon: "📁",
    title: "📁 [TEST AUDIT] NHẬT KÝ THIẾT LẬP KÊNH",
    desc: "Kênh ghi nhận sự kiện tạo lập, chỉnh sửa và xóa bỏ kênh văn bản/thoại.",
    color: "#10b981",
  },
  MESSAGE: {
    icon: "💬",
    title: "💬 [TEST AUDIT] NHẬT KÝ GIÁM SÁT TIN NHẮN",
    desc: "Kênh thu thập nội dung tin nhắn bị thu hồi (xóa) hoặc chỉnh sửa (so sánh trước/sau).",
    color: "#dc2626",
  },
  VOICE: {
    icon: "🔊",
    title: "🔊 [TEST AUDIT] NHẬT KÝ PHÒNG THOẠI (VOICE)",
    desc: "Kênh ghi nhận lượt luân chuyển, gia nhập và ngắt kết nối phòng thoại.",
    color: "#8b5cf6",
  },
  INVITE: {
    icon: "🔗",
    title: "🔗 [TEST AUDIT] NHẬT KÝ KHỞI TẠO LIÊN KẾT MỜI",
    desc: "Kênh kiểm soát danh tính và số lượng thư mời tham gia lãnh địa.",
    color: "#10b981",
  },
  SECURITY: {
    icon: "🚨",
    title: "🚨 [TEST AUDIT] BÁO ĐỘNG AN NINH & PHISHING",
    desc: "Kênh kích hoạt cảnh báo link spam độc hại hoặc hành vi xâm nhập trái phép.",
    color: "#f59e0b",
  },
  ANTI_NUKE: {
    icon: "☢️",
    title: "☢️ [TEST AUDIT] BÁO ĐỘNG PHÁ HOẠI HÀNG LOẠT (ANTI-NUKE)",
    desc: "Kênh báo động cấp độ tối cao khi phát hiện hành vi xóa kênh/role hàng loạt.",
    color: "#dc2626",
  },
  ANTI_RAID: {
    icon: "🛡️",
    title: "🛡️ [TEST AUDIT] QUÉT TÀI KHOẢN CLONE (ANTI-RAID)",
    desc: "Kênh cách ly và trục xuất các thực thể chưa đủ ngày tuổi quy chuẩn.",
    color: "#f59e0b",
  },
  BOT: {
    icon: "🤖",
    title: "🤖 [TEST AUDIT] ỦY THÁC ỨNG DỤNG & BOT MỚI",
    desc: "Kênh giám sát các ứng dụng tự động hoặc bot lạ được thêm vào máy chủ.",
    color: "#10b981",
  },
};

// API GỬI TEST LOG CHO TỪNG KÊNH TRONG 13 KÊNH SECURITY LOGS
app.post("/api/test-log/:guildId", isAuth, async (req, res) => {
  const { guildId } = req.params;
  const { logType, channelId } = req.body;

  const guild =
    client.guilds.cache.get(guildId) ||
    (await client.guilds.fetch(guildId).catch(() => null));

  if (!guild) {
    return res.status(404).json({
      success: false,
      message: "❌ Bot chưa tham gia hoặc chưa kết nối đến Server này!",
    });
  }

  const meta = LOG_META[logType];
  if (!meta) {
    return res.status(400).json({
      success: false,
      message: "❌ Loại nhật ký không hợp lệ!",
    });
  }

  let targetChannelId = channelId;
  if (!targetChannelId || targetChannelId.trim() === "") {
    const database = db.getDb();
    const config = await database.get(
      "SELECT * FROM guild_config WHERE guild_id = ?",
      [guildId],
    );
    const colNameMap = {
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
    targetChannelId = config ? config[colNameMap[logType]] : null;
  }

  if (!targetChannelId || targetChannelId.trim() === "") {
    return res.status(400).json({
      success: false,
      message: `❌ Vui lòng chọn kênh cho [${meta.title}] trước khi gửi Test Log!`,
    });
  }

  let channel = guild.channels.cache.get(targetChannelId);
  if (!channel) {
    channel = await guild.channels.fetch(targetChannelId).catch(() => null);
  }

  if (!channel || !channel.isTextBased()) {
    return res.status(404).json({
      success: false,
      message:
        "❌ Kênh Discord đã chọn không tồn tại hoặc không phải kênh Text!",
    });
  }

  const userAvatar = req.user.avatar
    ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png?size=1024`
    : `https://cdn.discordapp.com/embed/avatars/${parseInt(req.user.discriminator || "0") % 5}.png`;

  const embed = new EmbedBuilder()
    .setTitle(meta.title)
    .setColor(meta.color)
    .setDescription(meta.desc)
    .setThumbnail(userAvatar)
    .addFields([
      { name: "🛡️ Phân hệ Giám sát", value: `\`${logType}\``, inline: true },
      {
        name: "👤 Người kiểm tra",
        value: `<@${req.user.id}> (\`${req.user.username}\`)`,
        inline: true,
      },
      { name: "📌 Kênh ghi nhận", value: `<#${channel.id}>`, inline: true },
      {
        name: "⚡ Tình trạng kết nối",
        value:
          "```diff\n+ GIAO THỨC HOẠT ĐỘNG BÌNH THƯỜNG - SẴN SÀNG TIẾP NHẬN SỰ KIỆN\n```",
      },
    ])
    .setFooter({
      text: "🩸 SANGUINIS AUDIT PROTOCOL • Hệ thống Giám sát Huyết Ấn",
    })
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
    return res.json({
      success: true,
      message: `✅ Tín hiệu thử nghiệm đã truyền thành công tới kênh #${channel.name}!`,
    });
  } catch (err) {
    console.error(`[TEST_LOG_SEND_ERROR] [${logType}]`, err);
    return res.status(500).json({
      success: false,
      message: `❌ Bot không thể gửi tin nhắn vào kênh #${channel.name}! Hãy kiểm tra phân quyền Send Messages & Embed Links.`,
    });
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

  const channelId = req.body.channelId || config?.welcome_channel_id;
  if (!channelId) {
    return res.status(400).json({
      success: false,
      message: "❌ Chưa chọn Kênh Chào Mừng trên Dashboard!",
    });
  }

  const guild =
    client.guilds.cache.get(guildId) ||
    (await client.guilds.fetch(guildId).catch(() => null));

  if (guild) {
    let channel = guild.channels.cache.get(channelId);
    if (!channel) {
      channel = await guild.channels.fetch(channelId).catch(() => null);
    }

    if (channel && channel.isTextBased()) {
      let bodyText = (
        req.body.message ||
        config?.welcome_message ||
        "Chào mừng {user} đã gia nhập {guild} 🩸!\n\n📜 Đọc #rules\n🎮 Chọn role tại #roles\n💬 Chat tại #general"
      )
        .replace(/{user}/g, `<@${req.user.id}>`)
        .replace(/{guild}/g, guild.name)
        .replace(/{memberCount}/g, guild.memberCount.toLocaleString("vi-VN"));

      const userAvatar = req.user.avatar
        ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png?size=1024`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(req.user.discriminator || "0") % 5}.png`;

      const bannerUrl =
        (req.body.bannerUrl && req.body.bannerUrl.trim()) ||
        (config?.welcome_banner_url && config.welcome_banner_url.trim()) ||
        DEFAULT_WELCOME_GIF;

      const embed = new EmbedBuilder()
        .setTitle(`🩸 CHÀO MỪNG, ${req.user.username.toUpperCase()}`)
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
        message: `✅ Đã gửi Test Welcome thành công tới kênh #${channel.name}!`,
      });
    }
  }

  return res.status(500).json({
    success: false,
    message: "❌ Không tìm thấy kênh Discord tương ứng hoặc Bot thiếu quyền!",
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

  const channelId = req.body.channelId || config?.leave_channel_id;
  if (!channelId) {
    return res.status(400).json({
      success: false,
      message: "❌ Chưa chọn Kênh Tạm Biệt trên Dashboard!",
    });
  }

  const guild =
    client.guilds.cache.get(guildId) ||
    (await client.guilds.fetch(guildId).catch(() => null));

  if (guild) {
    let channel = guild.channels.cache.get(channelId);
    if (!channel) {
      channel = await guild.channels.fetch(channelId).catch(() => null);
    }

    if (channel && channel.isTextBased()) {
      let bodyText = (
        req.body.message ||
        config?.leave_message ||
        "**{user}** đã rời khỏi máy chủ {guild}."
      )
        .replace(/{user\.tag}/g, `**${req.user.username}**`)
        .replace(/{user\.username}/g, `**${req.user.username}**`)
        .replace(/{user}/g, `**${req.user.username}**`)
        .replace(/{guild}/g, guild.name);

      const userAvatar = req.user.avatar
        ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png?size=1024`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(req.user.discriminator || "0") % 5}.png`;

      const bannerUrl =
        (req.body.bannerUrl && req.body.bannerUrl.trim()) ||
        (config?.leave_banner_url && config.leave_banner_url.trim()) ||
        DEFAULT_GOODBYE_GIF;

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
        message: `✅ Đã gửi tin nhắn test Tạm Biệt thành công tới kênh #${channel.name}!`,
      });
    }
  }

  return res.status(500).json({
    success: false,
    message: "❌ Không tìm thấy kênh Discord tương ứng hoặc Bot thiếu quyền!",
  });
});

app.post("/api/test-dm-welcome/:guildId", isAuth, async (req, res) => {
  const { guildId } = req.params;
  const database = db.getDb();
  const config = await database.get(
    "SELECT * FROM guild_config WHERE guild_id = ?",
    [guildId],
  );

  const messageText = req.body.message || config?.dm_welcome_message;
  if (!messageText || messageText.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "❌ Chưa nhập Nội dung DM Chào mừng!",
    });
  }

  try {
    const user = await client.users.fetch(req.user.id);
    const guild =
      client.guilds.cache.get(guildId) ||
      (await client.guilds.fetch(guildId).catch(() => null));

    let text = messageText
      .replace(/{user}/g, `<@${req.user.id}>`)
      .replace(/{guild}/g, guild ? guild.name : "Sanguinis");

    await user.send(`🧪 **[TEST DM WELCOME]**\n\n${text}`);
    return res.json({
      success: true,
      message:
        "✅ Đã gửi DM Chào mừng thử nghiệm thành công vào hộp thư riêng!",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message:
        "❌ Không thể gửi DM (Bạn có thể đang tắt nhận tin nhắn từ người lạ)!",
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

  const messageText = req.body.message || config?.dm_leave_message;
  if (!messageText || messageText.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "❌ Chưa nhập Nội dung DM Tạm biệt!",
    });
  }

  try {
    const user = await client.users.fetch(req.user.id);
    const guild =
      client.guilds.cache.get(guildId) ||
      (await client.guilds.fetch(guildId).catch(() => null));

    let text = messageText
      .replace(/{user\.tag}/g, `<@${req.user.id}>`)
      .replace(/{user\.username}/g, req.user.username)
      .replace(/{user}/g, `<@${req.user.id}>`)
      .replace(/{guild}/g, guild ? guild.name : "Sanguinis");

    await user.send(`🧪 **[TEST DM LEAVE]**\n\n${text}`);
    return res.json({
      success: true,
      message: "✅ Đã gửi DM Tạm biệt thử nghiệm thành công vào hộp thư riêng!",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message:
        "❌ Không thể gửi DM (Bạn có thể đang tắt nhận tin nhắn từ người lạ)!",
    });
  }
});

// API TẠO GIVEAWAY
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
      message: "❌ Vui lòng nhập Kênh, Tên Phần thưởng và Thời gian!",
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

  const guild =
    client.guilds.cache.get(guildId) ||
    (await client.guilds.fetch(guildId).catch(() => null));
  if (!guild) {
    return res.status(404).json({
      success: false,
      message: "❌ Không tìm thấy Server Discord!",
    });
  }

  let channel = guild.channels.cache.get(channelId);
  if (!channel) {
    channel = await guild.channels.fetch(channelId).catch(() => null);
  }

  if (!channel || !channel.isTextBased()) {
    return res.status(404).json({
      success: false,
      message: "❌ Không tìm thấy Kênh Discord hợp lệ!",
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

    const embed = new EmbedBuilder()
      .setTitle(`🏆 KHỞI TẠO GIVEAWAY: ${prize.toUpperCase()}`)
      .setColor("#800020")
      .setDescription(
        `Nhấn vào nút **"🎉 Tham Gia"** bên dưới để ghi tên vào danh sách bốc thăm!${condFormatted}\n\n**Người tổ chức:** <@${req.user.id}>\n**Số giải thắng:** \`${winnersCount}\`\n**Kết thúc:** <t:${endTimestamp}:R> (<t:${endTimestamp}:f>)`,
      )
      .setFooter({ text: "🩸 SANGUINIS AUDIT PROTOCOL • 0 Lượt Tham Gia" })
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
      message: "🎉 Tạo sự kiện Giveaway thành công!",
    });
  } catch (err) {
    console.error("[CREATE_GIVEAWAY_ERROR]", err);
    return res.status(500).json({
      success: false,
      message: "❌ Lỗi tạo Giveaway trong máy chủ!",
    });
  }
});

// API ÉP KẾT THÚC GIVEAWAY
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
      message:
        "✅ Đã ép kết thúc Giveaway thành công! Hệ thống đang bốc thăm...",
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "❌ Không thể kết thúc Giveaway!" });
  }
});

// API QUAY SỐ LẠI NGƯỜI THẮNG (REROLL)
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
    let channel = guild?.channels.cache.get(gw.channel_id);
    if (guild && !channel) {
      channel = await guild.channels.fetch(gw.channel_id).catch(() => null);
    }

    if (channel) {
      await channel.send(
        `🎉 **[REROLL CHIẾN LỢI PHẨM]** Người chiến thắng mới của phần quà **${gw.prize}** là: <@${newWinner.user_id}>! Chúc mừng!`,
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

// API XÓA GIVEAWAY
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
      message: "🗑️ Đã xóa bản ghi Giveaway thành công!",
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "❌ Không thể xóa Giveaway!" });
  }
});

// // LẮNG NGHE PORT VÀ BIND 0.0.0.0 ĐỂ RENDER NHẬN DIỆN NGAY LẬP TỨC
// app.listen(PORT, "0.0.0.0", () => {
//   console.log(`🌐 [SANGUINIS WEB] Dashboard đang lắng nghe tại port: ${PORT}`);
//   console.log(
//     `🔗 [SANGUINIS OAUTH] Callback URL: ${BASE_URL}/auth/discord/callback`,
//   );
// });

// Global Error Handler để tránh hiển thị lỗi 500 trắng trang mặc định
app.use((err, req, res, next) => {
  console.error("❌ [EXPRESS_GLOBAL_ERROR]", err);
  if (res.headersSent) return next(err);
  res.status(500).send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>Lỗi Hệ Thống • SANGUINIS</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-[#08080a] text-gray-200 min-h-screen flex items-center justify-center p-4 font-sans">
      <div class="max-w-md w-full bg-[#121218] border border-red-900/60 rounded-2xl p-6 text-center shadow-2xl">
        <div class="text-3xl mb-3">🩸</div>
        <h2 class="text-lg font-bold text-white mb-2 uppercase">HỆ THỐNG GẶP SỰ CỐ</h2>
        <p class="text-xs text-red-400 font-mono bg-red-950/40 p-3 rounded-xl border border-red-900/40 mb-4 text-left break-all">
          ${err.message || "Lỗi máy chủ nội bộ (Internal Server Error)"}
        </p>
        <a href="/" class="inline-block py-2.5 px-6 rounded-xl bg-gradient-to-r from-red-900 to-red-700 text-white font-bold text-xs uppercase tracking-wider transition hover:from-red-800 hover:to-red-600">
          Quay lại Trang Chủ
        </a>
      </div>
    </body>
    </html>
  `);
});

module.exports = app;
