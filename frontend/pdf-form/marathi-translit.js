/**
 * marathi-translit.js — offline English→Marathi (Devanagari) phonetic transliteration.
 * Rule-based and deterministic; the UI always shows the result for review/correction
 * before it is applied to a field.
 *
 *   MarathiTranslit.convert("ramesh apte")  → "रमेश अप्टे"
 *   Capitals pick retroflex / special letters inside a word: T ट, Th ठ, D ड, Dh ढ,
 *   N ण, L ळ, Sh ष, M ं (anusvara), H ः.  Long vowels: aa/A ा, ee/ii/I ी, oo/uu/U ू.
 */
(function (global) {
  "use strict";

  const CONS = {
    ksh: "क्ष", dny: "ज्ञ", gny: "ज्ञ", shr: "श्र", chh: "छ",
    kh: "ख", gh: "घ", ch: "च", jh: "झ", Th: "ठ", Dh: "ढ", th: "थ", dh: "ध",
    ph: "फ", bh: "भ", Sh: "ष", sh: "श", gy: "ज्ञ",
    k: "क", g: "ग", c: "क", j: "ज", z: "झ", T: "ट", D: "ड", N: "ण", t: "त", d: "द", n: "न",
    p: "प", f: "फ", b: "ब", m: "म", y: "य", r: "र", l: "ल", L: "ळ", v: "व", w: "व",
    s: "स", h: "ह", q: "क", x: "क्ष",
  };
  // [independent, matra]
  const VOW = {
    aa: ["आ", "ा"], ai: ["ऐ", "ै"], au: ["औ", "ौ"], ee: ["ई", "ी"], ii: ["ई", "ी"],
    oo: ["ऊ", "ू"], uu: ["ऊ", "ू"], ou: ["औ", "ौ"],
    A: ["आ", "ा"], I: ["ई", "ी"], U: ["ऊ", "ू"], R: ["ऋ", "ृ"], E: ["ऍ", "ॅ"], O: ["ऑ", "ॉ"],
    a: ["अ", ""], i: ["इ", "ि"], u: ["उ", "ु"], e: ["ए", "े"], o: ["ओ", "ो"],
  };
  const SIGNS = { M: "ं", H: "ः" };
  // n/m before these consonants is written as anusvara (संजय, पंडित, मुंबई) …
  const NASAL_BEFORE = new Set(["क", "ख", "ग", "घ", "च", "छ", "ज", "झ", "ट", "ठ", "ड", "ढ",
    "त", "थ", "द", "ध", "प", "फ", "ब", "भ", "स", "श", "ष", "क्ष"]);
  // … but not before m/y/r/v/h/n (चिन्मयी, कन्या).

  const consKeys = Object.keys(CONS).sort((a, b) => b.length - a.length);
  const vowKeys = Object.keys(VOW).sort((a, b) => b.length - a.length);

  function matchAt(word, i, keys) {
    for (const k of keys) if (word.startsWith(k, i)) return k;
    return null;
  }

  function convertWord(raw) {
    // "Ramesh" / "RAMESH" are just capitalised names → treat as lowercase.
    const rest = raw.slice(1);
    let word = raw;
    if (raw === raw.toUpperCase() || rest === rest.toLowerCase()) word = raw.toLowerCase();

    // tokenise
    const toks = [];
    for (let i = 0; i < word.length;) {
      const c = matchAt(word, i, consKeys);
      if (c) { toks.push({ t: "c", v: CONS[c], k: c }); i += c.length; continue; }
      const v = matchAt(word, i, vowKeys);
      if (v) { toks.push({ t: "v", v: VOW[v], k: v }); i += v.length; continue; }
      const s = SIGNS[word[i]];
      toks.push(s ? { t: "s", v: s } : { t: "o", v: word[i] });
      i += 1;
    }

    let out = "";
    let prevCons = false;
    for (let i = 0; i < toks.length; i++) {
      const tk = toks[i], next = toks[i + 1];
      if (tk.t === "c") {
        const nasal = (tk.k === "n" || tk.k === "m") && !prevCons && i > 0 &&
          next && next.t === "c" && NASAL_BEFORE.has(next.v);
        if (nasal) { out += "ं"; prevCons = false; continue; }
        if (prevCons) out += "्";
        out += tk.v;
        prevCons = true;
      } else if (tk.t === "v") {
        // word-final short "a" after a consonant reads as "ा" (शिल्पा, रमा)
        const finalA = tk.k === "a" && prevCons && i === toks.length - 1 && toks.length > 2;
        if (prevCons) out += finalA ? "ा" : tk.v[1];
        else out += tk.v[0];
        prevCons = false;
      } else {
        out += tk.v;
        prevCons = false;
      }
    }
    return out;
  }

  function convert(text) {
    return String(text || "").replace(/[A-Za-z]+/g, convertWord);
  }

  global.MarathiTranslit = { convert, convertWord };
})(typeof window !== "undefined" ? window : globalThis);
