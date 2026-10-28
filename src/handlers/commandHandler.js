const fs = require("fs");
const path = require("path");

module.exports = (client) => {
  client.commands = client.commands || new Map();
  const commandsPath = path.join(__dirname, "../commands");

  // Hàm quét đệ quy tất cả các thư mục con trong src/commands
  function loadCommands(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        loadCommands(filePath); // Đi sâu vào thư mục con (utility, economy, moderation)
      } else if (file.endsWith(".js")) {
        try {
          const command = require(filePath);
          if ("data" in command && "execute" in command) {
            client.commands.set(command.data.name, command);
            console.log(
              `[COMMANDS] Đã tải lệnh thành công: /${command.data.name}`,
            );
          }
        } catch (err) {
          console.error(`❌ Lỗi khi nạp lệnh tại ${filePath}:`, err);
        }
      }
    }
  }

  loadCommands(commandsPath);
  console.log(
    `[HANDLERS] Tổng số Slash Commands đã nạp vào Bot: ${client.commands.size}`,
  );
};
