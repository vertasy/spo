// simulateBrowser.js
const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");

// Apply cookie jar support to axios
wrapper(axios);

// Create a persistent cookie jar
const jar = new CookieJar();

// Base headers common to all requests
const baseHeaders = {
  "accept-language": "en-US,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
  "sec-ch-ua":
    '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  origin: "https://www.chosic.com",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin" // will be overridden for Spotify
};

async function performHandshake() {
  console.log("🔹 Performing handshake...");
  const response = await axios.post(
    "https://www.chosic.com/api/tools/handshake/",
    null,
    {
      headers: {
        ...baseHeaders,
        accept: "*/*",
        "content-length": "0",
        referer: "https://www.chosic.com/spotify-playlist-exporter/",
        "x-requested-with": "XMLHttpRequest"
      },
      jar,
      withCredentials: true
    }
  );
  console.log("✅ Handshake completed. Status:", response.status);
}

async function performTRequest() {
  console.log("🔹 Performing /t/ request...");
  const response = await axios.post(
    "https://www.chosic.com/api/tools/t/",
    "app=playlist_analyzer",
    {
      headers: {
        ...baseHeaders,
        accept: "application/json, text/javascript, */*; q=0.01",
        app: "playlist_analyzer",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        referer: "https://www.chosic.com/spotify-playlist-exporter/",
        "x-requested-with": "XMLHttpRequest"
      },
      jar,
      withCredentials: true,
      // Tell axios to expect JSON (though it might not auto-parse if content-type is missing)
      responseType: "json"
    }
  );
  console.log("✅ /t/ request completed. Status:", response.status);

  // If the data is still a string, parse it manually
  if (typeof response.data === "string") {
    try {
      return JSON.parse(response.data);
    } catch (e) {
      console.error("❌ Failed to parse JSON response:", e.message);
      return response.data; // fallback to string
    }
  }
  return response.data; // already an object
}

async function performSpotifyRequest(spotifyToken) {
  console.log("🔹 Fetching Spotify playlist...");
  const spotifyHeaders = {
    ...baseHeaders,
    accept: "application/json, text/javascript, */*; q=0.01",
    authorization: `Bearer ${spotifyToken}`,
    "content-type": "application/json",
    referer: "https://www.chosic.com/",
    "sec-fetch-site": "cross-site"
  };

  try {
    const response = await axios.get(
      "https://api.spotify.com/v1/playlists/4PejV186DQqYa0DsrpIaUD",
      {
        headers: spotifyHeaders,
        jar, // cookies not needed but kept for consistency
        withCredentials: false
      }
    );
    console.log("✅ Spotify request completed. Status:", response.status);
    console.log("Playlist data:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.error(
        "❌ Spotify request failed:",
        error.response.status,
        error.response.data
      );
    } else {
      console.error("❌ Spotify request error:", error.message);
    }
  }
}

async function main() {
  try {
    await performHandshake();

    const tResponseData = await performTRequest();
    console.log("Response from /t/:", tResponseData);
    console.log("Type of response:", typeof tResponseData);
    if (typeof tResponseData === "object") {
      console.log("Keys:", Object.keys(tResponseData));
    }

    // Extract Spotify token – it's under "token"
    const spotifyToken = tResponseData?.token;
    if (!spotifyToken) {
      console.error("Full response:", tResponseData);
      throw new Error("Could not extract Spotify token from /t/ response");
    }
    console.log(
      "🔑 Extracted Spotify token:",
      spotifyToken.substring(0, 20) + "..."
    );

    await performSpotifyRequest(spotifyToken);
  } catch (error) {
    console.error("❌ Sequence failed:", error.message);
  }
}

main();
