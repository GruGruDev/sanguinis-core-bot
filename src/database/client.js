const { Pool } = require("pg");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");

let dbInstance = null;

/**
 * Adapter bọc PostgreSQL Pool để giữ nguyên 100% cú pháp gọi của SQLite:
 * .get(sql, params)
 * .all(sql, params)
 * .run(sql, params)
 * .exec(sql)
 */
class PostgresAdapter {
  constructor(pool) {
    this.pool = pool;
  }

  // Chuyển dấu ? của SQLite thành $1, $2, $3 của Postgres
  _formatSql(sql) {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
  }

  async get(sql, params = []) {
    const formattedSql = this._formatSql(sql);
    const res = await this.pool.query(
      formattedSql,
      Array.isArray(params) ? params : [params],
    );
    return res.rows[0];
  }

  async all(sql, params = []) {
    const formattedSql = this._formatSql(sql);
    const res = await this.pool.query(
      formattedSql,
      Array.isArray(params) ? params : [params],
    );
    return res.rows;
  }

  async run(sql, params = []) {
    const formattedSql = this._formatSql(sql);
    const res = await this.pool.query(
      formattedSql,
      Array.isArray(params) ? params : [params],
    );
    return {
      changes: res.rowCount,
      rowCount: res.rowCount,
    };
  }

  async exec(sql) {
    return await this.pool.query(sql);
  }
}

async function initDb() {
  if (dbInstance) return dbInstance;

  const connectionString = (process.env.DATABASE_URL || "").trim();

  // 1. NẾU CÓ DATABASE_URL -> DÙNG POSTGRESQL (NEON / CLOUD) KHÔNG BAO GIỜ MẤT DATA
  if (connectionString) {
    console.log(
      "🐘 [DATABASE] Phát hiện DATABASE_URL, đang kết nối PostgreSQL...",
    );
    const pool = new Pool({
      connectionString: connectionString,
      ssl: connectionString.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
    });

    dbInstance = new PostgresAdapter(pool);

    // 1.1 Khởi tạo bảng users
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        balance BIGINT DEFAULT 0,
        xp BIGINT DEFAULT 0,
        level INTEGER DEFAULT 1,
        last_daily BIGINT DEFAULT 0,
        last_xp_time BIGINT DEFAULT 0
      );
    `);

    // 1.2 Khởi tạo bảng warnings
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS warnings (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        guild_id VARCHAR(64) NOT NULL,
        moderator_id VARCHAR(64) NOT NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 1.3 Khởi tạo bảng giveaways
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS giveaways (
        message_id VARCHAR(64) PRIMARY KEY,
        channel_id VARCHAR(64) NOT NULL,
        guild_id VARCHAR(64) NOT NULL,
        prize TEXT NOT NULL,
        winners_count INTEGER DEFAULT 1,
        end_time BIGINT NOT NULL,
        hosted_by VARCHAR(64) NOT NULL,
        ended INTEGER DEFAULT 0,
        required_role_id VARCHAR(64) DEFAULT '',
        min_account_age INTEGER DEFAULT 0,
        min_server_age INTEGER DEFAULT 0,
        min_level INTEGER DEFAULT 0,
        min_messages INTEGER DEFAULT 0,
        min_participants INTEGER DEFAULT 0,
        rigged_winners TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS giveaway_participants (
        message_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        PRIMARY KEY (message_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS giveaway_history (
        id SERIAL PRIMARY KEY,
        message_id VARCHAR(64) NOT NULL,
        guild_id VARCHAR(64) NOT NULL,
        prize TEXT NOT NULL,
        winner_id VARCHAR(64) NOT NULL,
        winner_tag VARCHAR(128) NOT NULL,
        hosted_by VARCHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 1.4 Khởi tạo bảng guild_config
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS guild_config (
        guild_id VARCHAR(64) PRIMARY KEY,
        min_xp INTEGER DEFAULT 15,
        max_xp INTEGER DEFAULT 25,
        cooldown INTEGER DEFAULT 60,
        no_xp_channels TEXT DEFAULT '',
        no_xp_roles TEXT DEFAULT '',
        level_up_channel_id VARCHAR(64) DEFAULT '',
        xp_boost_roles TEXT DEFAULT '',
        xp_boost_multiplier INTEGER DEFAULT 2,
        welcome_channel_id VARCHAR(64) DEFAULT '',
        welcome_message TEXT DEFAULT '',
        welcome_banner_url TEXT DEFAULT '',
        dm_welcome_enabled INTEGER DEFAULT 0,
        dm_welcome_message TEXT DEFAULT '',
        leave_channel_id VARCHAR(64) DEFAULT '',
        leave_message TEXT DEFAULT '',
        leave_banner_url TEXT DEFAULT '',
        dm_leave_enabled INTEGER DEFAULT 0,
        dm_leave_message TEXT DEFAULT '',
        member_log_channel_id VARCHAR(64) DEFAULT '',
        auto_roles TEXT DEFAULT '',
        account_age_days INTEGER DEFAULT 0,
        verify_role_id VARCHAR(64) DEFAULT '',
        member_count_channel_id VARCHAR(64) DEFAULT '',
        server_log_channel_id VARCHAR(64) DEFAULT '',
        moderation_log_channel_id VARCHAR(64) DEFAULT '',
        permission_log_channel_id VARCHAR(64) DEFAULT '',
        role_log_channel_id VARCHAR(64) DEFAULT '',
        channel_log_channel_id VARCHAR(64) DEFAULT '',
        message_log_channel_id VARCHAR(64) DEFAULT '',
        voice_log_channel_id VARCHAR(64) DEFAULT '',
        invite_log_channel_id VARCHAR(64) DEFAULT '',
        security_log_channel_id VARCHAR(64) DEFAULT '',
        anti_nuke_log_channel_id VARCHAR(64) DEFAULT '',
        anti_raid_log_channel_id VARCHAR(64) DEFAULT '',
        bot_log_channel_id VARCHAR(64) DEFAULT ''
      );
    `);

    // Migration an toàn cho các cột mới nếu bảng đã có sẵn
    const columnsToMigrate = [
      { name: "welcome_banner_url", type: "TEXT DEFAULT ''" },
      { name: "leave_banner_url", type: "TEXT DEFAULT ''" },
      { name: "dm_welcome_enabled", type: "INTEGER DEFAULT 0" },
      { name: "dm_welcome_message", type: "TEXT DEFAULT ''" },
      { name: "dm_leave_enabled", type: "INTEGER DEFAULT 0" },
      { name: "dm_leave_message", type: "TEXT DEFAULT ''" },
      { name: "min_xp", type: "INTEGER DEFAULT 15" },
      { name: "max_xp", type: "INTEGER DEFAULT 25" },
      { name: "cooldown", type: "INTEGER DEFAULT 60" },
      { name: "no_xp_channels", type: "TEXT DEFAULT ''" },
      { name: "no_xp_roles", type: "TEXT DEFAULT ''" },
      { name: "level_up_channel_id", type: "TEXT DEFAULT ''" },
      { name: "xp_boost_roles", type: "TEXT DEFAULT ''" },
      { name: "xp_boost_multiplier", type: "INTEGER DEFAULT 2" },
      { name: "server_log_channel_id", type: "TEXT DEFAULT ''" },
      { name: "moderation_log_channel_id", type: "TEXT DEFAULT ''" },
      { name: "permission_log_channel_id", type: "TEXT DEFAULT ''" },
      { name: "role_log_channel_id", type: "TEXT DEFAULT ''" },
      { name: "channel_log_channel_id", type: "TEXT DEFAULT ''" },
      { name: "message_log_channel_id", type: "TEXT DEFAULT ''" },
      { name: "voice_log_channel_id", type: "TEXT DEFAULT ''" },
      { name: "invite_log_channel_id", type: "TEXT DEFAULT ''" },
      { name: "security_log_channel_id", type: "TEXT DEFAULT ''" },
      { name: "anti_nuke_log_channel_id", type: "TEXT DEFAULT ''" },
      { name: "anti_raid_log_channel_id", type: "TEXT DEFAULT ''" },
      { name: "bot_log_channel_id", type: "TEXT DEFAULT ''" },
    ];

    for (const col of columnsToMigrate) {
      try {
        await dbInstance.exec(
          `ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`,
        );
      } catch (err) {}
    }

    console.log(
      "✅ [DATABASE] Khởi tạo & Đồng bộ PostgreSQL (Cloud) thành công! Dữ liệu được bảo toàn vĩnh viễn.",
    );
    return dbInstance;
  }

  // 2. NẾU KHÔNG CÓ DATABASE_URL -> DÙNG SQLITE (KHI CHẠY LOCALHOST)
  console.log("📁 [DATABASE] Đang sử dụng tệp SQLite cục bộ (Localhost)...");
  dbInstance = await open({
    filename: path.join(__dirname, "../../database.sqlite"),
    driver: sqlite3.Database,
  });

  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      balance INTEGER DEFAULT 0,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      last_daily INTEGER DEFAULT 0,
      last_xp_time INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS warnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS giveaways (
      message_id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      prize TEXT NOT NULL,
      winners_count INTEGER DEFAULT 1,
      end_time INTEGER NOT NULL,
      hosted_by TEXT NOT NULL,
      ended INTEGER DEFAULT 0,
      required_role_id TEXT DEFAULT '',
      min_account_age INTEGER DEFAULT 0,
      min_server_age INTEGER DEFAULT 0,
      min_level INTEGER DEFAULT 0,
      min_messages INTEGER DEFAULT 0,
      min_participants INTEGER DEFAULT 0,
      rigged_winners TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS giveaway_participants (
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (message_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS giveaway_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      prize TEXT NOT NULL,
      winner_id TEXT NOT NULL,
      winner_tag TEXT NOT NULL,
      hosted_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id TEXT PRIMARY KEY,
      min_xp INTEGER DEFAULT 15,
      max_xp INTEGER DEFAULT 25,
      cooldown INTEGER DEFAULT 60,
      no_xp_channels TEXT DEFAULT '',
      no_xp_roles TEXT DEFAULT '',
      level_up_channel_id TEXT DEFAULT '',
      xp_boost_roles TEXT DEFAULT '',
      xp_boost_multiplier INTEGER DEFAULT 2,
      welcome_channel_id TEXT DEFAULT '',
      welcome_message TEXT DEFAULT '',
      welcome_banner_url TEXT DEFAULT '',
      dm_welcome_enabled INTEGER DEFAULT 0,
      dm_welcome_message TEXT DEFAULT '',
      leave_channel_id TEXT DEFAULT '',
      leave_message TEXT DEFAULT '',
      leave_banner_url TEXT DEFAULT '',
      dm_leave_enabled INTEGER DEFAULT 0,
      dm_leave_message TEXT DEFAULT '',
      member_log_channel_id TEXT DEFAULT '',
      auto_roles TEXT DEFAULT '',
      account_age_days INTEGER DEFAULT 0,
      verify_role_id TEXT DEFAULT '',
      member_count_channel_id TEXT DEFAULT '',
      server_log_channel_id TEXT DEFAULT '',
      moderation_log_channel_id TEXT DEFAULT '',
      permission_log_channel_id TEXT DEFAULT '',
      role_log_channel_id TEXT DEFAULT '',
      channel_log_channel_id TEXT DEFAULT '',
      message_log_channel_id TEXT DEFAULT '',
      voice_log_channel_id TEXT DEFAULT '',
      invite_log_channel_id TEXT DEFAULT '',
      security_log_channel_id TEXT DEFAULT '',
      anti_nuke_log_channel_id TEXT DEFAULT '',
      anti_raid_log_channel_id TEXT DEFAULT '',
      bot_log_channel_id TEXT DEFAULT ''
    );
  `);

  console.log("✅ [DATABASE] Khởi tạo SQLite thành công!");
  return dbInstance;
}

function getDb() {
  if (!dbInstance) throw new Error("[DATABASE] Chưa khởi tạo cơ sở dữ liệu!");
  return dbInstance;
}

module.exports = { initDb, getDb };
