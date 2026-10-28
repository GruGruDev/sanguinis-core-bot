require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const commands = [];
const commandsPath = path.join(__dirname, "src/commands");

function getCommandFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getCommandFiles(filePath);
    } else if (file.endsWith(".js")) {
      const command = require(filePath);
      if ("data" in command && "execute" in command) {
        commands.push(command.data.toJSON());
      }
    }
  }
}

getCommandFiles(commandsPath);

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID || "1411553223306641521";

if (!token || !clientId) {
  console.error(
    "❌ Thiếu DISCORD_TOKEN hoặc CLIENT_ID trong Environment Variables!",
  );
  process.exit(0); // Vẫn thoát 0 để index.js tiếp tục chạy
}

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log(
      `🚀 Đang đăng ký ${commands.length} Slash Commands vào Guild (${guildId})...`,
    );

    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });

    console.log("✅ Đã đăng ký tức thì toàn bộ Slash Commands vào Server!");
  } catch (error) {
    console.error("❌ Lỗi deploy commands:", error.message || error);
  } finally {
    // 🔴 BẮT BUỘC: Ngắt tiến trình để nhường quyền cho lệnh tiếp theo chạy
    process.exit(0);
  }
})();
