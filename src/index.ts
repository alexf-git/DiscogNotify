import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const discogsToken = process.env.DISCOGS_TOKEN;

async function checkDiscogs() {
  try {
    const response = await axios.get(
      "https://api.discogs.com/database/search",
      {
        params: {
          artist: "Deftones",
          format: "Vinyl",
          type: "release",
        },
        headers: {
          Authorization: `Discogs token=${discogsToken}`,
          "User-Agent": "VinylAlertBot/1.0",
        },
      }
    );

    const results = response.data.results;

    if (results.length > 0) {
      const firstResult = results[0];

      await axios.post(webhookUrl!, {
        content: `New vinyl found: ${firstResult.title}\n${firstResult.uri}`,
      });

      console.log("Notification sent");
    } else {
      console.log("No results");
    }
  } catch (error) {
    console.error(error);
  }
}

checkDiscogs();