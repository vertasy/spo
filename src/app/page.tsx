"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import axios from "axios";
import { Bricolage_Grotesque } from "next/font/google";
import { motion } from "framer-motion"; // 👈 import motion

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });

// Helper to extract playlist ID from various input formats
function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  // If it's a full Spotify URL
  const match = trimmed.match(/playlist\/([a-zA-Z0-9]+)/);
  if (match) return match[1];
  // Assume it's just the ID
  if (/^[a-zA-Z0-9]+$/.test(trimmed)) return trimmed;
  return null;
}

// Format milliseconds to mm:ss
function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function Home() {
  const [input, setInput] = useState("");
  const [playlistId, setPlaylistId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["playlist", playlistId],
    queryFn: async () => {
      if (!playlistId) throw new Error("No playlist ID");
      const response = await axios.get(
        `/api/playlist?playlistId=${playlistId}`
      );
      return response.data;
    },
    enabled: !!playlistId,
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractPlaylistId(input);
    if (id) {
      setPlaylistId(id);
    } else {
      alert("Invalid Spotify playlist URL or ID");
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-start items-center">
      <main className="h-fit w-full flex justify-center pt-10">
        <div className="w-full max-w-100 px-5">
          {/* Animated Hero Text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="hero_text w-full font-bri text-6xl font-[800] justify-center items-center mb-6 flex flex-col text-foreground"
          >
            <span className={`text-[100%]${bricolage.className}`}>
              Songs Say
            </span>
            <span className="font-black">Everything</span>
          </motion.div>
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-xl text-gray-600 font-medium text-center mb-8"
          >
            Find out what your playlist really says about you.
          </motion.h3>
          {/* Animated Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            onSubmit={handleSubmit}
            className="mb-8 flex flex-col gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste Spotify playlist URL or ID"
              className="w-full h-12 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              className="px-6 py-2 h-16 rounded-full bg-pink-500 text-white text-xl font-bold hover:bg-pink-700 transition"
            >
              {isLoading ? "Analyzing..." : "Analyze"}
            </motion.button>
          </motion.form>

          {isLoading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
              Failed to load playlist. Please check the ID and try again.
            </div>
          )}

          {data && <DataDisplay data={data} />}
        </div>
      </main>
      <footer className="py-2 flex justify-center px-4">
        <a
          target="_blank"
          className="underline"
          href="https://www.instagram.com/vertasoo"
        >
          Made with ❤️ by Diaa
        </a>
      </footer>
    </main>
  );
}

/*************  ✨ Windsurf Command ⭐  *************/
/**
 * A component that displays a playlist's details and AI-generated vibe text.
 * It uses a typing animation to display the vibe text.
 *
 * @param {object} data - The data object containing the playlist and AI data.
 * @returns {JSX.Element} - The rendered component.
 */
/*******  9c1aa7aa-3b2f-42a3-bd2d-53537370a29b  *******/
function DataDisplay({ data }: any) {
  const [text, setText] = useState("");

  useEffect(() => {
    let i = 0;
    const cleanText = data.ai.vibe
      .replace(/\n/g, " ")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .trim();

    const typing = setInterval(() => {
      setText(cleanText.slice(0, i + 1));
      i++;
      if (i >= cleanText.length) clearInterval(typing);
    }, 15);

    return () => clearInterval(typing);
  }, [data.ai]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col gap-5"
    >
      <div className="playlist_card w-full h-fit gap-4 flex border border-gray-300 rounded-4xl px-2 py-2">
        <img
          src={data.playlist.images[0].url}
          alt={data.playlist.name}
          className="w-25 max-w-25 min-w-25 h-25 min-h-25 max-h-25 rounded-3xl border border-gray-300 object-cover"
        />
        <div>
          <h2 className="text-3xl font-black mb-1 text-foreground w-full wrap-break-word">
            {data.playlist.name}
          </h2>
          <p className="text-foreground font-regular opacity-80 w-full wrap-break-word">
            {data.playlist.description}
          </p>
        </div>
      </div>

      <div className="border border-gray-300 rounded-4xl px-4 pb-10">
        <h1 className="font-black text-3xl pt-5 text-center wrap-break-word">
          "{data.ai.vibeTitle}"
        </h1>
        <h2 className="font-medium text-xl pt-5 text-center">{text}</h2>
      </div>
    </motion.div>
  );
}
