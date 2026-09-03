import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import fetch from "node-fetch";

const app = express();
const server = http.createServer(app);

// CORS
const allowedOrigins = [process.env.FRONTEND_URL].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error("CORS blocked origin:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  }),
);

app.options("*", cors());

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

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
        "https://www.googleapis.com/youtube/v3/playlistItems" +
        "?part=snippet,contentDetails" +
        "&maxResults=50" +
        `&playlistId=${PLAYLIST_ID}` +
        `&key=${YT_API_KEY}` +
        (pageToken ? `&pageToken=${pageToken}` : "");

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok || !data.items) {
        console.error("YouTube API error:", data);
        break;
      }

      allItems = allItems.concat(data.items);
      pageToken = data.nextPageToken || "";
    } while (pageToken);

    videos = allItems
      .filter((item) => item.contentDetails?.videoId)
      .map((item) => ({
        videoId: item.contentDetails.videoId,
        title: item.snippet.title,
      }));

    // Reset shuffle when playlist is reloaded
    shuffleOrder = null;
    currentIndex = 0;

    console.log(`Loaded ${videos.length} songs`);
  } catch (err) {
    console.error("Failed to load playlist:", err);
  }
}

function getOrderedIndex(index) {
  return shuffleOrder ? shuffleOrder[index] : index;
}

function currentVideo() {
  if (!videos.length) {
    return null;
  }

  const realIndex = getOrderedIndex(currentIndex);

  return {
    ...videos[realIndex],
    index: currentIndex,
    total: videos.length,
  };
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
  });
});

app.get("/api/playlist/current", (req, res) => {
  res.json(currentVideo());
});

app.get("/api/playlist/next", (req, res) => {
  if (!videos.length) {
    return res.json(null);
  }

  currentIndex = (currentIndex + 1) % videos.length;

  const video = currentVideo();

  // Notify connected clients
  io.emit("playlist:update", video);

  res.json(video);
});

app.get("/api/playlist/previous", (req, res) => {
  if (!videos.length) {
    return res.json(null);
  }

  currentIndex = (currentIndex - 1 + videos.length) % videos.length;

  const video = currentVideo();

  // Notify connected clients
  io.emit("playlist:update", video);

  res.json(video);
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

  const video = currentVideo();

  // Notify connected clients
  io.emit("playlist:update", video);

  res.json(video);
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send current video immediately
  socket.emit("playlist:update", currentVideo());

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;

loadPlaylist();

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Allowed origins:", allowedOrigins);
});
