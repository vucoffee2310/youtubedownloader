(function () {
  "use strict";
  if (window.__XHR_INTERCEPTOR_LOADED__) return;
  window.__XHR_INTERCEPTOR_LOADED__ = true;

  const CONFIG = {
    baseUrl: "https://alkalimakersuite-pa.clients6.google.com",
    endpoint: "GenerateContent",
  };

  const MSG = {
    READY: "interceptor-ready",
    REQUEST: "request",
    THINKING: "thinking-update",
    STREAMING: "streaming-update",
    COMPLETE: "complete",
    ERROR: "error",
  };

  const postMsg = (type, data = {}) => {
    window.postMessage({ source: "xhr-interceptor", type, ...data, timestamp: new Date().toISOString() }, "*");
  };

  const createState = () => ({
    processedLength: 0,
    thinking: "",
    streaming: "",
    thinkingCount: 0,
    streamingCount: 0,
    startTime: null,
    requestId: Math.random().toString(36).substr(2, 9),
    finalized: false,
  });

  const parseChunks = text => {
    const results = [];
    const regex = /\[null,"((?:[^"\\]|\\.)*)"/g;
    let match;
    while ((match = regex.exec(text))) {
      const content = match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      if (!content) continue;
      const remaining = text.slice(match.index + match[0].length);
      const closing = remaining.match(/^(?:[^[\]]*),(\d)\]/);
      const isThinking = closing && closing[1] === "1";
      results.push({ type: isThinking ? "thinking" : "streaming", content });
    }
    return results;
  };

  const isTargetRequest = url => url.includes(CONFIG.baseUrl) && url.includes(CONFIG.endpoint);

  const extractPrompt = body => {
    try {
      return JSON.parse(body)[1]?.[0]?.[0]?.[0]?.[1] || null;
    } catch {
      return null;
    }
  };

  const processNewData = (xhr, state) => {
    if (!xhr.responseText || xhr.responseText.length <= state.processedLength) return;
    const newData = xhr.responseText.substring(state.processedLength);
    const chunks = parseChunks(newData);

    chunks.forEach(chunk => {
      const isThinking = chunk.type === "thinking";
      const stateKey = isThinking ? "thinking" : "streaming";
      const countKey = isThinking ? "thinkingCount" : "streamingCount";
      const msgType = isThinking ? MSG.THINKING : MSG.STREAMING;

      state[stateKey] += chunk.content;
      state[countKey]++;

      postMsg(msgType, {
        content: chunk.content,
        total: state[stateKey],
        count: state[countKey],
        chunkLength: chunk.content.length,
        totalLength: state[stateKey].length,
        requestId: state.requestId,
      });
    });
    state.processedLength = xhr.responseText.length;
  };

  const finalizeResponse = (xhr, state) => {
    if (state.finalized) return;
    state.finalized = true;
    processNewData(xhr, state);
    postMsg(MSG.COMPLETE, {
      thinking: state.thinking,
      thinkingCount: state.thinkingCount,
      streaming: state.streaming,
      streamingCount: state.streamingCount,
      duration: state.startTime ? Date.now() - state.startTime : 0,
      requestId: state.requestId,
    });
  };

  const originalXHR = window.XMLHttpRequest;

  window.XMLHttpRequest = function () {
    const xhr = new originalXHR();
    let state = null;

    const originalOpen = xhr.open;
    const originalSend = xhr.send;

    xhr.open = function (method, url) {
      if (isTargetRequest(url)) state = createState();
      return originalOpen.apply(this, arguments);
    };

    xhr.send = function (body) {
      if (state) {
        const prompt = extractPrompt(body);
        if (prompt) {
          state.startTime = Date.now();
          postMsg(MSG.REQUEST, {
            prompt,
            promptLength: prompt.length,
            requestId: state.requestId,
          });
          xhr.addEventListener("progress", () => processNewData(xhr, state));
          xhr.addEventListener("loadend", () => finalizeResponse(xhr, state));
          xhr.addEventListener("error", () => postMsg(MSG.ERROR, { message: "Request failed", requestId: state.requestId }));
        }
      }
      return originalSend.apply(this, arguments);
    };

    return xhr;
  };

  postMsg(MSG.READY);
})();