require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const commands = [];
const commandsPath = path.join(__dirname, "src/commands");

function getCommandFiles(dir) {
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

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// ID Server của bạn: 1411553223306641521
const GUILD_ID = "1411553223306641521";

(async () => {
  try {
    console.log(
      `🚀 Đang đăng ký ${commands.length} Slash Commands vào Guild (${GUILD_ID})...`,
    );

    // ⚡ Đăng ký trực tiếp vào Guild để hiện TỨC THÌ
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
      { body: commands },
    );

    console.log("✅ Đã đăng ký tức thì toàn bộ Slash Commands vào Server!");
  } catch (error) {
    console.error("❌ Lỗi deploy commands:", error);
  }
})();
