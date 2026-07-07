const axios = require("axios");

const YOUTUBE_API_BASE_URL = "https://www.googleapis.com/youtube/v3";
const MAX_QUERIES_PER_DAY = 3;

function getYouTubeApiKey() {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new Error("YouTube API key is not configured.");
  }

  return apiKey;
}

function buildSearchQueries(studyDay) {
  const topics = Array.isArray(studyDay.topics)
    ? studyDay.topics.map(String).map(topic => topic.trim()).filter(Boolean)
    : [];

  const sourceTerms = topics.length > 0
    ? topics
    : [studyDay.title].filter(Boolean);

  return sourceTerms
    .slice(0, MAX_QUERIES_PER_DAY)
    .map(topic => `${topic} explained tutorial lecture`)
    .filter(Boolean);
}

function parseIsoDuration(duration) {
  const match = String(duration || "").match(
    /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/
  );

  if (!match) return "";

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);

  if (hours > 0) {
    return [
      hours,
      String(minutes).padStart(2, "0"),
      String(seconds).padStart(2, "0")
    ].join(":");
  }

  return [minutes, String(seconds).padStart(2, "0")].join(":");
}

function pickThumbnail(thumbnails) {
  return (
    thumbnails?.maxres?.url ||
    thumbnails?.standard?.url ||
    thumbnails?.high?.url ||
    thumbnails?.medium?.url ||
    thumbnails?.default?.url ||
    ""
  );
}

async function searchYouTubeVideos(query) {
  const response = await axios.get(`${YOUTUBE_API_BASE_URL}/search`, {
    params: {
      part: "snippet",
      type: "video",
      maxResults: 6,
      order: "relevance",
      safeSearch: "moderate",
      videoEmbeddable: "true",
      relevanceLanguage: "en",
      q: query,
      key: getYouTubeApiKey()
    },
    timeout: 12000
  });

  return Array.isArray(response.data.items) ? response.data.items : [];
}

async function getVideoDetails(videoIds) {
  if (videoIds.length === 0) return [];

  const response = await axios.get(`${YOUTUBE_API_BASE_URL}/videos`, {
    params: {
      part: "snippet,contentDetails",
      id: videoIds.join(","),
      key: getYouTubeApiKey()
    },
    timeout: 12000
  });

  return Array.isArray(response.data.items) ? response.data.items : [];
}

function normalizeVideo(video) {
  const videoId = String(video.id || "").trim();
  const snippet = video.snippet || {};

  return {
    title: String(snippet.title || "").trim(),
    channel: String(snippet.channelTitle || "").trim(),
    thumbnail: pickThumbnail(snippet.thumbnails),
    duration: parseIsoDuration(video.contentDetails?.duration),
    youtubeUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : "",
    videoId
  };
}

async function getRecommendedVideosForStudyDay(studyDay, maxResults) {
  const queries = buildSearchQueries(studyDay);
  const seenVideoIds = new Set();
  const candidateIds = [];
  const targetResults = Math.max(3, Math.min(Number(maxResults) || 5, 5));

  for (const query of queries) {
    const searchResults = await searchYouTubeVideos(query);

    for (const item of searchResults) {
      const videoId = item.id?.videoId;

      if (!videoId || seenVideoIds.has(videoId)) continue;

      seenVideoIds.add(videoId);
      candidateIds.push(videoId);

      if (candidateIds.length >= targetResults) break;
    }

    if (candidateIds.length >= targetResults) break;
  }

  const details = await getVideoDetails(candidateIds);

  return details
    .map(normalizeVideo)
    .filter(video => video.title && video.youtubeUrl && video.videoId)
    .slice(0, targetResults);
}

module.exports = {
  getRecommendedVideosForStudyDay
};
