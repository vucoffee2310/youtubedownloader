let lastPot = null;
let lastVideoId = null;
let cachedTracks = {};
let pendingFetches = {};

const extractCaptionTracks = (html) => {
  try {
    const match = /\{"captionTracks":(\[.*?\])/g.exec(html);
    if (match) return JSON.parse(match[1]);
  } catch {}
  return [];
};

const fetchVideoData = async (videoId) => {
  if (cachedTracks[videoId]) return cachedTracks[videoId];
  if (pendingFetches[videoId]) return pendingFetches[videoId];

  pendingFetches[videoId] = (async () => {
    try {
      const response = await fetch(
        `https://www.youtube.com/watch?v=${videoId}`
      );
      const tracks = extractCaptionTracks(await response.text());
      cachedTracks[videoId] = tracks;
      const ids = Object.keys(cachedTracks);
      if (ids.length > 10) delete cachedTracks[ids[0]];
      return tracks;
    } catch {
      return [];
    } finally {
      delete pendingFetches[videoId];
    }
  })();

  return pendingFetches[videoId];
};

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.type === "xmlhttprequest" || details.type === "fetch") {
      const url = new URL(details.url);
      const pot = url.searchParams.get("pot");
      if (!url.searchParams.get("fromExt") && pot) {
        lastPot = pot;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id)
            chrome.tabs
              .sendMessage(tabs[0].id, { action: "potUpdated", pot })
              .catch(() => {});
        });
      }
    }
  },
  { urls: ["https://www.youtube.com/api/timedtext?*"] }
);

const handleVideoChange = async (tabId, videoId, url) => {
  if (!videoId || videoId === lastVideoId) return;
  lastVideoId = videoId;
  const tracks = await fetchVideoData(videoId);
  chrome.tabs
    .sendMessage(tabId, { action: "videoNavigated", videoId, tracks, url })
    .catch(() => {});
};

const handleUrlChange = async (tabId, url) => {
  if (!url?.includes("youtube.com/watch")) return;
  await handleVideoChange(tabId, new URL(url).searchParams.get("v"), url);
};

chrome.webNavigation?.onHistoryStateUpdated.addListener((d) =>
  handleUrlChange(d.tabId, d.url)
);
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete") handleUrlChange(tabId, tab.url);
});

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === "getPot") {
    sendResponse({ pot: lastPot });
    return true;
  }
  if (req.action === "downloadCaption") {
    fetch(`${req.baseUrl}&fromExt=true&c=WEB&pot=${req.pot}`)
      .then((r) => r.text())
      .then((xml) => sendResponse({ success: true, xml }))
      .catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (req.action === "fetchInitialTracks") {
    fetchVideoData(req.videoId)
      .then((tracks) => sendResponse({ tracks }))
      .catch(() => sendResponse({ tracks: [] }));
    return true;
  }
});
