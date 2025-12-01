import { unescapeHTML } from "./formats.js";

const CJK =
  /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u30FF\uAC00-\uD7AF\u0E00-\u0E7F\u1780-\u17FF\u0E80-\u0EFF\u1000-\u109F]/;
const WS = /\s+/g;

let compounds = null;

const loadCompounds = async () => {
  if (compounds !== null) return compounds;
  try {
    const dict = await (await fetch(chrome.runtime.getURL("data.json"))).json();
    compounds = new Set();
    for (const [a, bs] of Object.entries(dict))
      for (const b of bs) compounds.add(`${a} ${b}`);
    return compounds;
  } catch {
    compounds = new Set();
    return compounds;
  }
};

const processCompounds = (tokens, set) => {
  if (!set?.size || !tokens?.length) return tokens;
  const res = [];
  let i = 0;
  while (i < tokens.length) {
    if (i + 1 < tokens.length) {
      const a = tokens[i].normalize("NFC"),
        b = tokens[i + 1].normalize("NFC");
      const am = a.match(/^(.*?)([.,!?;:)]*)$/),
        bm = b.match(/^(.*?)([.,!?;:)]*)$/);
      const ac = am?.[1] || a,
        ap = am?.[2] || "",
        bc = bm?.[1] || b,
        bp = bm?.[2] || "";
      if (!ap && set.has(`${ac.toLowerCase()} ${bc.toLowerCase()}`)) {
        res.push(`<<${ac} ${bc}>>${bp}`);
        i += 2;
        continue;
      }
    }
    res.push(tokens[i++]);
  }
  return res;
};

const removeMarkers = (t) =>
  typeof t === "string" ? t.replace(/<<|>>/g, "") : t;

export const seededRng = (s) => {
  let v = s;
  return () => ((v = (v * 9301 + 49297) % 233280), v / 233280);
};

const getMarker = (ex, rng) => {
  const c = "abcdefghijklmnopqrstuvwxyz";
  let m;
  do m = c[~~(rng() * 26)];
  while (ex.includes(m));
  return m;
};

const unusedMarker = (used) => {
  for (const c of "abcdefghijklmnopqrstuvwxyz") if (!used.has(c)) return c;
  return "z";
};

const isCJK = (t) => CJK.test(t);

export const countTokens = (t) => {
  if (!t) return 0;
  return isCJK(t)
    ? Intl.Segmenter
      ? [
          ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
            t
          ),
        ].length
      : [...t].length
    : t.trim().split(WS).filter(Boolean).length;
};

const r3 = (n) => Math.round(n * 1000) / 1000;

const orderOrig = (g) => {
  const o = {};
  [
    "state",
    "translation",
    "groupIndex",
    "groupMarker",
    "groupStart",
    "groupEnd",
    "groupText",
    "groupLength",
    "nextMarkers",
    "isLeading",
    "isTrailing",
    "from",
  ].forEach((k) => {
    if (g[k] !== undefined) o[k] = g[k];
  });
  return o;
};

const orderRev = (g) => {
  const o = {};
  [
    "state",
    "groupMarker",
    "groupText",
    "groupLength",
    "nextGroupMarker",
    "isLeading",
    "isTrailing",
  ].forEach((k) => {
    if (g[k] !== undefined) o[k] = g[k];
  });
  return o;
};

const parseXml = (xml) =>
  new DOMParser().parseFromString(
    window.trustedTypes
      ?.createPolicy("c", { createHTML: (s) => s })
      .createHTML(xml) ?? xml,
    "text/xml"
  );

const extractCaps = (doc) =>
  [...doc.getElementsByTagName("text")]
    .map((n) => {
      const s = +n.getAttribute("start");
      const t = unescapeHTML(
        (n.childNodes[0]?.nodeValue || "")
          .replace(/\\n/g, " ")
          .replace(/\\"/g, '"')
          .trim()
      );
      return t
        ? {
            start: ~~(s * 1000),
            end: ~~((s + +n.getAttribute("dur")) * 1000),
            text: t,
          }
        : null;
    })
    .filter(Boolean);

const calcRatios = (groups, si, ei) => {
  const sl = groups.slice(si, ei + 1);
  if (!sl.length) return { groupRatio: [], captionRatio: [] };
  const tot = sl.reduce((s, g) => s + g.groupLength, 0);
  if (!tot)
    return {
      groupRatio: sl.map(() => 0),
      captionRatio: sl.map((g) => g.from.map(() => 0)),
    };
  const gr = sl.map((g) => r3(g.groupLength / tot));
  return {
    groupRatio: gr,
    captionRatio: sl.map((g, j) =>
      g.from.map((c) => r3((c.captionLength / g.groupLength || 0) * gr[j]))
    ),
  };
};

export const generateGroups = (xml, size) => {
  const caps = extractCaps(parseXml(xml)),
    groups = [],
    markers = [],
    rng = seededRng(0);

  for (let i = 0; i < caps.length; i += size) {
    const chunk = caps.slice(i, i + size);
    if (!chunk.length) continue;
    const m = getMarker(markers.slice(-6), rng);
    markers.push(m);
    const txt = chunk.map((c) => c.text).join(" ");
    groups.push({
      groupIndex: groups.length,
      groupStart: chunk[0].start,
      groupEnd: chunk.at(-1).end,
      groupText: txt,
      groupLength: countTokens(txt),
      groupMarker: m,
      nextMarkers: [],
      from: chunk.map((c, j) => ({
        captionIndex: i + j,
        captionStart: c.start,
        captionEnd: c.end,
        captionText: c.text,
        captionLength: countTokens(c.text),
      })),
    });
  }

  if (groups.length) {
    const pm = unusedMarker(new Set(markers));
    markers.push(pm);
    const last = groups.at(-1);
    groups.push({
      groupIndex: groups.length,
      groupStart: last.groupEnd,
      groupEnd: last.groupEnd,
      groupText: "",
      groupLength: 0,
      groupMarker: pm,
      nextMarkers: [],
      isTrailing: true,
      from: [],
    });
  }

  groups.forEach((g, i) => {
    g.nextMarkers = markers.slice(i + 1, i + 5);
    if (i === 0) g.isLeading = true;
  });
  return groups;
};

const preprocess = (revGroups) => {
  const merged = [],
    log = [];
  let i = 0;
  while (i < revGroups.length) {
    const cur = structuredClone(revGroups[i]),
      idxs = [i];
    if (cur.groupMarker === cur.nextGroupMarker) {
      const parts = [cur.groupText];
      let j = i + 1,
        cnt = 0;
      while (
        j < revGroups.length &&
        revGroups[j].groupMarker === cur.groupMarker &&
        cnt < 100
      ) {
        const nx = revGroups[j];
        parts.push(nx.groupText);
        cur.nextGroupMarker = nx.nextGroupMarker;
        if (nx.isTrailing) cur.isTrailing = true;
        idxs.push(j);
        if (nx.nextGroupMarker !== cur.groupMarker) break;
        j++;
        cnt++;
      }
      cur.groupText = parts.join(" ");
      cur.groupLength = countTokens(cur.groupText);
      if (idxs.length > 1)
        log.push({
          marker: cur.groupMarker,
          mergedIndices: [...idxs],
          mergedCount: idxs.length,
          resultingText: cur.groupText,
        });
      i = j;
    } else i++;
    merged.push(cur);
  }
  return { merged, log };
};

const isPad = (g) => g.isTrailing && g.groupText === "";

export const mapReversedToOriginal = (orig, rev) => {
  const { merged, log } = preprocess(rev);
  let oi = orig.findIndex((g) => g.isLeading),
    ri = merged.findIndex((g) => g.isLeading);
  if (oi === -1 || ri === -1) return { error: "Starting point not found" };

  const res = {
    original: structuredClone(orig).map((g) => ({ ...g, translation: "" })),
    reversed: structuredClone(merged),
    preprocessing: { mergedGroups: log.length, mergeDetails: log },
    mapping: [],
  };

  while (ri < merged.length && oi < orig.length) {
    let found = false,
      marker = null,
      mc = 0;
    for (let a = 0; a <= 4 && !found; a++) {
      const ci = ri + a;
      if (ci >= merged.length)
        return { error: "Reached end without match", partialResult: res };
      const rg = merged[ci],
        og = orig[oi],
        sm = rg.nextGroupMarker;

      if (isPad(rg) && isPad(og)) {
        res.original[oi].state = "matched";
        res.original[oi].translation = "";
        res.reversed[ci].state = "matched";
        found = true;
        break;
      }
      if ((!sm || !Object.keys(sm).length) && rg.isTrailing) {
        res.original[oi].state = "matched";
        res.original[oi].translation = merged[ci].groupText;
        res.reversed[ci].state = "matched";
        found = true;
        break;
      }
      if (!sm) break;
      if (og.nextMarkers?.includes(sm)) {
        found = true;
        marker = sm;
        mc = a;
        break;
      }
      if (a === 4)
        return {
          error: "No match after 4 attempts",
          partialResult: res,
          failedAt: { oi, ri },
        };
    }

    if (found && marker) {
      res.original[oi].state = "matched";
      const parts = [];
      for (let x = 0; x <= mc; x++) {
        const idx = ri + x;
        if (idx < merged.length) {
          parts.push(merged[idx].groupText);
          res.reversed[idx].state = mc > 0 ? "merged-matched" : "matched";
        }
      }
      res.original[oi].translation = parts.join(" ");
      const ni = orig.findIndex(
        (g, idx) => idx > oi && g.groupMarker === marker
      );
      res.mapping.push({
        originalIndex: oi,
        originalMarker: orig[oi].groupMarker,
        reversedStartIndex: ri,
        reversedEndIndex: ri + mc,
        reversedMarkers: merged
          .slice(ri, ri + mc + 1)
          .map((g) => g.groupMarker),
        matchedNextMarker: marker,
        nextGroupIndex: ni,
        groupOffset: ni !== -1 ? ni - oi : 0,
        mergeCount: mc,
        translationText: parts.join(" "),
      });
      if (ni !== -1) oi = ni;
      else break;
      ri += mc + 1;
    } else if (found) break;
    else break;
  }

  res.original.forEach((g) => {
    if (!g.state) g.state = "unmatched";
  });
  res.reversed.forEach((g) => {
    if (!g.state) g.state = "unmatched";
  });
  res.original = res.original.map(orderOrig);
  res.reversed = res.reversed.map(orderRev);
  return res;
};

const splitCJK = (t) => {
  if (!t) return [];
  return isCJK(t)
    ? Intl.Segmenter
      ? [
          ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
            t
          ),
        ].map((s) => s.segment)
      : [...t]
    : t.trim().split(WS).filter(Boolean);
};

export const distributeTranslation = async (mapped) => {
  const { original, mapping } = mapped;
  const res = structuredClone(mapped);
  const set = await loadCompounds();

  const stats = {
    totalCaptionsWithTranslation: 0,
    captionsPerGroup: res.original.map((g) => ({
      groupIndex: g.groupIndex,
      groupMarker: g.groupMarker,
      translatedCaptions: 0,
      totalCaptions: g.from.length,
    })),
  };

  res.original.forEach((g) => g.from.forEach((c) => (c.translatedText = "")));

  mapping.forEach((m) => {
    const { originalIndex: oi, nextGroupIndex: ni, translationText: tt } = m;
    if (!tt?.trim()) return;
    const ei = ni !== -1 ? ni - 1 : res.original.length - 1;
    const { groupRatio: gr, captionRatio: cr } = calcRatios(
      res.original,
      oi,
      ei
    );
    const raw = splitCJK(tt),
      proc = processCompounds(raw, set),
      cjk = isCJK(tt);

    res.original[oi].translation = removeMarkers(proc.join(cjk ? "" : " "));
    const tot = proc.length;
    if (!tot) return;

    let ti = 0;
    gr.forEach((_, go) => {
      const tgi = oi + go;
      if (tgi >= res.original.length) return;
      const tg = res.original[tgi],
        tcr = cr[go];
      if (!tcr) return;
      tcr.forEach((ratio, ci) => {
        if (ci >= tg.from.length) return;
        const cnt = Math.round(tot * ratio),
          end = Math.min(ti + cnt, tot);
        const toks = proc.slice(ti, end);
        ti = end;
        if (toks.length) {
          tg.from[ci].translatedText = removeMarkers(toks.join(cjk ? "" : " "));
          stats.captionsPerGroup[tgi].translatedCaptions++;
        }
      });
    });

    if (ti < tot) {
      const lgi = oi + gr.length - 1;
      if (lgi < res.original.length) {
        const lg = res.original[lgi],
          lci = lg.from.length - 1;
        if (lci >= 0) {
          const ex = lg.from[lci].translatedText || "";
          const add = removeMarkers(proc.slice(ti).join(cjk ? "" : " "));
          lg.from[lci].translatedText = ex + (ex && !cjk ? " " : "") + add;
        }
      }
    }
  });

  stats.totalCaptionsWithTranslation = stats.captionsPerGroup.reduce(
    (s, g) => s + g.translatedCaptions,
    0
  );
  res.distribution = stats;
  return res;
};
