import "dotenv/config";
import {
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
} from "discord.js";
import {
  DiscogsMarketplace,
  type SearchResult,
} from "discogs-marketplace-api-nodejs";

const discordToken = process.env.DISCORD_BOT_TOKEN;

if (!discordToken) {
  throw new Error("Missing DISCORD_BOT_TOKEN in .env");
}

type DiscogsListing = SearchResult["items"][number];

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

async function searchMarketplace(
  artist: string
): Promise<SearchResult["items"]> {
  const result = await DiscogsMarketplace.search({
    query: artist,
    sort: "listed,desc",
    limit: 25,
  });

  return result.items.filter(
    (item) =>
      item.isAvailable &&
      item.formats.some((format) =>
        format.toLowerCase().includes("vinyl")
      )
  );
}

function createListingEmbed(
  listing: DiscogsListing,
  artist: string
): EmbedBuilder {
  const artistNames = listing.artists
    .map((artistInfo) => artistInfo.name)
    .filter(Boolean)
    .join(", ");

  const title = [
    artistNames || artist,
    listing.release.name || "Vinyl release",
  ].join(" — ");

  const conditions = [
    listing.condition.media.full
      ? `Media: ${listing.condition.media.full}`
      : undefined,
    listing.condition.sleeve.full
      ? `Sleeve: ${listing.condition.sleeve.full}`
      : undefined,
  ].filter((value): value is string => Boolean(value));

  const details = [
    `**Price:** ${listing.price.base}`,
    ...conditions,
    `**Seller:** ${listing.seller.name}`,
    `**Ships from:** ${listing.country.name}`,
    listing.release.year
      ? `**Year:** ${listing.release.year}`
      : undefined,
  ].filter((value): value is string => Boolean(value));

  return new EmbedBuilder()
    .setTitle(title.slice(0, 256))
    .setURL(listing.url)
    .setDescription(
      details.join("\n") || "Listing details are available on Discogs."
    )
    .setThumbnail(listing.imageUrl ?? null);
}

function isExpiredInteractionError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 10062
  );
}

async function safeReply(
  interaction: {
    reply: (...args: any[]) => Promise<unknown>;
  },
  payload: any
): Promise<void> {
  try {
    await interaction.reply(payload);
  } catch (error: unknown) {
    if (isExpiredInteractionError(error)) {
      console.warn("Ignoring expired interaction during reply.");
      return;
    }
    throw error;
  }
}

async function safeEditReply(
  interaction: {
    editReply: (...args: any[]) => Promise<unknown>;
  },
  payload: any
): Promise<void> {
  try {
    await interaction.editReply(payload);
  } catch (error: unknown) {
    if (isExpiredInteractionError(error)) {
      console.warn("Ignoring expired interaction during editReply.");
      return;
    }
    throw error;
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (interaction.commandName !== "vinyl") {
    return;
  }

  const artist = interaction.options
    .getString("artist", true)
    .trim();

  if (!artist) {
    await safeReply(interaction, {
      content: "Please provide an artist name.",
      ephemeral: true,
    });
    return;
  }

  try {
    await interaction.deferReply();
  } catch (error: unknown) {
    if (isExpiredInteractionError(error)) {
      console.warn("Ignoring expired interaction before deferReply.");
      return;
    }
    throw error;
  }

  try {
    console.log(`Searching Discogs Marketplace for: ${artist}`);

    const listings = await searchMarketplace(artist);

    console.dir(listings[0], { depth: null });

    if (listings.length === 0) {
      await safeEditReply(
        interaction,
        `No vinyl listings were found for **${artist}**. Try another artist name.`
      );
      return;
    }

    const embeds = listings.slice(0, 10).map((listing) =>
      createListingEmbed(listing, artist)
    );

    await safeEditReply(interaction, {
      content: `Found ${listings.length} vinyl listing(s) matching **${artist}**:`,
      embeds,
    });
  } catch (error: unknown) {
    console.error("Vinyl search failed:", error);

    if (isExpiredInteractionError(error)) {
      console.warn("Ignoring expired interaction after the search attempt.");
      return;
    }

    await safeEditReply(
      interaction,
      "I couldn't complete the Discogs search. Please try again later."
    );
  }
});

client.login(discordToken).catch((error: unknown) => {
  console.error("Failed to log into Discord:", error);
  process.exitCode = 1;
});