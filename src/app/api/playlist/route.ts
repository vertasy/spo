import { NextRequest, NextResponse } from "next/server";
import axios, { AxiosResponse } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import fs from "fs/promises";
import path from "path";
import { deepseekQuery, playlistToTokenText } from "../ai";

wrapper(axios);

const CACHE_DIR = path.join(process.cwd(), "cache");
const TOKEN_CACHE_FILE = path.join(CACHE_DIR, "spotify_token.json");
const REQUEST_DELAY_MS = 200; // delay between pagination/artist/features requests
const MAX_TRACKS = 100; // maximum number of tracks to return
const ARTIST_BATCH_SIZE = 50; // Spotify allows up to 50 IDs per request for artists
const FEATURE_BATCH_SIZE = 100; // Spotify allows up to 100 IDs per request for audio features

interface CachedToken {
  token: string;
  expiry: number;
}

interface TokenResponse {
  token: string;
  time?: number;
}

async function ensureCacheDir() {
  try {
    await fs.access(CACHE_DIR);
  } catch {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  }
}

async function getCachedToken(): Promise<CachedToken | null> {
  try {
    await ensureCacheDir();
    const data = await fs.readFile(TOKEN_CACHE_FILE, "utf-8");
    const cached: CachedToken = JSON.parse(data);
    if (cached.expiry > Date.now()) return cached;
    await fs.unlink(TOKEN_CACHE_FILE).catch(() => {});
  } catch {}
  return null;
}

async function setCachedToken(token: string, expiresInSeconds: number) {
  try {
    await ensureCacheDir();
    const expiry = Date.now() + expiresInSeconds * 1000;
    const cached: CachedToken = { token, expiry };
    await fs.writeFile(TOKEN_CACHE_FILE, JSON.stringify(cached), "utf-8");
  } catch (error) {
    console.warn("Failed to write token to cache:", error);
  }
}

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
  "sec-fetch-site": "same-origin"
} as const;

async function fetchFreshToken(): Promise<string> {
  const jar = new CookieJar();

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
      responseType: "json"
    }
  );

  const tData =
    typeof tResponse.data === "string"
      ? (JSON.parse(tResponse.data) as TokenResponse)
      : (tResponse.data as TokenResponse);

  const spotifyToken = tData?.token;
  if (!spotifyToken || typeof spotifyToken !== "string") {
    throw new Error("No valid Spotify token found");
  }

  const expiresIn = tData.time ?? 3600;
  await setCachedToken(spotifyToken, expiresIn);
  return spotifyToken;
}

async function getValidToken(retries = 2): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const cached = await getCachedToken();
      if (cached) return cached.token;
      return await fetchFreshToken();
    } catch (error) {
      console.error(`Token attempt ${attempt} failed:`, error);
      if (attempt === retries) throw new Error("Failed to obtain token");
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw new Error("Unreachable");
}

function stripAvailableMarkets(obj: any) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach(stripAvailableMarkets);
  } else {
    Object.keys(obj).forEach((key) => {
      if (key === "available_markets") {
        delete obj[key];
      } else {
        stripAvailableMarkets(obj[key]);
      }
    });
  }
}

/**
 * Fetch pages of playlist tracks until we have at least maxTracks or no more pages.
 * Returns a paging object with items truncated to maxTracks if necessary.
 */
async function fetchAllTracks(
  firstPageTracks: any,
  token: string,
  maxTracks = MAX_TRACKS
): Promise<any> {
  let allItems = [...(firstPageTracks.items || [])];
  let nextUrl = firstPageTracks.next;

  // If first page already meets or exceeds limit, slice and return
  if (allItems.length >= maxTracks) {
    return {
      ...firstPageTracks,
      items: allItems.slice(0, maxTracks),
      next: null
    };
  }

  while (nextUrl && allItems.length < maxTracks) {
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));

    try {
      const response = await axios.get(nextUrl, {
        headers: {
          ...baseHeaders,
          accept: "application/json, text/javascript, */*; q=0.01",
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          referer: "https://www.chosic.com/",
          "sec-fetch-site": "cross-site"
        },
        withCredentials: false
      });

      const pageData = response.data;
      if (pageData.items) {
        allItems = allItems.concat(pageData.items);
      }
      nextUrl = pageData.next;

      // If we now have reached or exceeded maxTracks, trim and stop
      if (allItems.length >= maxTracks) {
        allItems = allItems.slice(0, maxTracks);
        nextUrl = null;
      }
    } catch (error) {
      console.error("Error fetching next page:", error);
      break;
    }
  }

  return {
    ...firstPageTracks,
    items: allItems,
    next: null
  };
}

/**
 * Fetch artist details for a list of IDs (up to 50 per request, batched).
 */
async function fetchArtists(
  artistIds: string[],
  token: string
): Promise<any[]> {
  if (artistIds.length === 0) return [];

  const uniqueIds = [...new Set(artistIds)];
  const artists: any[] = [];

  // Split into batches of ARTIST_BATCH_SIZE
  for (let i = 0; i < uniqueIds.length; i += ARTIST_BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + ARTIST_BATCH_SIZE);
    const idsParam = batch.join(",");

    // Add delay between batches to avoid rate limiting
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
    }

    try {
      const response = await axios.get(
        `https://api.spotify.com/v1/artists?ids=${idsParam}`,
        {
          headers: {
            ...baseHeaders,
            accept: "application/json, text/javascript, */*; q=0.01",
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            referer: "https://www.chosic.com/",
            "sec-fetch-site": "cross-site"
          },
          withCredentials: false
        }
      );

      // The response contains an "artists" array
      if (response.data && response.data.artists) {
        artists.push(...response.data.artists);
      }
    } catch (error) {
      console.error("Error fetching artists batch:", error);
      // If we get a 401, re-throw so the outer handler can retry
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw error;
      }
      // For other errors, we might still want to continue with partial data
    }
  }

  return artists;
}

/**
 * Fetch audio features for a list of track IDs (up to 100 per request, batched).
 */
async function fetchAudioFeatures(
  trackIds: string[],
  token: string
): Promise<any[]> {
  if (trackIds.length === 0) return [];

  const uniqueIds = [...new Set(trackIds)];
  const features: any[] = [];

  for (let i = 0; i < uniqueIds.length; i += FEATURE_BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + FEATURE_BATCH_SIZE);
    const idsParam = batch.join(",");

    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
    }

    try {
      const response = await axios.get(
        `https://api.spotify.com/v1/audio-features?ids=${idsParam}`,
        {
          headers: {
            ...baseHeaders,
            accept: "application/json, text/javascript, */*; q=0.01",
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            referer: "https://www.chosic.com/",
            "sec-fetch-site": "cross-site"
          },
          withCredentials: false
        }
      );

      // The response contains an "audio_features" array (may include nulls for missing tracks)
      if (response.data && response.data.audio_features) {
        // Filter out nulls and add to our list
        const valid = response.data.audio_features.filter(
          (f: any) => f !== null
        );
        features.push(...valid);
      }
    } catch (error) {
      console.error("Error fetching audio features batch:", error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw error;
      }
      // Continue with partial data if non‑401 error
    }
  }

  return features;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const playlistId = searchParams.get("playlistId");

  if (!playlistId) {
    return NextResponse.json(
      { error: "Missing playlistId query parameter" },
      { status: 400 }
    );
  }

  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    try {
      const token = await getValidToken();

      // 1. Fetch the main playlist data (includes first page of tracks)
      const spotifyResponse = await axios.get(
        `https://api.spotify.com/v1/playlists/${playlistId}`,
        {
          headers: {
            ...baseHeaders,
            accept: "application/json, text/javascript, */*; q=0.01",
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            referer: "https://www.chosic.com/",
            "sec-fetch-site": "cross-site"
          },
          withCredentials: false
        }
      );

      let playlistData = spotifyResponse.data;

      // 2. If there are more tracks, fetch additional pages (up to MAX_TRACKS)
      if (playlistData.tracks && playlistData.tracks.next) {
        console.log(
          "Playlist has multiple pages, fetching up to",
          MAX_TRACKS,
          "tracks..."
        );
        playlistData.tracks = await fetchAllTracks(
          playlistData.tracks,
          token,
          MAX_TRACKS
        );
      } else if (playlistData.tracks) {
        // Even if no next, ensure we don't exceed limit (if first page already over limit)
        if (
          playlistData.tracks.items &&
          playlistData.tracks.items.length > MAX_TRACKS
        ) {
          playlistData.tracks.items = playlistData.tracks.items.slice(
            0,
            MAX_TRACKS
          );
          playlistData.tracks.next = null;
        }
      }

      // 3. Remove the duplicate top-level "items" field if it exists (not part of Spotify spec)
      if (playlistData.items) {
        delete playlistData.items;
      }

      // 4. Collect all unique artist IDs from the tracks
      const artistIds: string[] = [];
      const trackIds: string[] = []; // for audio features
      if (playlistData.tracks && playlistData.tracks.items) {
        for (const item of playlistData.tracks.items) {
          const track = item.track;
          if (track) {
            // Artist IDs
            if (track.artists && Array.isArray(track.artists)) {
              for (const artist of track.artists) {
                if (artist.id) artistIds.push(artist.id);
              }
            }
            // Track ID for audio features
            if (track.id) trackIds.push(track.id);
          }
        }
      }

      // 5. Fetch artist details if we have any IDs
      if (artistIds.length > 0) {
        console.log(
          `Fetching details for ${artistIds.length} unique artists...`
        );
        const artists = await fetchArtists(artistIds, token);
        playlistData.artists = artists;
      }

      // 6. Fetch audio features for tracks
      if (trackIds.length > 0) {
        console.log(`Fetching audio features for ${trackIds.length} tracks...`);
        const features = await fetchAudioFeatures(trackIds, token);

        // Create a map for quick lookup by track ID
        const featuresMap = new Map<string, any>();
        for (const feat of features) {
          if (feat && feat.id) {
            featuresMap.set(feat.id, feat);
          }
        }

        // Attach audio features to each track item
        for (const item of playlistData.tracks.items) {
          const track = item.track;
          if (track && track.id && featuresMap.has(track.id)) {
            track.audio_features = featuresMap.get(track.id);
          }
        }
      }

      // 7. Strip all available_markets fields
      stripAvailableMarkets(playlistData);
      const artistGenres: any = {};
      if (playlistData.artists && Array.isArray(playlistData.artists)) {
        playlistData.artists.forEach((artist: any) => {
          // Store the genres array for each artist ID
          artistGenres[artist.id] = artist.genres || [];
        });
      }

      const aiData = playlistToTokenText(playlistData, artistGenres);
      const aiSummary = await deepseekQuery(aiData);
      return NextResponse.json({
        ai: aiSummary,
        playlist: playlistData
      });
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.log("Token expired, invalidating cache and retrying...");
        await fs.unlink(TOKEN_CACHE_FILE).catch(() => {});
        attempts++;
        continue;
      }

      console.error("API route error:", error);
      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 500;
        const message = error.response?.data || error.message;
        return NextResponse.json({ error: message }, { status });
      }
      if (error instanceof Error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ error: "Unknown error" }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: "Failed to fetch playlist after multiple attempts" },
    { status: 500 }
  );
}
