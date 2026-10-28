const { Client, GatewayIntentBits, Collection } = require("discord.js");
const db = require("./database/client");

class SanguinisBot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
      ],
    });

    this.client.commands = new Collection();
  }

  async start() {
    await db.initDb();
    require("./handlers/commandHandler")(this.client);
    require("./handlers/eventHandler")(this.client);
    await this.client.login(process.env.DISCORD_TOKEN);
    console.log(`[BOT] Đã đăng nhập thành công!`);
  }
}

const botInstance = new SanguinisBot();

// Export botInstance cho index.js và client cho server.js
module.exports = {
  botInstance,
  client: botInstance.client,
};
