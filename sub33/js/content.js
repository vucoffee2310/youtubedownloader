const CONFIG = {
  CONTAINER_ID: "ytSubDl",
  GROUP_SIZE: 6,
  SELECTORS: ["#bottom-row", "#meta #meta-contents #container #top-row"],
  CC_SELECTOR: ".ytp-subtitles-button",
  MAX_RETRIES: 10,
  RETRY_DELAY: 300,
};

const state = {
  url: "",
  videoId: "",
  pos: null,
  ccClicked: false,
  uiReady: false,
};
let potResolve = null;

const $ = (s) => document.querySelector(s);
const $id = (id) => document.getElementById(id);

const download = (content, name, type = "text/plain") => {
  const a = Object.assign(document.createElement("a"), {
    download: name,
    href: URL.createObjectURL(new Blob([content], { type })),
  });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 100);
};

const waitPOT = (ms = 2000) =>
  new Promise((r) => {
    potResolve = r;
    setTimeout(() => {
      if (potResolve === r) {
        potResolve = null;
        r(true);
      }
    }, ms);
  });

const waitCC = (ms = 10000) =>
  new Promise((res, rej) => {
    const btn = $(CONFIG.CC_SELECTOR);
    if (btn) return res(btn);
    const tid = setTimeout(() => {
      obs.disconnect();
      rej();
    }, ms);
    const obs = new MutationObserver(() => {
      const b = $(CONFIG.CC_SELECTOR);
      if (b) {
        clearTimeout(tid);
        obs.disconnect();
        res(b);
      }
    });
    obs.observe($("#movie_player") || document.body, {
      childList: true,
      subtree: true,
    });
  });

const autoCC = async () => {
  if (state.ccClicked) return;
  try {
    const btn = await waitCC();
    if (btn.getAttribute("aria-pressed") !== "true") btn.click();
    state.ccClicked = true;
  } catch {}
};

const toggleCC = async () => {
  try {
    const btn = await waitCC(5000);
    if (btn.getAttribute("aria-pressed") === "true") {
      btn.click();
      await new Promise((r) => setTimeout(r, 100));
    }
    btn.click();
    await waitPOT();
    return true;
  } catch {
    return false;
  }
};

const downloadCaptions = async (track, fmt) => {
  if (!(await toggleCC())) return alert("Enable captions manually");
  const [{ generateGroups, seededRng }, { toJson, toPara, formatJson }] =
    await Promise.all([
      import(chrome.runtime.getURL("js/processor.js")),
      import(chrome.runtime.getURL("js/formats.js")),
    ]);
  chrome.runtime.sendMessage({ action: "getPot" }, ({ pot }) => {
    if (!pot) return alert("POT not available");
    chrome.runtime.sendMessage(
      { action: "downloadCaption", baseUrl: track.baseUrl, pot },
      async ({ success, xml, error }) => {
        if (!success) return alert("Failed: " + error);
        const groups = generateGroups(xml, CONFIG.GROUP_SIZE);
        const origTA = $id("origTA");
        if (origTA && fmt === "json") origTA.value = formatJson(groups, 2);
        const fmts = {
          json: { fn: toJson, ext: "json", mime: "application/json" },
          para: {
            fn: (g) => toPara(g, seededRng),
            ext: "txt",
            mime: "text/plain",
          },
        };
        const f = fmts[fmt];
        download(
          f.fn(groups),
          `${document.title.replace(/ - YouTube/gi, "")}.${
            track.languageCode
          }.${f.ext}`,
          f.mime
        );
      }
    );
  });
};

const autoLoad = async (track) => {
  if (!(await toggleCC())) return;
  const [{ generateGroups }, { formatJson }] = await Promise.all([
    import(chrome.runtime.getURL("js/processor.js")),
    import(chrome.runtime.getURL("js/formats.js")),
  ]);
  chrome.runtime.sendMessage({ action: "getPot" }, ({ pot }) => {
    if (!pot) return;
    chrome.runtime.sendMessage(
      { action: "downloadCaption", baseUrl: track.baseUrl, pot },
      ({ success, xml }) => {
        if (!success) return;
        const ta = $id("origTA");
        if (ta)
          ta.value = formatJson(generateGroups(xml, CONFIG.GROUP_SIZE), 2);
      }
    );
  });
};

const renderTracks = (tracks) => {
  const c = $id("trackList");
  if (!c) return;
  c.innerHTML = "";
  if (!tracks.length) {
    c.innerHTML =
      "<tr><td colspan='3'><em>No subtitles available</em></td></tr>";
    return;
  }
  tracks.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${t.name.simpleText}</td><td><button data-fmt="json">JSON</button></td><td><button data-fmt="para">TXT</button></td>`;
    tr.querySelectorAll("button").forEach((btn) => {
      btn.onclick = () => downloadCaptions(t, btn.dataset.fmt);
    });
    c.append(tr);
  });
};

const clearTranslator = () => {
  const orig = $id("origTA"),
    para = $id("paraTA"),
    out = $id("outTA"),
    stats = $id("statsP"),
    exp = $id("exportDiv");
  if (orig) orig.value = "";
  if (para) para.value = "";
  if (out) {
    out.value = "";
    out.hidden = true;
  }
  if (stats) {
    stats.textContent = "";
    stats.hidden = true;
  }
  if (exp) exp.hidden = true;
};

let modules = null;
const loadMods = async () => {
  if (modules) return modules;
  const [p, f] = await Promise.all([
    import(chrome.runtime.getURL("js/processor.js")),
    import(chrome.runtime.getURL("js/formats.js")),
  ]);
  modules = { p, f };
  return modules;
};

const process = async () => {
  const origTA = $id("origTA"),
    paraTA = $id("paraTA"),
    outTA = $id("outTA"),
    statsP = $id("statsP"),
    expDiv = $id("exportDiv");
  if (!paraTA.value.trim()) return alert("Enter translated text");
  if (!origTA.value.trim()) return alert("Download JSON first");
  try {
    const { p, f } = await loadMods();
    const orig = JSON.parse(origTA.value);
    const rev = f.fromPara(paraTA.value, p.countTokens);
    const mapped = p.mapReversedToOriginal(orig, rev);
    if (mapped.error) return alert(mapped.error);
    const result = await p.distributeTranslation(mapped);
    const { distribution, reversed, preprocessing, mapping, ...clean } = result;

    window._result = result;
    outTA.value = f.formatJson(clean, 2);
    outTA.hidden = false;
    statsP.hidden = false;
    expDiv.hidden = false;

    const g = distribution.captionsPerGroup.filter(
      (x) => x.translatedCaptions > 0
    ).length;
    statsP.textContent = `✓ Groups: ${g}/${result.original.length} | Captions: ${distribution.totalCaptionsWithTranslation} | Mappings: ${mapping.length}`;
  } catch (e) {
    alert(e.message);
  }
};

const exportSub = async (trans, ext) => {
  if (!window._result) return alert("Process first");
  const { f } = await loadMods();
  const fn = ext === "srt" ? f.toSRT : f.toVTT;
  download(
    fn(window._result, trans),
    `captions.${trans ? "trans" : "orig"}.${ext}`,
    `text/${ext}`
  );
};

const createUI = () => {
  if (state.uiReady) return;

  const container = document.createElement("div");
  container.id = CONFIG.CONTAINER_ID;
  container.style.cssText =
    "background:#181818;color:#eee;padding:12px;margin:12px 0;border-radius:8px;font-family:system-ui";

  container.innerHTML = `
    <fieldset style="border:1px solid #444;padding:10px;margin:0 0 12px 0">
      <legend><b>📥 Subtitle Downloader</b></legend>
      <table style="width:100%;border-collapse:collapse">
        <tbody id="trackList"></tbody>
      </table>
    </fieldset>

    <details style="background:#222;padding:8px;border-radius:4px">
      <summary style="cursor:pointer;font-weight:bold">🌐 Translator</summary>
      <div style="margin-top:12px">
        <label><b>Original JSON</b></label><br>
        <textarea id="origTA" rows="5" style="width:100%;box-sizing:border-box;font-family:monospace" placeholder="Original JSON (auto-loads)..."></textarea>

        <label><b>Translated Paragraph</b></label><br>
        <textarea id="paraTA" rows="5" style="width:100%;box-sizing:border-box;font-family:monospace" placeholder="(a) text (b) more..."></textarea>

        <div style="margin:8px 0">
          <button id="processBtn">⚡ Process</button>
          <button id="clearBtn">🗑️ Clear</button>
          <button id="copyBtn">📋 Copy</button>
        </div>

        <p id="statsP" hidden style="background:#1a3a4a;padding:8px;border-radius:4px"></p>

        <div id="exportDiv" hidden style="margin:8px 0">
          <button data-t="0" data-e="srt">SRT Orig</button>
          <button data-t="1" data-e="srt">SRT Trans</button>
          <button data-t="0" data-e="vtt">VTT Orig</button>
          <button data-t="1" data-e="vtt">VTT Trans</button>
        </div>

        <textarea id="outTA" rows="8" readonly hidden style="width:100%;box-sizing:border-box;font-family:monospace;background:#111"></textarea>
      </div>
    </details>
  `;

  container.querySelector("#processBtn").onclick = process;
  container.querySelector("#clearBtn").onclick = () => {
    $id("origTA").value = $id("paraTA").value = $id("outTA").value = "";
    $id("outTA").hidden = $id("statsP").hidden = $id("exportDiv").hidden = true;
    window._result = null;
  };
  container.querySelector("#copyBtn").onclick = () => {
    $id("outTA").select();
    document.execCommand("copy");
  };
  container.querySelectorAll("#exportDiv button").forEach((btn) => {
    btn.onclick = () => exportSub(btn.dataset.t === "1", btn.dataset.e);
  });

  state.pos.before(container);
  state.uiReady = true;
};

const buildUI = (tracks) => {
  if (!state.uiReady) createUI();
  renderTracks(tracks);
  clearTranslator();
  if (tracks.length) setTimeout(() => autoLoad(tracks[0]), 500);
};

const findPos = () => CONFIG.SELECTORS.some((s) => (state.pos = $(s)));

const initUI = (videoId, url, tracks, attempt = 0) => {
  if (findPos()) {
    state.videoId = videoId;
    state.url = url;
    state.ccClicked = false;
    buildUI(tracks);
    autoCC();
  } else if (attempt < CONFIG.MAX_RETRIES) {
    setTimeout(
      () => initUI(videoId, url, tracks, attempt + 1),
      CONFIG.RETRY_DELAY
    );
  }
};

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "potUpdated" && potResolve) {
    potResolve(true);
    potResolve = null;
  } else if (msg.action === "videoNavigated") {
    const u = msg.url || location.href;
    if (state.url !== u || state.videoId !== msg.videoId)
      initUI(msg.videoId, u, msg.tracks);
  }
});

const init = () => {
  const videoId = new URLSearchParams(location.search).get("v");
  if (videoId) {
    chrome.runtime.sendMessage(
      { action: "fetchInitialTracks", videoId },
      (r) => {
        if (r?.tracks) initUI(videoId, location.href, r.tracks);
      }
    );
  }
};

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", init);
else init();
