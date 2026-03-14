import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VibeCheck – Discover Your Playlist Personality",
  description:
    "Connect your Spotify playlist and let AI reveal your unique vibe, personality, and moods. See what your music says about you in seconds.",
  metadataBase: new URL("https://www.vertas.org"),
  openGraph: {
    title: "VibeCheck – Discover Your Playlist Personality",
    description:
      "Connect your Spotify playlist and let AI reveal your unique vibe, personality, and moods. See what your music says about you in seconds.",
    url: "https://www.vertas.org",
    siteName: "VibeCheck",
    images: [
      {
        url: "/thum.png",
        width: 1200,
        height: 630,
        alt: "VibeCheck Thumbnail"
      }
    ],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeCheck – Discover Your Playlist Personality",
    description:
      "Connect your Spotify playlist and let AI reveal your unique vibe, personality, and moods. See what your music says about you in seconds.",
    images: ["/thum.png"]
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
