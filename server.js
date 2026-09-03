import "dotenv/config";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();

const allowedOrigins = ["https://bus-playlist-client.vercel.app"];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without an Origin
    if (!origin) {
      return callback(null, true);
    }

    // Allow the main production domain
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow Vercel preview deployments
    if (
      origin.endsWith(".vercel.app") &&
      origin.includes("bus-playlist-client")
    ) {
      return callback(null, true);
    }

    console.error("CORS blocked:", origin);

    callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
};

app.use(cors(corsOptions));

app.options("*", cors());

app.use(express.json());

const YT_API_KEY = process.env.YT_API_KEY;
const PLAYLIST_ID = "PLLJl2b09clvg";

let videos = [];
let currentIndex = 0;
let shuffleOrder = null;

async function loadPlaylist() {
  try {
    if (!YT_API_KEY) {
      console.error("YT_API_KEY is missing");
      return;
    }

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
        return;
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

    currentIndex = 0;
    shuffleOrder = null;

    console.log(`Loaded ${videos.length} songs`);
  } catch (error) {
    console.error("Failed to load playlist:", error);
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

  res.json(currentVideo());
});

app.get("/api/playlist/previous", (req, res) => {
  if (!videos.length) {
    return res.json(null);
  }

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

loadPlaylist();

export default app;
