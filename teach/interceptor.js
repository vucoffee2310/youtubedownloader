(function () {
  "use strict";
  if (window.__XHR_INTERCEPTOR_LOADED__) {
    console.warn("⚠️ XHR Interceptor already loaded");
    return;
  }
  window.__XHR_INTERCEPTOR_LOADED__ = true;
  const originalXHR = window.XMLHttpRequest;
  const TARGET_BASE_URL = "https://alkalimakersuite-pa.clients6.google.com";
  const TARGET_ENDPOINT = "GenerateContent";
  const postMsg = (type, data = {}) => {
    window.postMessage(
      {
        source: "xhr-interceptor",
        type,
        ...data,
        timestamp: new Date().toISOString(),
      },
      "*"
    );
  };
  const findTextInChunk = (data, results) => {
    if (!Array.isArray(data)) return;
    if (data.length >= 2 && data[0] === null && typeof data[1] === "string") {
      const content = data[1];
      const isThinking = data.length > 10 && data[data.length - 1] === 1;
      results.push({ type: isThinking ? "thinking" : "streaming", content });
    }
    data.forEach((item) => findTextInChunk(item, results));
  };
  const parseChunk = (text) => {
    try {
      const clean = text.trim().replace(/^,/, "");
      if (!clean) return [];
      const data = JSON.parse(clean);
      const results = [];
      findTextInChunk(data, results);
      return results;
    } catch (e) {
      return [];
    }
  };
  const splitJsonObjects = (line) => {
    const objects = [];
    let depth = 0;
    let current = "";
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === "[") depth++;
      else if (char === "]") depth--;
      current += char;
      if (depth === 0 && char === ",") {
        if (current.trim()) objects.push(current.trim().slice(0, -1));
        current = "";
      }
    }
    if (current.trim()) objects.push(current.trim());
    return objects;
  };
  window.XMLHttpRequest = function () {
    const xhr = new originalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    let isPotentialRequest = false;
    let hasAttachedListeners = false;
    let processedLength = 0;
    let thinking = "";
    let streaming = "";
    let thinkingCount = 0;
    let streamingCount = 0;
    let requestStartTime = null;
    let requestId = Math.random().toString(36).substr(2, 9);
    xhr.open = function (method, url) {
      if (url.includes(TARGET_BASE_URL) && url.includes(TARGET_ENDPOINT)) {
        isPotentialRequest = true;
        postMsg("request-detected", { method, url, requestId });
      }
      return originalOpen.apply(this, arguments);
    };
    const processNewData = () => {
      if (!xhr.responseText || xhr.responseText.length <= processedLength)
        return;
      const newData = xhr.responseText.substring(processedLength);
      newData
        .split("\n")
        .filter((l) => l.trim())
        .forEach((line) => {
          splitJsonObjects(line).forEach((jsonStr) => {
            const parsedItems = parseChunk(jsonStr);
            if (!parsedItems || parsedItems.length === 0) return;
            parsedItems.forEach((parsed) => {
              if (parsed.type === "thinking") {
                thinking += parsed.content;
                thinkingCount++;
                postMsg("thinking-update", {
                  content: parsed.content,
                  total: thinking,
                  count: thinkingCount,
                  chunkLength: parsed.content.length,
                  totalLength: thinking.length,
                  requestId,
                });
              } else {
                streaming += parsed.content;
                streamingCount++;
                postMsg("streaming-update", {
                  content: parsed.content,
                  total: streaming,
                  count: streamingCount,
                  chunkLength: parsed.content.length,
                  totalLength: streaming.length,
                  requestId,
                });
              }
            });
          });
        });
      processedLength = xhr.responseText.length;
    };
    const showFinalResult = () => {
      const duration = requestStartTime ? Date.now() - requestStartTime : 0;
      console.log(
        `✅ Request complete - Duration: ${duration}ms, Thinking: ${thinkingCount} chunks, Streaming: ${streamingCount} chunks`
      );
      postMsg("complete", {
        thinking,
        thinkingCount,
        streaming,
        streamingCount,
        duration,
        requestId,
      });
    };
    xhr.send = function (body) {
      if (isPotentialRequest && !hasAttachedListeners) {
        try {
          const payload = JSON.parse(body);
          const promptText = payload[1]?.[0]?.[0]?.[0]?.[1];
          if (promptText) {
            hasAttachedListeners = true;
            processedLength = 0;
            thinking = "";
            streaming = "";
            thinkingCount = 0;
            streamingCount = 0;
            requestStartTime = Date.now();
            postMsg("request", {
              prompt: promptText,
              promptLength: promptText.length,
              model: "gemini-2.0-flash-thinking",
              requestId,
            });
            let finalized = false;
            const finalizeResponse = () => {
              if (finalized) return;
              finalized = true;
              processNewData();
              showFinalResult();
            };
            xhr.addEventListener("progress", processNewData);
            xhr.addEventListener("loadend", finalizeResponse);
            xhr.addEventListener("error", () => {
              postMsg("error", { message: "Request failed", requestId });
            });
          }
        } catch (e) {
          console.warn(`⚠️ [${requestId}] Parse failed:`, e);
        }
      }
      return originalSend.apply(this, arguments);
    };
    return xhr;
  };
  postMsg("interceptor-ready");
  console.log("✅ XHR Interceptor Active");
})();
