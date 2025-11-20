(function () {
  "use strict";

  if (window.__XHR_INTERCEPTOR_LOADED__) {
    console.warn("⚠️ XHR Interceptor already loaded");
    return;
  }
  window.__XHR_INTERCEPTOR_LOADED__ = true;

  // Standalone config - no dependencies
  const CONFIG = {
    target: {
      baseUrl: "https://alkalimakersuite-pa.clients6.google.com",
      endpoint: "GenerateContent",
    },
    msgTypes: {
      READY: "interceptor-ready",
      REQUEST_DETECTED: "request-detected",
      REQUEST: "request",
      THINKING: "thinking-update",
      STREAMING: "streaming-update",
      COMPLETE: "complete",
      ERROR: "error",
    },
    parsing: {
      thinkingMarker: 1,
      minDataLength: 2,
      thinkingMinLength: 10,
    },
  };

  const CONTENT_TYPES = {
    thinking: { stateKey: "thinking", countKey: "thinkingCount" },
    streaming: { stateKey: "streaming", countKey: "streamingCount" },
  };

  const createState = () => ({
    isPotentialRequest: false,
    hasAttachedListeners: false,
    processedLength: 0,
    thinking: "",
    streaming: "",
    thinkingCount: 0,
    streamingCount: 0,
    startTime: null,
    requestId: Math.random().toString(36).substr(2, 9),
    finalized: false,
  });

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

  const isTextChunk = (data) =>
    Array.isArray(data) &&
    data.length >= CONFIG.parsing.minDataLength &&
    data[0] === null &&
    typeof data[1] === "string";

  const isThinkingChunk = (data) =>
    data.length > CONFIG.parsing.thinkingMinLength &&
    data[data.length - 1] === CONFIG.parsing.thinkingMarker;

  const findTextInChunk = (data, results) => {
    if (!Array.isArray(data)) return;
    if (isTextChunk(data)) {
      results.push({
        type: isThinkingChunk(data) ? "thinking" : "streaming",
        content: data[1],
      });
    }
    data.forEach((item) => findTextInChunk(item, results));
  };

  const parseChunk = (text) => {
    try {
      const clean = text.trim().replace(/^,/, "");
      if (!clean) return [];
      const results = [];
      findTextInChunk(JSON.parse(clean), results);
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

  const isTargetRequest = (url) =>
    url.includes(CONFIG.target.baseUrl) && url.includes(CONFIG.target.endpoint);

  const extractPrompt = (body) => {
    try {
      return JSON.parse(body)[1]?.[0]?.[0]?.[0]?.[1] || null;
    } catch (e) {
      return null;
    }
  };

  const processContent = (state, parsed) => {
    const typeConfig = CONTENT_TYPES[parsed.type];
    if (!typeConfig) return;

    state[typeConfig.stateKey] += parsed.content;
    state[typeConfig.countKey]++;

    postMsg(CONFIG.msgTypes[parsed.type.toUpperCase()], {
      content: parsed.content,
      total: state[typeConfig.stateKey],
      count: state[typeConfig.countKey],
      chunkLength: parsed.content.length,
      totalLength: state[typeConfig.stateKey].length,
      requestId: state.requestId,
    });
  };

  const processNewData = (xhr, state) => {
    if (!xhr.responseText || xhr.responseText.length <= state.processedLength)
      return;

    const newData = xhr.responseText.substring(state.processedLength);
    newData
      .split("\n")
      .filter((l) => l.trim())
      .forEach((line) => {
        splitJsonObjects(line).forEach((jsonStr) => {
          parseChunk(jsonStr).forEach((parsed) =>
            processContent(state, parsed)
          );
        });
      });

    state.processedLength = xhr.responseText.length;
  };

  const finalizeResponse = (xhr, state) => {
    if (state.finalized) return;
    state.finalized = true;
    processNewData(xhr, state);

    const duration = state.startTime ? Date.now() - state.startTime : 0;
    console.log(
      `✅ XHR Complete - Duration: ${duration}ms, Thinking: ${state.thinkingCount} chunks, Streaming: ${state.streamingCount} chunks`
    );

    postMsg(CONFIG.msgTypes.COMPLETE, {
      thinking: state.thinking,
      thinkingCount: state.thinkingCount,
      streaming: state.streaming,
      streamingCount: state.streamingCount,
      duration,
      requestId: state.requestId,
    });
  };

  const originalXHR = window.XMLHttpRequest;

  window.XMLHttpRequest = function () {
    const xhr = new originalXHR();
    const state = createState();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;

    xhr.open = function (method, url) {
      if (isTargetRequest(url)) {
        state.isPotentialRequest = true;
        postMsg(CONFIG.msgTypes.REQUEST_DETECTED, {
          method,
          url,
          requestId: state.requestId,
        });
        console.log("🎯 XHR Interceptor: Target request detected", url);
      }
      return originalOpen.apply(this, arguments);
    };

    xhr.send = function (body) {
      if (state.isPotentialRequest && !state.hasAttachedListeners) {
        const promptText = extractPrompt(body);
        if (promptText) {
          state.hasAttachedListeners = true;
          state.startTime = Date.now();

          console.log("📤 XHR Interceptor: Request started", {
            prompt: promptText.substring(0, 60) + "...",
            length: promptText.length,
          });

          postMsg(CONFIG.msgTypes.REQUEST, {
            prompt: promptText,
            promptLength: promptText.length,
            model: "gemini-2.0-flash-thinking-exp",
            requestId: state.requestId,
          });

          const handlers = {
            progress: () => processNewData(xhr, state),
            loadend: () => finalizeResponse(xhr, state),
            error: () => {
              console.error("❌ XHR Interceptor: Request failed");
              postMsg(CONFIG.msgTypes.ERROR, {
                message: "Request failed",
                requestId: state.requestId,
              });
            },
          };

          Object.entries(handlers).forEach(([event, handler]) => {
            xhr.addEventListener(event, handler);
          });
        }
      }
      return originalSend.apply(this, arguments);
    };

    return xhr;
  };

  postMsg(CONFIG.msgTypes.READY);
  console.log("✅ XHR Interceptor Active");
})();
