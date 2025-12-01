const ENT = /&(?:amp|quot|lt|gt|#39);/g;
const ENTS = {
  "&amp;": "&",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
  "&#39;": "'",
};
const NL = /\n+/g,
  SP = /\s+/g,
  MK = /\(([a-z])\)/;

export const unescapeHTML = (t) => t.replace(ENT, (m) => ENTS[m]);
export const formatJson = (o, n = 2) => JSON.stringify(o, null, n);
export const toJson = (g) => formatJson(g, 2);

const isPad = (g) => g.isTrailing && g.groupText === "";
const unused = (used) => {
  for (const c of "abcdefghijklmnopqrstuvwxyz") if (!used.has(c)) return c;
  return "z";
};

export const toPara = (groups, seededRng) => {
  const rng = seededRng(1),
    paras = [],
    reg = groups.filter((g) => !isPad(g));
  let i = 0,
    carry = null;
  while (i < reg.length) {
    const len = ~~(rng() * 7) + 3,
      end = Math.min(i + len, reg.length);
    let txt = carry ? `${carry} ` : "";
    reg.slice(i, end).forEach((g, j, a) => {
      if (j === a.length - 1 && end < reg.length) {
        const w = g.groupText.split(" "),
          m = ~~(w.length / 2);
        txt += `(${g.groupMarker}) ${w.slice(0, m).join(" ")}`;
        carry = w.slice(m).join(" ");
      } else txt += `(${g.groupMarker}) ${g.groupText} `;
    });
    paras.push(txt.trim());
    i = end;
  }
  return paras.join("\n\n");
};

export const fromPara = (txt, countTokens) => {
  const parts = txt.replace(NL, " ").replace(SP, " ").trim().split(MK),
    groups = [];
  for (let i = 1; i < parts.length; i += 2) {
    const [m, t] = [parts[i], parts[i + 1]?.trim()];
    if (m && t)
      groups.push({
        groupMarker: m,
        groupText: t,
        groupLength: countTokens(t),
      });
  }
  if (groups.length)
    groups.push({
      groupMarker: unused(new Set(groups.map((g) => g.groupMarker))),
      groupText: "",
      groupLength: 0,
      isTrailing: true,
    });
  groups.forEach((g, i) => {
    g.nextGroupMarker = groups[i + 1]?.groupMarker ?? null;
    if (i === 0) g.isLeading = true;
  });
  return groups;
};

const msTime = (ms, fmt) => {
  const s = Math.floor(ms / 1000),
    h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60,
    mil = ms % 1000;
  const p = (n, l = 2) => String(n).padStart(l, "0");
  return `${p(h)}:${p(m)}:${p(sec)}${fmt === "vtt" ? "." : ","}${p(mil, 3)}`;
};

export const toSRT = (res, trans = false) => {
  const caps = [];
  res.original.forEach((g) =>
    g.from.forEach((c) => {
      const t = trans ? c.translatedText || c.captionText : c.captionText;
      if (t?.trim())
        caps.push({
          i: c.captionIndex + 1,
          s: c.captionStart,
          e: c.captionEnd,
          t: t.trim(),
        });
    })
  );
  return caps
    .map(
      (c) => `${c.i}\n${msTime(c.s, "srt")} --> ${msTime(c.e, "srt")}\n${c.t}\n`
    )
    .join("\n");
};

export const toVTT = (res, trans = false) => {
  const caps = [];
  res.original.forEach((g) =>
    g.from.forEach((c) => {
      const t = trans ? c.translatedText || c.captionText : c.captionText;
      if (t?.trim())
        caps.push({ s: c.captionStart, e: c.captionEnd, t: t.trim() });
    })
  );
  return `WEBVTT\n\n${caps
    .map((c) => `${msTime(c.s, "vtt")} --> ${msTime(c.e, "vtt")}\n${c.t}\n`)
    .join("\n")}`;
};
