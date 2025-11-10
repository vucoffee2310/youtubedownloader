// ============= CONFIG & CONSTANTS =============
const CONFIG = {
  CONTAINER_ID: "captionDownloadContainer",
  REVERSE_CONTAINER_ID: "paragraphToJsonContainer",
  PARAGRAPH_DEFAULTS: { min: 3, max: 8, chance: 100 },
  CHUNK_DURATION: 3600, // 1 hour
  FAKE_GROUPS: 5,
  SEED: 1,
};

let state = { insertPosition: null, currentUrl: "" };

// ============= UTILITIES =============
const Utils = {
  getParam: (param) => new URLSearchParams(location.search).get(param),

  downloadFile(text, fileName, type = "application/json") {
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([text], { type })),
      download: fileName,
    });
    a.click();
  },

  formatTime(sec) {
    const ms = Math.floor(sec * 1000) % 1000;
    const [h, m, s] = [3600, 60, 1].map((d, i, a) =>
      String(Math.floor((sec % (a[i - 1] || Infinity)) / d)).padStart(2, "0")
    );
    return `${h}:${m}:${s},${String(ms).padStart(3, "0")}`;
  },

  countWords(text) {
    const t = text.trim();
    if (!t) return 0;
    const hasSpaces = (t.match(/\s+/g) || []).length / t.length > 0.05;
    return hasSpaces
      ? t.split(/\s+/).length
      : [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(t)]
          .length;
  },

  // Check if text uses whitespace (5% threshold, same as countWords)
  hasWhitespace(text) {
    const t = text.trim();
    return (t.match(/\s+/g) || []).length / t.length > 0.05;
  },

  // Split text into units using the SAME logic as countWords:
  // - Whitespace languages: split by spaces into words
  // - Non-whitespace languages: split by GRAPHEMES
  getTextUnits: (() => {
    const cache = new Map();
    return (text) => {
      if (!cache.has(text)) {
        const hasSpaces = Utils.hasWhitespace(text);
        const units = hasSpaces
          ? text.split(/\s+/).filter(Boolean)
          : [
              ...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(
                text
              ),
            ].map((s) => s.segment);
        cache.set(text, { units, hasSpaces });
      }
      return cache.get(text);
    };
  })(),
};

// ============= RNG & MARKERS =============
class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }
  next() {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

const generateMarker = (() => {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  return (rng, prevMarker) => {
    let marker;
    do {
      marker = chars[Math.floor(rng.next() * 26)];
    } while (marker === prevMarker);
    return marker;
  };
})();

// ============= GROUP BUILDER =============
class GroupBuilder {
  constructor() {
    this.rng = new SeededRandom(CONFIG.SEED);
    this.prevMarker = "";
    this.markerCounter = {};
    this.groupDataArray = [];
    this.groupLookup = {};
  }

  generateMarkerId(marker) {
    this.markerCounter[marker] = (this.markerCounter[marker] || 0) + 1;
    return `${marker}-${this.markerCounter[marker]}`;
  }

  createGroup(captions, groupIdx, isFake = false) {
    const marker = generateMarker(this.rng, this.prevMarker);
    this.prevMarker = marker;
    const markerId = this.generateMarkerId(marker);

    const wordCount = captions.reduce((sum, cap) => sum + cap.wordCount, 0);
    const text = captions
      .map((c) => c.text)
      .join(" ")
      .trim();
    const [start, end] = [captions[0].start, captions[captions.length - 1].end];

    const groupData = {
      marker,
      markerId,
      wordCount,
      text,
      start,
      end,
      captions,
    };
    this.groupLookup[markerId] = groupData;
    this.groupDataArray.push(groupData);

    const dist = captions.map((c) =>
      wordCount > 0 ? parseFloat((c.wordCount / wordCount).toFixed(4)) : 0
    );

    const from = captions.map((c) => ({
      ...(c.idx !== null && { idx: c.idx }),
      start: c.start,
      end: c.end,
      wordCount: c.wordCount,
      captiontext: c.text,
      captionTranslation: "",
      ...(c.trans && { trans: c.trans }),
    }));

    return {
      groupIdx,
      start,
      end,
      wordCount,
      dist,
      marker,
      markerId,
      ...this.getCombinations(),
      from,
      grouptext: text,
      groupTranslation: "",
      ...(isFake && { isFake: true }),
    };
  }

  getCombinations() {
    // Get the 5 groups BEFORE the current one (which was just pushed)
    const last5 = this.groupDataArray.slice(-6, -1);
    if (last5.length < 5)
      return { prev5: null, prev5choose4: [], prev5choose3: [] };

    return {
      prev5: last5.map((m) => m.marker).join(""),
      prev5choose4: this.computeLackCombinations(last5, 4),
      prev5choose3: this.computeLackCombinations(last5, 3),
    };
  }

  computeLackCombinations(groups, k) {
    if (k >= groups.length || groups.every((g) => !g.wordCount && !g.text))
      return [];

    const result = [];
    const combine = (start, chosen) => {
      if (chosen.length === k) {
        const lacking = groups
          .map((_, i) => i)
          .filter((i) => !chosen.includes(i));
        if (lacking[0] === 0) return;

        const specs = this.buildSpecifications(groups, lacking);
        if (specs.length) {
          result.push({
            seq: chosen.map((i) => groups[i].marker).join(""),
            lack: lacking.map((i) => groups[i].marker),
            merged: specs.map((s) => s.markerStr),
            specify: specs.map((s) => s.detail),
          });
        }
      }
      for (let i = start; i < groups.length; i++)
        combine(i + 1, [...chosen, i]);
    };
    combine(0, []);
    return result;
  }

  buildSpecifications(groups, lackingIndices) {
    return lackingIndices
      .filter((i) => {
        const [prev, lack] = [groups[i - 1], groups[i]].map(
          (g) => this.groupLookup[g.markerId]
        );
        return prev.wordCount && prev.text && lack.wordCount && lack.text;
      })
      .map((i) => this.buildSpec(groups, i));
  }

  buildSpec(groups, lackIdx) {
    const [prevItem, lackItem] = [groups[lackIdx - 1], groups[lackIdx]];
    const [prev, lack] = [prevItem, lackItem].map(
      (g) => this.groupLookup[g.markerId]
    );

    const totalOriginalWords = prev.wordCount + lack.wordCount;

    // Reconstruct merged text from ORIGINAL captions to avoid double-spacing
    const allCaptions = [...prev.captions, ...lack.captions];

    // Determine language type from original captions
    const sampleText = allCaptions.map((c) => c.text).join("");
    const hasSpaces = Utils.hasWhitespace(sampleText);

    // Merge based on language type
    const mergedText = hasSpaces
      ? allCaptions.map((c) => c.text).join(" ")
      : allCaptions.map((c) => c.text).join("");

    // Split into units based on language type
    const units = hasSpaces
      ? mergedText.split(/\s+/).filter(Boolean)
      : [
          ...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(
            mergedText
          ),
        ].map((s) => s.segment);

    // Calculate split index using original word count ratio
    const splitIdx = Math.round(
      units.length * (prev.wordCount / totalOriginalWords)
    );

    const actualTotal = units.length;
    const ratio = (val) =>
      actualTotal > 0 ? parseFloat((val / actualTotal).toFixed(4)) : 0;
    const joinUnits = (arr) => (hasSpaces ? arr.join(" ") : arr.join(""));

    const markers = [
      { group: prev, item: prevItem, units: units.slice(0, splitIdx) },
      { group: lack, item: lackItem, units: units.slice(splitIdx) },
    ]
      .filter(({ units }) => units.length)
      .map(({ group, item, units }) => {
        const actualCount = units.length;

        // Calculate dist from original captions - this is our distribution template
        const groupTotal = group.captions.reduce(
          (sum, c) => sum + c.wordCount,
          0
        );
        const dist = group.captions.map((c) =>
          groupTotal > 0 ? c.wordCount / groupTotal : 0
        );

        // Use dist to distribute units to captions
        let idx = 0;
        let remainingUnits = actualCount;

        const from = group.captions
          .map((cap, i, arr) => {
            const isLast = i === arr.length - 1;
            // Use dist[i] ratio to calculate count
            const count = isLast
              ? remainingUnits
              : Math.round(actualCount * dist[i]);

            const text = joinUnits(units.slice(idx, idx + count));
            idx += count;
            remainingUnits -= count;

            return cap.idx !== null && text
              ? {
                  idx: cap.idx,
                  start: cap.start,
                  end: cap.end,
                  word_count: count,
                  content: text,
                  content_translation: "",
                  ...(cap.trans && { trans: cap.trans }),
                }
              : null;
          })
          .filter(Boolean);

        // Output dist based on ACTUAL distributed counts
        const distOutput = from.map((f) => ratio(f.word_count));

        return {
          markerId: item.markerId,
          ratio: ratio(actualCount),
          dist: distOutput,
          text: joinUnits(units),
          text_translation: "",
          from,
        };
      });

    return {
      markerStr: markers.map((m) => m.markerId.split("-")[0]).join(""),
      detail: {
        start: prev.start,
        end: lack.end,
        wordCount: actualTotal,
        totalText: mergedText,
        markers,
      },
    };
  }
}

// ============= XML PARSER =============
const XmlParser = {
  async buildGroups(xml) {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const texts = [...doc.getElementsByTagName("text")];

    const realCaptions = texts
      .map((el, i) => {
        const content = el.textContent.trim();
        if (!content) return null;
        const start = parseFloat(el.getAttribute("start"));
        return {
          idx: i + 1,
          start: parseFloat(start.toFixed(3)),
          end: parseFloat(
            (start + parseFloat(el.getAttribute("dur"))).toFixed(3)
          ),
          wordCount: Utils.countWords(content),
          text: content,
          trans: "",
        };
      })
      .filter(Boolean);

    const firstStart = realCaptions[0]?.start || 0;
    const lastEnd = realCaptions[realCaptions.length - 1]?.end || firstStart;

    const builder = new GroupBuilder();
    const groups = [];

    // Add fake bootstrap groups
    for (let i = 0; i < CONFIG.FAKE_GROUPS; i++) {
      const start = firstStart - (CONFIG.FAKE_GROUPS - i) * 2.5;
      groups.push(
        builder.createGroup(
          [
            {
              idx: null,
              start: parseFloat(start.toFixed(3)),
              end: parseFloat((start + 2).toFixed(3)),
              wordCount: 0,
              text: "",
              trans: "",
            },
          ],
          i,
          true
        )
      );
      if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    // Add real groups (5 captions each)
    for (let i = 0; i < realCaptions.length; i += 5) {
      groups.push(
        builder.createGroup(
          realCaptions.slice(i, i + 5),
          CONFIG.FAKE_GROUPS + Math.floor(i / 5)
        )
      );
      if (i % 50 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    // Mark first and last real groups
    groups[CONFIG.FAKE_GROUPS].isLeading = true;
    groups[groups.length - 1].isTrailing = true;

    return { groups, firstStart, lastEnd };
  },

  toSrt(xml) {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    return [...doc.getElementsByTagName("text")]
      .map((el, i) => {
        const content = el.textContent.trim();
        if (!content) return "";
        const start = parseFloat(el.getAttribute("start"));
        const end = start + parseFloat(el.getAttribute("dur"));
        return `${i + 1}\n${Utils.formatTime(start)} --> ${Utils.formatTime(
          end
        )}\n${content}\n`;
      })
      .filter(Boolean)
      .join("\n");
  },

  async toParagraph(xml, { min, max, chance } = CONFIG.PARAGRAPH_DEFAULTS) {
    const { groups } = await this.buildGroups(xml);
    const realGroups = groups.filter((g) => !g.isFake);
    if (!realGroups.length) return "";

    const rng = new SeededRandom(42);
    const paragraphs = [];
    let carryOver = "";

    for (let i = 0; i < realGroups.length; ) {
      const parts = carryOver ? [carryOver] : [];
      carryOver = "";

      const numGroups = Math.floor(rng.next() * (max - min + 1)) + min;

      for (let j = 0; j < numGroups && i < realGroups.length; j++) {
        const g = realGroups[i];
        const isLast = j === numGroups - 1 && i < realGroups.length - 1;

        if (isLast && rng.next() < chance / 100) {
          const { units, hasSpaces } = Utils.getTextUnits(g.grouptext);
          if (units.length > 2) {
            const split = Math.max(
              1,
              Math.floor(units.length * (0.4 + rng.next() * 0.2))
            );
            const joinUnits = (arr) =>
              hasSpaces ? arr.join(" ") : arr.join("");
            parts.push(`(${g.marker}) ${joinUnits(units.slice(0, split))}`);
            carryOver = joinUnits(units.slice(split));
            i++;
            break;
          }
        }
        parts.push(`(${g.marker}) ${g.grouptext}`);
        i++;
      }

      if (parts.length) paragraphs.push(parts.join(" "));
    }

    return paragraphs.join("\n\n");
  },
};

// ============= CONVERTERS =============
const Converters = {
  groupByMarker(groups) {
    return groups.reduce((acc, g) => {
      (acc[g.marker] = acc[g.marker] || []).push(g);
      return acc;
    }, {});
  },

  computeChunks(start, end) {
    const total = Math.max(0, end - start);
    if (total <= CONFIG.CHUNK_DURATION) return [[start, end]];

    const hours = Math.floor(total / CONFIG.CHUNK_DURATION);
    if (total % CONFIG.CHUNK_DURATION === 0) {
      return Array.from({ length: hours }, (_, i) => [
        start + i * CONFIG.CHUNK_DURATION,
        start + (i + 1) * CONFIG.CHUNK_DURATION,
      ]);
    }

    const mid = start + total / 2;
    return [
      [start, mid],
      [mid, end],
    ];
  },

  splitByChunks(groups, chunks) {
    const result = chunks.map(() => []);
    groups.forEach((g) => {
      if (g.isFake) {
        result[0].push(g);
        return;
      }
      const mid = (g.start + g.end) / 2;
      const idx = chunks.findIndex(([s, e], i) =>
        i === chunks.length - 1 ? mid >= s && mid <= e : mid >= s && mid < e
      );
      if (idx >= 0) result[idx].push(g);
    });
    return result;
  },

  async toJson(xml) {
    const { groups } = await XmlParser.buildGroups(xml);
    return [JSON.stringify(this.groupByMarker(groups), null, 2)];
  },

  async toJsonParts(xml) {
    const { groups, firstStart, lastEnd } = await XmlParser.buildGroups(xml);
    const chunks = this.computeChunks(firstStart, lastEnd);
    return this.splitByChunks(groups, chunks).map((g) =>
      JSON.stringify(this.groupByMarker(g), null, 2)
    );
  },

  fromParagraph(text) {
    const rng = new SeededRandom(CONFIG.SEED);
    const result = [];
    const history = [];
    const counter = {};
    let prevMarker = "";

    // Bootstrap fake groups - NO previous values
    for (let i = 0; i < CONFIG.FAKE_GROUPS; i++) {
      const marker = generateMarker(rng, prevMarker);
      prevMarker = marker;
      counter[marker] = (counter[marker] || 0) + 1;
      result.push({
        marker,
        markerId: `${marker}-${counter[marker]}`,
        wordCount: 0,
        text: "",
        previous5: null,
        previous4: null,
        previous3: null,
        isFake: true,
      });
      history.push(marker);
    }

    // Parse paragraph
    const expectedLeading = generateMarker(rng, prevMarker);
    const parts = text.trim().split(/(\(\w\)\s*)/);

    if (parts[0].trim()) {
      const marker = expectedLeading;
      counter[marker] = (counter[marker] || 0) + 1;
      result.push({
        marker,
        markerId: `${marker}-${counter[marker]}`,
        wordCount: Utils.countWords(parts[0].trim()),
        text: parts[0].trim(),
        previous5: history.slice(-5).join(""),
        previous4: history.slice(-4).join(""),
        previous3: history.slice(-3).join(""),
        isLeading: true,
      });
      history.push(marker);
    }

    for (let i = 1; i < parts.length; i += 2) {
      const match = parts[i].match(/\w/);
      if (!match) continue;

      const marker = match[0];
      counter[marker] = (counter[marker] || 0) + 1;
      result.push({
        marker,
        markerId: `${marker}-${counter[marker]}`,
        wordCount: Utils.countWords((parts[i + 1] || "").trim()),
        text: (parts[i + 1] || "").trim(),
        previous5: history.slice(-5).join("") || null,
        previous4: history.slice(-4).join("") || null,
        previous3: history.slice(-3).join("") || null,
        ...(result.length === CONFIG.FAKE_GROUPS && { isLeading: true }),
      });
      history.push(marker);
    }

    return JSON.stringify(result, null, 2);
  },
};

// ============= DOWNLOAD =============
const downloadCaption = async (track, format) => {
  const { pot } = await chrome.runtime.sendMessage({ action: "getPot" });
  if (!pot) return alert("Please enable Closed Captions (CC) and refresh");

  const url = `${track.baseUrl}&fromExt=true&c=WEB&pot=${pot}`;
  const xml = await fetch(url).then((r) => r.text());
  const base = `${document.title.replace(" - YouTube", "")}.${
    track.languageCode
  }`;

  const handlers = {
    srt: () => [
      Utils.downloadFile(XmlParser.toSrt(xml), `${base}.srt`, "text/plain"),
    ],
    json: async () => {
      const parts = await Converters.toJsonParts(xml);
      parts.forEach((content, i) =>
        Utils.downloadFile(
          content,
          parts.length === 1
            ? `${base}.json`
            : `${base}.part${i + 1}of${parts.length}.json`,
          "application/json"
        )
      );
    },
    paragraph: async () => {
      const opts = ["min", "max", "chance"].reduce((o, k) => {
        const v = parseInt(Utils.getParam(`para_${k}`));
        return { ...o, [k]: v || CONFIG.PARAGRAPH_DEFAULTS[k] };
      }, {});
      const txt = await XmlParser.toParagraph(xml, opts);
      Utils.downloadFile(txt, `${base}.txt`, "text/plain");
    },
  };

  await handlers[format]?.();
};

// ============= UI =============
const UI = {
  createLink(track, format) {
    const labels = { json: "JSON", paragraph: "PARA", srt: "SRT" };
    const colors = { json: "#00a67e", paragraph: "#ff6600", srt: "red" };

    const a = Object.assign(document.createElement("a"), {
      textContent: `${track.name.simpleText} [${labels[format]}]`,
      href: "javascript:;",
      title: `Download ${labels[format]}`,
      onclick: () => downloadCaption(track, format),
    });

    Object.assign(a.style, {
      marginLeft: "10px",
      cursor: "pointer",
      color: colors[format],
      textDecoration: "underline",
      fontSize: "15px",
    });

    return a;
  },

  build(tracks) {
    document.getElementById(CONFIG.CONTAINER_ID)?.remove();

    const container = Object.assign(document.createElement("div"), {
      id: CONFIG.CONTAINER_ID,
      textContent: "Subtitle: ",
    });

    Object.assign(container.style, {
      padding: "10px 5px 10px 0",
      margin: "10px 0",
      color: "blue",
      fontSize: "15px",
      lineHeight: "1.5",
    });

    tracks.forEach((track) =>
      ["srt", "json", "paragraph"].forEach((fmt) =>
        container.appendChild(this.createLink(track, fmt))
      )
    );

    state.insertPosition.parentNode.insertBefore(
      container,
      state.insertPosition
    );
    this.buildReverseConverter();
  },

  buildReverseConverter() {
    if (document.getElementById(CONFIG.REVERSE_CONTAINER_ID)) return;

    const container = Object.assign(document.createElement("div"), {
      id: CONFIG.REVERSE_CONTAINER_ID,
    });
    Object.assign(container.style, {
      padding: "10px 5px",
      margin: "10px 0",
      border: "1px solid #ccc",
      borderRadius: "5px",
    });

    const title = Object.assign(document.createElement("h3"), {
      textContent: "Paragraph to JSON Converter",
    });
    title.style.marginTop = "0";

    const input = document.createElement("textarea");
    input.placeholder = "Paste paragraph text here...";
    Object.assign(input.style, {
      width: "98%",
      height: "100px",
      marginBottom: "10px",
      padding: "5px",
    });

    const btn = Object.assign(document.createElement("button"), {
      textContent: "Convert to JSON",
      onclick: () => {
        const text = input.value.trim();
        output.textContent = text
          ? Converters.fromParagraph(text)
          : "Please paste paragraph text.";
      },
    });
    btn.style.padding = "8px 12px";

    const output = document.createElement("pre");
    Object.assign(output.style, {
      marginTop: "10px",
      padding: "10px",
      backgroundColor: "#f5f5f5",
      border: "1px solid #ddd",
      whiteSpace: "pre-wrap",
      maxHeight: "300px",
      overflowY: "auto",
    });

    container.append(title, input, btn, output);
    state.insertPosition.parentNode.insertBefore(
      container,
      state.insertPosition.nextSibling
    );
  },

  showNoSubtitles() {
    [CONFIG.CONTAINER_ID, CONFIG.REVERSE_CONTAINER_ID].forEach((id) =>
      document.getElementById(id)?.remove()
    );

    const div = Object.assign(document.createElement("div"), {
      id: CONFIG.CONTAINER_ID,
      textContent: "No subtitles available",
    });
    state.insertPosition?.parentNode.insertBefore(div, state.insertPosition);
  },
};

// ============= MAIN =============
const extractSubtitles = async (videoId) => {
  const html = await fetch(`https://www.youtube.com/watch?v=${videoId}`).then(
    (r) => r.text()
  );
  const match = html.match(/{"captionTracks":(\[.*?\]),/);
  match ? UI.build(JSON.parse(match[1])) : UI.showNoSubtitles();
};

const checkForChanges = () => {
  const newUrl = location.href;
  if (newUrl !== state.currentUrl) {
    const videoId = Utils.getParam("v");
    state.insertPosition = document.querySelector(
      "#bottom-row, #meta #meta-contents #container #top-row"
    );

    if (videoId && state.insertPosition) {
      state.currentUrl = newUrl;
      extractSubtitles(videoId);
    } else if (!videoId) {
      state.currentUrl = newUrl;
      [CONFIG.CONTAINER_ID, CONFIG.REVERSE_CONTAINER_ID].forEach((id) =>
        document.getElementById(id)?.remove()
      );
    }
  }
  setTimeout(checkForChanges, 500);
};

checkForChanges();
