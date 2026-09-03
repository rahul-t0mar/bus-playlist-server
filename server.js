import "dotenv/config";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.YT_API_KEY;
const PLAYLIST_ID = "PLLJl2b09clvg";

const allowedOrigins = ["https://bus-playlist-client.vercel.app"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      if (
        origin.endsWith(".vercel.app") &&
        origin.includes("bus-playlist-client")
      ) {
        return callback(null, true);
      }

      console.log("CORS blocked:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);

app.use(express.json());

let videos = [];
let currentIndex = 0;
let shuffleOrder = null;

// Load playlist

let playlistPromise = null;

async function loadPlaylist() {
  const url =
    `https://www.googleapis.com/youtube/v3/playlistItems` +
    `?part=snippet&playlistId=${PLAYLIST_ID}&maxResults=50&key=${YT_API_KEY}`;

  let allVideos = [];
  let nextPageToken = "";

  do {
    const response = await fetch(`${url}&pageToken=${nextPageToken}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`YouTube API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    const pageVideos = data.items
      .filter((item) => item.snippet?.resourceId?.videoId)
      .map((item) => ({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
      }));

    allVideos.push(...pageVideos);

    nextPageToken = data.nextPageToken || "";
  } while (nextPageToken);

  videos = allVideos;

  console.log(`Loaded ${videos.length} videos from YouTube`);

  return videos;
}

function ensurePlaylistLoaded() {
  if (!playlistPromise) {
    playlistPromise = loadPlaylist().catch((error) => {
      console.error("Failed to load playlist:", error);
      playlistPromise = null;
      throw error;
    });
  }

  return playlistPromise;
}

// Health
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Current
app.get("/api/playlist/current", (req, res) => {
  if (!videos.length) {
    return res.json(null);
  }

  res.json(videos[currentIndex]);
});

// Next
app.get("/api/playlist/next", (req, res) => {
  if (!videos.length) {
    return res.json(null);
  }

  currentIndex = (currentIndex + 1) % videos.length;

  res.json(videos[currentIndex]);
});

// Previous
app.get("/api/playlist/previous", (req, res) => {
  if (!videos.length) {
    return res.json(null);
  }

  currentIndex = (currentIndex - 1 + videos.length) % videos.length;

  res.json(videos[currentIndex]);
});

// Shuffle
app.post("/api/playlist/shuffle", (req, res) => {
  if (!videos.length) {
    return res.json(null);
  }

  const shuffled = [...videos];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  shuffleOrder = shuffled;
  currentIndex = 0;

  res.json(shuffleOrder[currentIndex]);
});

loadPlaylist();

export default app;
