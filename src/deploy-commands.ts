import "dotenv/config";
import {
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId || !guildId) {
  throw new Error(
    "Missing DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, or DISCORD_GUILD_ID in .env"
  );
}

const commands = [
  new SlashCommandBuilder()
    .setName("vinyl")
    .setDescription("Find vinyl currently for sale on Discogs")
    .addStringOption((option) =>
      option
        .setName("artist")
        .setDescription("Artist to search for")
        .setRequired(true)
        .setMaxLength(100)
    ),
];

const rest = new REST({ version: "10" }).setToken(token);

async function deployCommands(): Promise<void> {
  await rest.put(
    Routes.applicationGuildCommands(clientId, guildId),
    {
      body: commands.map((command) => command.toJSON()),
    }
  );

  console.log("Successfully registered /vinyl.");
}

deployCommands().catch((error: unknown) => {
  console.error("Failed to register Discord commands:", error);
  process.exitCode = 1;
});
