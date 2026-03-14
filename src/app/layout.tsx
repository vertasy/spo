import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VibeCheck – Discover Your Playlist Personality",
  description:
    "Connect your Spotify playlist and let AI reveal your unique vibe, personality, and moods. See what your music says about you in seconds."
};
import Head from "next/head";

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <Head>
        <meta
          property="og:title"
          content="VibeCheck – Discover Your Playlist Personality"
        />
        <meta
          property="og:description"
          content="Connect your Spotify playlist and let AI reveal your unique vibe, personality, and moods. See what your music says about you in seconds."
        />
        <meta property="og:image" content="/thumbnail.png" />
        <meta property="og:url" content="https://www.vertas.org" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="VibeCheck – Discover Your Playlist Personality"
        />
        <meta
          name="twitter:description"
          content="Connect your Spotify playlist and let AI reveal your unique vibe, personality, and moods. See what your music says about you in seconds."
        />
        <meta name="twitter:image" content="/thumbnail.jpg" />
      </Head>
      <body className={`${inter.className}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
