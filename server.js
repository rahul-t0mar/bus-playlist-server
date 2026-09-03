import "dotenv/config";

import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL;

const allowedOrigins = [
  "http://localhost:5173",
  "https://bus-playlist-client.vercel.app",
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  }),
);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(express.json());

const YT_API_KEY = process.env.YT_API_KEY;
const PLAYLIST_ID = "PLLJl2b09clvg";

let videos = [];
let currentIndex = 0;
let shuffleOrder = null;

async function loadPlaylist() {
  try {
    let allItems = [];
    let pageToken = "";

    do {
      const url =
        `https://www.googleapis.com/youtube/v3/playlistItems` +
        `?part=snippet,contentDetails` +
        `&maxResults=50` +
        `&playlistId=${PLAYLIST_ID}` +
        `&key=${YT_API_KEY}` +
        (pageToken ? `&pageToken=${pageToken}` : "");

      const response = await fetch(url);
      const data = await response.json();

      if (!data.items) {
        console.error("YouTube API error:", data);
        break;
      }

      allItems = allItems.concat(data.items);
      pageToken = data.nextPageToken || "";
    } while (pageToken);

    videos = allItems.map((item) => ({
      videoId: item.contentDetails.videoId,
      title: item.snippet.title,
    }));

    console.log(`Loaded ${videos.length} songs`);
  } catch (err) {
    console.error("Failed to load playlist:", err);
  }
}

function getOrderedIndex(i) {
  return shuffleOrder ? shuffleOrder[i] : i;
}

function currentVideo() {
  if (!videos.length) return null;

  const realIndex = getOrderedIndex(currentIndex);

  return {
    ...videos[realIndex],
    index: currentIndex,
    total: videos.length,
  };
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/playlist/current", (req, res) => {
  res.json(currentVideo());
});

app.get("/api/playlist/next", (req, res) => {
  if (!videos.length) return res.json(null);

  currentIndex = (currentIndex + 1) % videos.length;

  res.json(currentVideo());
});

app.get("/api/playlist/previous", (req, res) => {
  if (!videos.length) return res.json(null);

  currentIndex = (currentIndex - 1 + videos.length) % videos.length;

  res.json(currentVideo());
});

app.post("/api/playlist/shuffle", (req, res) => {
  const { enabled } = req.body;

  if (enabled) {
    shuffleOrder = [...Array(videos.length).keys()].sort(
      () => Math.random() - 0.5,
    );
  } else {
    shuffleOrder = null;
  }

  currentIndex = 0;

  res.json(currentVideo());
});

// Load playlist
loadPlaylist();

// Export for Vercel
export default app;
