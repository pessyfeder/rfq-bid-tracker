// Minimal, dependency-free PDF text extraction, used only to scan attachments for bid factors (facts.js).
// Handles Flate-compressed content streams, literal and hex strings in Tj/TJ/'/" operators, and ToUnicode CMaps.
// It will not read scanned (image-only) PDFs, encrypted PDFs, or fonts with custom encodings; those return "".
// The PDFs still go to the model as-is; this only feeds the keyword rules.
const zlib = require("zlib");

// ASCII85 (some generators, e.g. ReportLab, wrap Flate in it)
function a85(raw) {
  const s = raw.toString("latin1").replace(/\s/g, "").replace(/~>[\s\S]*$/, "").replace(/^<~/, "");
  const out = []; let grp = [];
  for (const ch of s) {
    if (ch === "z" && !grp.length) { out.push(0, 0, 0, 0); continue; }
    grp.push(ch.charCodeAt(0) - 33);
    if (grp.length === 5) { let v = 0; for (const g of grp) v = v * 85 + g; out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); grp = []; }
  }
  if (grp.length > 1) { const n = grp.length; while (grp.length < 5) grp.push(84); let v = 0; for (const g of grp) v = v * 85 + g; const b = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]; out.push(...b.slice(0, n - 1)); }
  return Buffer.from(out);
}

function streams(buf) {
  const s = buf.toString("latin1"), out = [];
  const re = /stream\r?\n/g; let m;
  while ((m = re.exec(s))) {
    const start = m.index + m[0].length, end = s.indexOf("endstream", start);
    if (end < 0) break;
    let raw = buf.subarray(start, end);
    const dict = s.slice(Math.max(0, m.index - 400), m.index);
    const d = dict.slice(dict.lastIndexOf("<<"));
    let data = null;
    if (/ASCII85Decode/.test(d)) { try { raw = a85(raw); } catch (e) { re.lastIndex = end + 9; continue; } }
    if (/FlateDecode/.test(d)) { try { data = zlib.inflateSync(raw); } catch (e) { try { data = zlib.inflateSync(raw.subarray(0, raw.length - 1)); } catch (e2) { /* skip */ } } }
    else if (!/Filter/.test(d)) data = raw;
    if (data) out.push(data.toString("latin1"));
    re.lastIndex = end + 9;
  }
  return out;
}

function cmap(streamsText) {
  const map = new Map();
  for (const t of streamsText) {
    if (!/beginbf(char|range)/.test(t)) continue;
    const u = (h) => { let r = ""; for (let i = 0; i + 4 <= h.length; i += 4) r += String.fromCharCode(parseInt(h.slice(i, i + 4), 16)); return r; };
    for (const b of t.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
      for (const p of b[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)) map.set(parseInt(p[1], 16), u(p[2]));
    for (const b of t.matchAll(/beginbfrange([\s\S]*?)endbfrange/g))
      for (const p of b[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*(<([0-9a-f]+)>|\[([^\]]*)\])/gi)) {
        const lo = parseInt(p[1], 16), hi = Math.min(parseInt(p[2], 16), lo + 65535);
        if (p[4]) { const base = u(p[4]); for (let c = lo; c <= hi; c++) map.set(c, base.slice(0, -1) + String.fromCharCode(base.charCodeAt(base.length - 1) + c - lo)); }
        else { const l = [...p[5].matchAll(/<([0-9a-f]+)>/gi)]; for (let c = lo; c <= hi && c - lo < l.length; c++) map.set(c, u(l[c - lo][1])); }
      }
  }
  return map;
}

const ESC = { n: "\n", r: "\r", t: "\t", b: "", f: "", "(": "(", ")": ")", "\\": "\\" };
function unescapeLit(s) {
  return s.replace(/\\([nrtbf()\\]|[0-7]{1,3}|\r?\n)/g, (_, c) => (c in ESC ? ESC[c] : /^[0-7]/.test(c) ? String.fromCharCode(parseInt(c, 8)) : ""));
}

function pdfText(buf, maxChars = 200000) {
  if (!buf || buf.subarray(0, 4).toString() !== "%PDF") return "";
  if (/\/Encrypt\b/.test(buf.toString("latin1", 0, Math.min(buf.length, 4096)) + buf.toString("latin1", Math.max(0, buf.length - 2048)))) return "";
  const all = streams(buf), map = cmap(all);
  const dec = (hex) => {
    if (!map.size) { let r = ""; for (let i = 0; i + 2 <= hex.length; i += 2) r += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16)); return r; }
    const w = hex.length % 4 === 0 && [...map.keys()].some((k) => k > 255) ? 4 : 2; let r = "";
    for (let i = 0; i + w <= hex.length; i += w) { const c = parseInt(hex.slice(i, i + w), 16); r += map.has(c) ? map.get(c) : (w === 2 ? String.fromCharCode(c) : ""); }
    return r;
  };
  let out = "";
  for (const t of all) {
    if (!/\bBT\b/.test(t)) continue;
    for (const bt of t.matchAll(/BT([\s\S]*?)ET/g)) {
      for (const op of bt[1].matchAll(/\[((?:[^\]\\]|\\.)*)\]\s*TJ|(\((?:[^()\\]|\\.)*\)|<[0-9a-fA-F\s]*>)\s*(?:Tj|'|")|(T\*|Td|TD|Tm)\b/g)) {
        if (op[3]) { if (op[3] === "T*") out += "\n"; continue; }
        const body = op[1] !== undefined ? op[1] : op[2];
        for (const p of body.matchAll(/\(((?:[^()\\]|\\.)*)\)|<([0-9a-fA-F\s]*)>|(-?\d+\.?\d*)/g)) {
          if (p[1] !== undefined) out += unescapeLit(p[1]);
          else if (p[2] !== undefined) out += dec(p[2].replace(/\s/g, ""));
          else if (op[1] !== undefined && Number(p[3]) < -200) out += " ";
        }
      }
      out += "\n";
    }
    if (out.length > maxChars) break;
  }
  return out.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").slice(0, maxChars);
}

module.exports = { pdfText };
