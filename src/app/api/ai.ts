/**
 * Convert playlist data into a CSV-like token text, optionally including genres.
 * @param {string|object} input - Playlist JSON string or parsed object.
 * @param {object} [artistGenres] - Map of artist ID -> array of genres.
 * @returns {string} - Newline-separated token lines.
 */
export function playlistToTokenText(
  input: string | any,
  artistGenres?: Record<string, string[]>
): string {
  const data = typeof input === "string" ? JSON.parse(input) : input;

  const lines: string[] = [];

  const tracks = data.tracks?.items || [];

  for (const item of tracks) {
    const t = item.track;
    if (!t) continue;

    const af = t.audio_features || {};

    const tempo = af.tempo ? Math.round(af.tempo) : 0;
    const pop = t.popularity ?? 0;
    const energy = af.energy ? Math.round(af.energy * 100) : 0;
    const dance = af.danceability ? Math.round(af.danceability * 100) : 0;
    const valence = af.valence ? Math.round(af.valence * 100) : 0;

    // ---- Get artist names ----
    let artistNamesStr = "";
    if (t.artists && t.artists.length) {
      const artistNames = t.artists.map((artist: any) => artist.name);
      artistNamesStr = artistNames.join(", ");
    }

    // ---- Get genres ----
    let genreStr = "";
    if (artistGenres && t.artists && t.artists.length) {
      const genresSet = new Set<string>();
      for (const artist of t.artists) {
        const artistId = artist.id;
        const genres = artistGenres[artistId];
        if (genres && genres.length) {
          genres.forEach((g) => genresSet.add(g));
        }
      }
      if (genresSet.size) {
        genreStr = Array.from(genresSet).join(",");
      }
    }

    // Handle quoting for fields that might contain commas
    const safeArtistNames = artistNamesStr.includes(",")
      ? `"${artistNamesStr}"`
      : artistNamesStr;
    const safeGenre = genreStr.includes(",") ? `"${genreStr}"` : genreStr;

    // Add artist names before the genres
    lines.push(
      `${tempo},${pop},${energy},${dance},${valence},${safeArtistNames},${safeGenre}`
    );
  }

  return lines.join("\n");
}

import axios from "axios";

export async function deepseekQuery(
  userText: string
): Promise<{ vibe: string; vibeTitle: string }> {
  try {
    const resp = await axios.post(
      "https://api.deepseek.com/chat/completions",
      {
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `Analyze this playlist to describe the user’s personality, thoughts, feelings, and overall vibe. Numbers are provided in this order: tempo, popularity, energy, danceability, valence. (tempo = BPM, the others range from 0–100. Valence means mood: 0 = sad, 100 = happy.)

Do NOT mention the numbers or the data directly. Speak directly to the user using “you” statements. Focus on who they are as a person, not on the music itself. Keep the vibe description short: 4–5 sentences. Make the tone playful, imaginative, and a little cute. Add a few fitting cute emojis naturally throughout the text, but don’t overuse them. Mention 1–2 singers or artists from the playlist and briefly describe how their vibe reflects your mood or personality.

Additionally, create a short, catchy vibe title that creatively captures the essence of the playlist, and include one emoji in the title that represents the vibe. Do not limit the title to a fixed style like 'AF'—be imaginative and varied. 

Output the result as a JSON object with two fields: "vibe" (the full description) and "vibeTitle" (the short, creative title with emoji). Example format: { "vibe": "Your vibe description here...", "vibeTitle": "Chill Vibes 😎" }`
          },
          { role: "user", content: userText }
        ],
        response_format: { type: "json_object" }, // enforce JSON output
        stream: false
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const content = resp.data.choices[0].message.content;
    // Parse the JSON response
    const parsed = JSON.parse(content);
    // Validate that the required fields exist
    if (
      typeof parsed.vibe !== "string" ||
      typeof parsed.vibeTitle !== "string"
    ) {
      throw new Error("Invalid JSON structure from Deepseek");
    }
    return parsed as { vibe: string; vibeTitle: string };
  } catch (err: any) {
    // If parsing fails or API error, throw a wrapped error
    throw new Error(`Deepseek API error: ${err.response?.data || err.message}`);
  }
}
