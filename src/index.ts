import "dotenv/config";
import axios from "axios";
import {
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
} from "discord.js";

const discordToken = process.env.DISCORD_BOT_TOKEN;
const discogsToken = process.env.DISCOGS_TOKEN;

if (!discordToken || !discogsToken) {
  throw new Error(
    "Missing DISCORD_BOT_TOKEN or DISCOGS_TOKEN in .env"
  );
}

interface DiscogsListing {
  id: number;
  price?: {
    value?: number;
    currency?: string;
  };
  condition?: string;
  sleeve_condition?: string;
  ships_from?: string;
  seller?: {
    username?: string;
  };
  release?: {
    title?: string;
    artist?: string;
    year?: number;
    format?: string[];
  };
}

interface DiscogsSearchResponse {
  listings: DiscogsListing[];
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

async function searchMarketplace(
  artist: string
): Promise<DiscogsListing[]> {
  const response = await axios.get<DiscogsSearchResponse>(
    "https://api.discogs.com/marketplace/search",
    {
      params: {
        artist,
        format: "Vinyl",
        type: "release",
        per_page: 10,
        page: 1,
      },
      headers: {
        Authorization: `Discogs token=${discogsToken}`,
        "User-Agent": "DiscogNotify/1.0",
      },
      timeout: 15000,
    }
  );

  return response.data.listings ?? [];
}

function createListingEmbed(
  listing: DiscogsListing,
  artist: string
): EmbedBuilder {
  const release = listing.release;
  const title = [
    release?.artist ?? artist,
    release?.title ?? "Vinyl release",
  ].join(" — ");

  const url = `https://www.discogs.com/sell/item/${listing.id}`;

  const price = listing.price
    ? `${listing.price.currency ?? ""} ${listing.price.value ?? "Unknown"}`
    : "Not provided";

  const conditions = [
    listing.condition
      ? `Media: ${listing.condition}`
      : undefined,
    listing.sleeve_condition
      ? `Sleeve: ${listing.sleeve_condition}`
      : undefined,
  ].filter((value): value is string => Boolean(value));

  const details = [
    `**Price:** ${price}`,
    ...conditions,
    listing.seller?.username
      ? `**Seller:** ${listing.seller.username}`
      : undefined,
    listing.ships_from
      ? `**Ships from:** ${listing.ships_from}`
      : undefined,
    release?.year
      ? `**Year:** ${release.year}`
      : undefined,
  ].filter((value): value is string => Boolean(value));

  return new EmbedBuilder()
    .setTitle(title.slice(0, 256))
    .setURL(url)
    .setDescription(
      details.join("\n") || "Listing details are available on Discogs."
    );
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
    await interaction.reply({
      content: "Please provide an artist name.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    console.log(`Searching Discogs Marketplace for: ${artist}`);

    const listings = await searchMarketplace(artist);

    if (listings.length === 0) {
      await interaction.editReply(
        `No vinyl listings were found for **${artist}**. Try another artist name.`
      );
      return;
    }

    const embeds = listings.slice(0, 10).map((listing) =>
      createListingEmbed(listing, artist)
    );

    await interaction.editReply({
      content: `Found ${listings.length} vinyl listing(s) matching **${artist}**:`,
      embeds,
    });
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error(
        "Discogs API request failed:",
        error.response?.status,
        error.response?.data ?? error.message
      );
    } else {
      console.error("Vinyl search failed:", error);
    }

    await interaction.editReply(
      "I couldn't complete the Discogs search. Please try again later."
    );
  }
});

client.login(discordToken).catch((error: unknown) => {
  console.error("Failed to log into Discord:", error);
  process.exitCode = 1;
});