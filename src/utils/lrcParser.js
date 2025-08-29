/*  LRC parser + helper utilities
    ---------------------------------------------------
    • parseLrc(text)          →  { meta, cues }
    • cuesToLrc(cues, meta?) →  string
    • shiftCues(cues, ms)    →  cues   (time-shift)
    ---------------------------------------------------
    “cues” is an array of:
    {
      id : number            // incremental
      ms : number            // absolute timestamp in milliseconds
      text : string          // lyric line
    }
*/

const TAG_RX          = /^\[(\w+):(.*?)]$/;               // [ar:Artist]
const TIMESTAMP_RX    = /\[(\d{1,2}:\d{1,2}(?:\.\d{1,3})?)]/g; // [01:23.45]
const ENDING_ZEROES_RX= /\.?0+$/;

/* ---------- helpers ---------- */
const tsToMs = (ts) => {
  const [min, sec] = ts.split(":");
  const [s, frac = "0"] = sec.split(".");
  return (
    parseInt(min, 10) * 60_000 +
    parseInt(s, 10)   * 1000 +
    parseInt(frac.padEnd(3, "0"), 10)
  );
};

const msToTs = (ms) => {
  const abs   = Math.max(ms, 0);
  const m     = Math.floor(abs / 60_000);
  const s     = Math.floor((abs % 60_000) / 1000);
  const frac  = String(abs % 1000).padStart(3, "0").replace(ENDING_ZEROES_RX, "");
  return `[${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${frac ? `.${frac}` : ""}]`;
};

/* ---------- main API ---------- */
export function parseLrc(raw = "") {
  const meta = {};
  const cues = [];

  raw.split(/\r?\n/).forEach((line) => {
    line = line.trim();
    if (!line) return;

    /* meta tag? */
    const tagMatch = line.match(TAG_RX);
    if (tagMatch && !line.match(TIMESTAMP_RX)) {
      meta[tagMatch[1].toLowerCase()] = tagMatch[2];
      return;
    }

    /* lyric line with 1‒n timestamps */
    const stamps = [...line.matchAll(TIMESTAMP_RX)].map((m) => m[0].slice(1, -1));
    const lyric  = line.replace(TIMESTAMP_RX, "").trim();

    stamps.forEach((ts, i) => {
      cues.push({ id: cues.length + 1, ms: tsToMs(ts), text: lyric });
    });
  });

  cues.sort((a, b) => a.ms - b.ms);
  return { meta, cues };
}

export function cuesToLrc(cues = [], meta = {}) {
  const metaLines = Object.entries(meta)
    .map(([k, v]) => `[${k}:${v}]`)
    .join("\n");

  const lyricLines = cues
    .sort((a, b) => a.ms - b.ms)
    .map((c) => `${msToTs(c.ms)}${c.text}`)
    .join("\n");

  return [metaLines, lyricLines].filter(Boolean).join("\n");
}

export function shiftCues(cues = [], deltaMs = 0) {
  return cues.map((c) => ({ ...c, ms: c.ms + deltaMs }));
}
