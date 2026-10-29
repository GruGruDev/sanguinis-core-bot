const { Events } = require("discord.js");
const db = require("../database/client");

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    // Chỉ xử lý nếu có sự thay đổi về danh sách Roles
    if (oldMember.roles.cache.size >= newMember.roles.cache.size) return;

    const database = db.getDb();
    if (!database) return;

    // Lấy cấu hình Server từ Database
    const config = await database.get(
      "SELECT auto_roles, verify_role_id FROM guild_config WHERE guild_id = ?",
      [newMember.guild.id],
    );
    if (!config) return;

    // Danh sách các auto role cần thu hồi (ví dụ: Outsider)
    const autoRoles = (config.auto_roles || "")
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    if (autoRoles.length === 0) return;

    // Kiểm tra xem thành viên có đang giữ auto-role không
    const matchingAutoRoles = autoRoles.filter((roleId) =>
      newMember.roles.cache.has(roleId),
    );
    if (matchingAutoRoles.length === 0) return;

    // Tìm các role mới vừa được thêm vào
    const addedRoles = newMember.roles.cache.filter(
      (role) => !oldMember.roles.cache.has(role.id),
    );

    // Kiểm tra xem role mới thêm có phải là role thành viên/chính thức (khác với auto_role) hay không
    const receivedOfficialRole = addedRoles.some(
      (role) => !autoRoles.includes(role.id) && role.id !== newMember.guild.id,
    );

    // Nếu vừa được cấp một role chính thức -> Tiến hành thu hồi toàn bộ Auto-Role
    if (receivedOfficialRole) {
      try {
        await newMember.roles.remove(
          matchingAutoRoles,
          "Tự động thu hồi Auto-Role khi thành viên nhận Role chính thức",
        );
        console.log(
          `🛡️ [ROLE SYNC] Đã tự động gỡ Auto-Role [${matchingAutoRoles.join(", ")}] khỏi ${newMember.user.tag}`,
        );
      } catch (err) {
        console.error(
          `⚠️ [ROLE SYNC ERROR] Không thể gỡ Auto-Role cho ${newMember.user.tag}:`,
          err.message,
        );
      }
    }
  },
};
