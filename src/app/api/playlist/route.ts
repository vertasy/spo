// app/api/spotify-playlist/route.ts
import { NextResponse } from "next/server";
import axios, { AxiosResponse } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

// Enable cookie jar support for axios (modifies the axios instance)
wrapper(axios);

// Type for the response from /t/ endpoint
interface TokenResponse {
  token: string;
  time?: number;
}

// Base headers that mimic a Chrome browser on Windows
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
} as const;

export async function GET() {
  // Create a fresh cookie jar for this request
  const jar = new CookieJar();

  try {
    // 1. Handshake – no response body needed, just sets cookies
    console.log("Performing handshake...");
    await axios.post("https://www.chosic.com/api/tools/handshake/", null, {
      headers: {
        ...baseHeaders,
        accept: "*/*",
        "content-length": "0",
        referer: "https://www.chosic.com/spotify-playlist-exporter/",
        "x-requested-with": "XMLHttpRequest"
      },
      jar,
      withCredentials: true
    });

    // 2. /t/ request – obtains Spotify token
    console.log("Performing /t/ request...");
    const tResponse: AxiosResponse<unknown> = await axios.post(
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
        responseType: "json" // hint axios to parse JSON
      }
    );

    // Parse response if it came as string (safety net)
    let tData: TokenResponse;
    if (typeof tResponse.data === "string") {
      tData = JSON.parse(tResponse.data) as TokenResponse;
    } else {
      tData = tResponse.data as TokenResponse;
    }

    const spotifyToken = tData?.token;
    if (!spotifyToken || typeof spotifyToken !== "string") {
      throw new Error("No valid Spotify token found in /t/ response");
    }

    // 3. Spotify API request
    console.log("Fetching Spotify playlist...");
    const spotifyResponse = await axios.get(
      "https://api.spotify.com/v1/playlists/4PejV186DQqYa0DsrpIaUD",
      {
        headers: {
          ...baseHeaders,
          accept: "application/json, text/javascript, */*; q=0.01",
          authorization: `Bearer ${spotifyToken}`,
          "content-type": "application/json",
          referer: "https://www.chosic.com/",
          "sec-fetch-site": "cross-site"
        },
        // No cookies needed for Spotify API
        withCredentials: false
      }
    );

    // Return the playlist data (you can define a stricter type if desired)
    return NextResponse.json(spotifyResponse.data);
  } catch (error: unknown) {
    console.error("API route error:", error);

    // Type-safe error handling
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const message = error.response?.data || error.message;
      return NextResponse.json({ error: message }, { status });
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Unknown error occurred" },
      { status: 500 }
    );
  }
}
