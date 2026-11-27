/* The replay of one real session, from its trace (site/data/replay_<target>.js, written by website/build_data.py):
   the commands the agent ran, in its own one-line descriptions; every version of model.pdb it wrote, drawn as a ribbon
   over the experimental structure; and the GDT_TS of each version, which was computed after the session.
   Nothing here is simulated: the times, the texts, the coordinates and the scores are the session's. Only the passage
   from one version to the next is interpolated for the eye, and the chain turns slowly so that its shape can be seen. */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const SUB = 5;                                                  // points of the drawn curve per residue
  const PLAY_SECONDS = 48;                                        // the whole session in this many seconds
  const MORPH_SECONDS = 0.8;                                      // one version passes into the next in this many seconds
  const TURN_SECONDS = 30;                                        // one turn of the chain
  const WIDTH = { H: 1.25, E: 1.05, C: 0.3 };                     // half the width of the ribbon, in angstrom
  const STEP = [[2, "#9C4A27", "within 2 Å"], [4, "#C4764F", "within 4 Å"], [8, "#DDA78A", "within 8 Å"], [1e9, "#EDD3C4", "farther"]];
  const NOT_ASSESSED = "#CFC9BC", REFERENCE = "#8D877A", SURFACE = [255, 255, 255];

  function el(tag, cls, text, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function svg(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function two(n) { return (n < 10 ? "0" : "") + n; }

  /* ---- the ribbon of one version: widths from its helices and strands (a strand ends in an arrow head) */
  function widths(ss) {
    const w = [];
    for (let i = 0; i < ss.length; i++) w.push(WIDTH[ss[i]]);
    for (let i = 0; i < ss.length; i++) {
      if (ss[i] === "E" && (i + 1 === ss.length || ss[i + 1] !== "E")) {
        let a = i;
        while (a > 0 && ss[a - 1] === "E") a--;
        if (i - a >= 2) { w[i - 1] = 1.75; w[i] = 0.35; }
      }
    }
    return w;
  }
  function prepare(data) {
    data.versions.forEach(function (v) { v.w = widths(v.ss); });
    /* the view is centred on the experimental structure, the part of the chain that is assessed, and sized to hold it and
       the assessed residues of the submitted model; residues that are not assessed are drawn too and fade where they leave the
       frame (an early version that is far from the answer may reach beyond it) */
    const c = [0, 0, 0];
    data.reference.forEach(function (p) { c[0] += p.ca[0]; c[1] += p.ca[1]; c[2] += p.ca[2]; });
    data.centre = c.map(function (x) { return x / data.reference.length; });
    const far = function (p) { return Math.hypot(p[0] - data.centre[0], p[1] - data.centre[1], p[2] - data.centre[2]); };
    let radius = 0;
    data.reference.forEach(function (p) { radius = Math.max(radius, far(p.ca)); });
    const last = data.versions[data.versions.length - 1];
    last.ca.forEach(function (p, i) { if (last.deviation[i] !== null) radius = Math.max(radius, far(p)); });
    data.radius = radius + 2;
    data.events = data.steps.map(function (s) { return { minute: s.minute, kind: s.kind, text: s.text }; });
    data.versions.forEach(function (v, i) { data.events.push({ minute: v.minute, version: i + 1, text: "model.pdb written: version " + (i + 1) + " of " + data.versions.length }); });
    data.events.sort(function (a, b) { return a.minute - b.minute; });
    data.kindColour = {};
    data.kinds.forEach(function (k) { data.kindColour[k.name] = k.colour; });
  }

  /* Catmull-Rom through the CA atoms: positions, the direction across the ribbon, its half width, the deviation */
  function curve(ca, side, w, dev) {
    const n = ca.length, out = [];
    const at = function (i) { return ca[Math.max(0, Math.min(n - 1, i))]; };
    for (let i = 0; i < n - 1; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      for (let k = 0; k < SUB; k++) {
        const t = k / SUB, t2 = t * t, t3 = t2 * t, p = [0, 0, 0], s = [0, 0, 0];
        for (let a = 0; a < 3; a++) {
          p[a] = 0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3);
          s[a] = side[i][a] * (1 - t) + side[i + 1][a] * t;
        }
        const l = Math.hypot(s[0], s[1], s[2]) || 1;
        out.push({ p: p, s: [s[0] / l, s[1] / l, s[2] / l], w: w[i] * (1 - t) + w[i + 1] * t, d: t < 0.5 ? dev[i] : dev[i + 1] });
      }
    }
    out.push({ p: ca[n - 1].slice(), s: side[n - 1].slice(), w: w[n - 1], d: dev[n - 1] });
    return out;
  }
  function blend(a, b, f) {                                       // between two versions of the same chain
    if (!a || a.ca.length !== b.ca.length || f >= 1) return b;
    const g = f * f * (3 - 2 * f), mix = function (x, y) { return x.map(function (p, i) { return [p[0] + (y[i][0] - p[0]) * g, p[1] + (y[i][1] - p[1]) * g, p[2] + (y[i][2] - p[2]) * g]; }); };
    return { ca: mix(a.ca, b.ca), side: mix(a.side, b.side), w: a.w.map(function (x, i) { return x + (b.w[i] - x) * g; }),
      deviation: a.deviation.map(function (x, i) { const y = b.deviation[i]; return x === null || y === null ? y : x + (y - x) * g; }) };
  }
  function tone(d) {
    if (d === null || d === undefined) return NOT_ASSESSED;
    for (let i = 0; i < STEP.length; i++) if (d < STEP[i][0]) return STEP[i][1];
    return STEP[STEP.length - 1][1];
  }

  function Replay(host, data, opts) {
    opts = opts || {};
    prepare(data);
    const end = data.minutes, rate = end / PLAY_SECONDS;          // minutes of the session per second of the replay
    host.textContent = "";
    host.classList.add("replay");
    if (opts.capture) host.classList.add("capture");

    /* ---- the frame */
    const bar = el("div", "bar", null, host);
    const who = el("span", null, null, bar);
    el("b", null, data.model, who); who.appendChild(document.createTextNode(" · " + data.harness + " · " + data.setting));
    const what = el("span", null, null, bar);
    what.appendChild(document.createTextNode("target ")); el("b", null, data.target, what);
    what.appendChild(document.createTextNode(" · " + data.length + " residues · " + (data["class"] === "No template" ? "no template in the PDB" :
      data["class"].toLowerCase() + " in the PDB" + (data.identity !== null ? " (" + Math.round(data.identity) + "% identical)" : ""))));
    const clock = el("span", "clock", "", bar);
    const stage = el("div", "stage", null, host);
    const log = el("div", "log", null, stage);
    el("div", "head", "What the agent does · its own description of each command", log);
    const lines = el("div", "lines", null, log);
    el("div", "fade", null, log);
    const view = el("div", "view", null, stage);
    el("div", "head", "model.pdb · the agent's current structure", view);
    const canvas = el("canvas", null, null, view), ctx = canvas.getContext("2d");
    /* for the recording of the video: the structure's picture of each frame, ray-traced beforehand (website/render_pymol.py) from the
       same files and the same placement, takes the place of the drawing on the canvas */
    const picture = opts.frames ? el("img", "frame", null, view) : null;
    if (picture) canvas.style.visibility = "hidden";
    const badge = el("div", "badge", null, view), big = el("div", "big", "", badge), small = el("div", "small", "", badge);
    const empty = el("div", "empty", null, view);
    el("b", null, "No model yet.", empty);
    el("div", null, "The agent is given only this sequence of " + data.length + " residues:", empty);
    el("div", "seq", data.sequence, empty);
    const key = el("div", "key", null, view);
    const swatch = function (colour, label) { const s = el("span", null, null, key), i = el("i", null, null, s); i.style.background = colour; s.appendChild(document.createTextNode(label)); };
    el("span", null, "Distance from the experimental position:", key);
    STEP.forEach(function (s) { swatch(s[1], s[2]); });
    if (data.versions[0].deviation.some(function (d) { return d === null; })) swatch(NOT_ASSESSED, "not assessed");
    swatch(REFERENCE, "experimental structure (never shown to the agent)");
    const tl = el("div", "timeline", null, host);
    const foot = el("div", "foot", null, host);
    const button = el("button", "play", "▶", foot);
    button.setAttribute("aria-label", "Play or pause the replay");
    const hint = el("span", null, "Replay of the real session at " + Math.round(rate * 60) + "× speed. Drag the structure to turn it; click the timeline to jump.", foot);

    /* ---- the timeline: the score of every version (computed after the session) and every command, by kind */
    let TW = 0, tsvg = null, head = null, revealed = null, tx = null;
    const TH = 150, TL = 40, TR = 16, TT = 24, TB = 46, limit = data.limit;
    function timeline() {
      TW = tl.clientWidth - 36;
      if (TW <= 0) return;
      tl.textContent = "";
      tsvg = svg("svg", { viewBox: "0 0 " + TW + " " + TH }, tl);
      tx = function (m) { return TL + (TW - TL - TR) * m / limit; };
      const ty = function (v) { return TT + (TH - TT - TB) * (1 - v / 100); };
      [0, 50, 100].forEach(function (v) {
        svg("line", { x1: TL, x2: TW - TR, y1: ty(v), y2: ty(v), stroke: v ? "#E8E3D7" : "#D9D4C8", "stroke-width": 1 }, tsvg);
        const t = svg("text", { x: TL - 7, y: ty(v) + 4, "text-anchor": "end" }, tsvg); t.textContent = String(v);
      });
      const yl = svg("text", { x: 0, y: 10 }, tsvg); yl.textContent = "GDT_TS of each version (computed after the session)";
      if (data.af3 !== null) {
        svg("line", { x1: TL, x2: TW - TR, y1: ty(data.af3), y2: ty(data.af3), stroke: "#2D2A23", "stroke-width": 1.2, "stroke-dasharray": "5 4" }, tsvg);
        const t = svg("text", { x: TW - TR, y: ty(data.af3) + (data.af3 > 90 ? 14 : -5), "text-anchor": "end" }, tsvg); t.textContent = "AlphaFold 3 at CASP16: " + Math.round(data.af3);
        if (tx(end) + 110 > TW - TR - 175) { t.setAttribute("x", TL + 8); t.setAttribute("text-anchor", "start"); }      // no room at the right: the name goes to the left end
      }
      /* the score as steps: zero until the first model, then each version's score until the next one */
      let d = "M" + tx(0) + "," + ty(0);
      data.versions.forEach(function (v) { d += "H" + tx(v.minute) + "V" + ty(v.gdt_ts); });
      d += "H" + tx(end);
      const clip = svg("clipPath", { id: "rev-" + data.target }, svg("defs", {}, tsvg));
      revealed = svg("rect", { x: 0, y: 0, width: 0, height: TH }, clip);
      svg("path", { d: d, fill: "none", stroke: "#D9D4C8", "stroke-width": 1.5 }, tsvg);
      const g = svg("g", { "clip-path": "url(#rev-" + data.target + ")" }, tsvg);
      svg("path", { d: d, fill: "none", stroke: "#B5613C", "stroke-width": 2, "stroke-linejoin": "round" }, g);
      data.versions.forEach(function (v) { svg("circle", { cx: tx(v.minute), cy: ty(v.gdt_ts), r: 4, fill: "#B5613C", stroke: "#fff", "stroke-width": 2 }, g); });
      const y0 = TH - TB + 10;
      data.steps.forEach(function (s) { svg("rect", { x: tx(s.minute) - 1, y: y0, width: 2, height: 10, fill: data.kindColour[s.kind], opacity: 0.85 }, tsvg); });
      for (let m = 0; m <= limit; m += 30) { const t = svg("text", { x: tx(m), y: TH - 12, "text-anchor": "middle" }, tsvg); t.textContent = String(m); }
      const xl = svg("text", { x: tx(limit / 2), y: TH, "text-anchor": "middle" }, tsvg); xl.textContent = "Minutes into the session (limit: " + limit + ")";
      svg("line", { x1: tx(end), x2: tx(end), y1: TT, y2: y0 + 10, stroke: "#6B655A", "stroke-width": 1 }, tsvg);
      const last = data.versions[data.versions.length - 1].gdt_ts, ey = last > 55 ? ty(last) + 18 : ty(last) - 22;
      const et = svg("text", { x: tx(end) + 6, y: ey }, tsvg); et.textContent = "the agent ends";
      const et2 = svg("text", { x: tx(end) + 6, y: ey + 13 }, tsvg); et2.textContent = "its session";
      head = svg("line", { x1: tx(0), x2: tx(0), y1: TT - 4, y2: y0 + 12, stroke: "#2D2A23", "stroke-width": 1.5 }, tsvg);
      const seek = function (e) {
        const b = tsvg.getBoundingClientRect(), m = ((e.clientX - b.left) / b.width * TW - TL) / (TW - TL - TR) * limit;
        state.seconds = Math.max(0, Math.min(end, m)) / rate;
        draw();
      };
      let dragging = false;
      tsvg.addEventListener("pointerdown", function (e) { dragging = true; tsvg.setPointerCapture(e.pointerId); seek(e); });
      tsvg.addEventListener("pointermove", function (e) { if (dragging) seek(e); });
      tsvg.addEventListener("pointerup", function () { dragging = false; });
    }
    const kindKey = el("span", "spacer", null, foot);
    data.kinds.forEach(function (k) {
      const s = el("span", null, null, kindKey), i = el("i", null, null, s);
      i.style.cssText = "display:inline-block;width:8px;height:8px;border-radius:2px;margin:0 5px 0 12px;background:" + k.colour;
      s.appendChild(document.createTextNode(k.name));
    });

    /* ---- state */
    const state = { seconds: opts.start || 0, playing: false, yaw: 0.6, pitch: -0.25, spin: 0, shown: -1, last: null };

    function resize() {
      const dpr = opts.capture ? 2 : Math.min(2, window.devicePixelRatio || 1);
      const w = view.clientWidth, h = view.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      return [w, h, dpr];
    }

    function structure(minute) {
      /* which version stands at this minute, and how far the passage from the one before has gone */
      let k = -1;
      for (let i = 0; i < data.versions.length; i++) if (data.versions[i].minute <= minute) k = i;
      if (k < 0) return null;
      const v = data.versions[k], f = (minute - v.minute) / (MORPH_SECONDS * rate);
      return { k: k, f: f, shape: blend(k > 0 ? data.versions[k - 1] : null, v, f) };
    }

    function paint(minute) {
      const size = resize(), w = size[0], h = size[1], dpr = size[2];
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const st = structure(minute);
      empty.style.display = st ? "none" : "flex";
      key.style.visibility = st ? "visible" : "hidden";
      if (!st) { big.textContent = ""; small.textContent = ""; if (picture) picture.style.display = "none"; return; }
      const v = data.versions[st.k], ended = minute >= end - 1e-6;
      big.textContent = v.gdt_ts.toFixed(1);
      small.textContent = "";
      small.appendChild(document.createTextNode("GDT_TS of " + (ended ? "the submitted model" : "version " + (st.k + 1) + " of " + data.versions.length)));
      small.appendChild(document.createElement("br"));
      small.appendChild(document.createTextNode("scored after the session; the agent never sees it"));
      if (picture) { picture.style.display = "block"; return; }
      const yaw = state.yaw + state.spin, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
      const c = data.centre, scale = Math.min(w - 40, h - 150) / (2 * data.radius), ox = w / 2, oy = (h - 30) / 2 + 22;
      const rot = function (p, centred) {
        const x = centred ? p[0] : p[0] - c[0], y = centred ? p[1] : p[1] - c[1], z = centred ? p[2] : p[2] - c[2];
        const x1 = cy * x + sy * z, z1 = -sy * x + cy * z, y1 = cp * y - sp * z1, z2 = sp * y + cp * z1;
        return [x1, y1, z2];
      };
      const items = [];
      const cv = curve(st.shape.ca, st.shape.side, st.shape.w, st.shape.deviation);
      const edge = cv.map(function (q) {
        const p = rot(q.p), s = rot(q.s, true);
        const out = Math.hypot(p[0], p[1], p[2]) - data.radius;
        return { a: [p[0] + s[0] * q.w, p[1] + s[1] * q.w, p[2] + s[2] * q.w], b: [p[0] - s[0] * q.w, p[1] - s[1] * q.w, p[2] - s[2] * q.w], p: p, s: s, d: q.d,
          fade: q.d === null || q.d === undefined ? Math.max(0, Math.min(1, 1 - out / (0.55 * data.radius))) : 1 };
      });
      for (let i = 0; i + 1 < edge.length; i++) {
        const e = edge[i], g = edge[i + 1], t = [g.p[0] - e.p[0], g.p[1] - e.p[1], g.p[2] - e.p[2]];
        const nx = e.s[1] * t[2] - e.s[2] * t[1], ny = e.s[2] * t[0] - e.s[0] * t[2], nz = e.s[0] * t[1] - e.s[1] * t[0], nl = Math.hypot(nx, ny, nz) || 1;
        if (e.fade > 0.02) items.push({ z: (e.p[2] + g.p[2]) / 2, q: [e.a, g.a, g.b, e.b], colour: tone(e.d), light: 0.62 + 0.38 * Math.abs(nz / nl), fade: e.fade });
      }
      let prev = null;
      data.reference.forEach(function (r) {                       // the experimental structure: a thin grey trace through its CA atoms
        const p = rot(r.ca);
        if (prev && r.number - prev.number === 1) items.push({ z: (p[2] + prev.p[2]) / 2 - 0.01, line: [prev.p, p] });
        prev = { number: r.number, p: p };
      });
      items.sort(function (a, b) { return a.z - b.z; });
      const X = function (p) { return ox + p[0] * scale; }, Y = function (p) { return oy - p[1] * scale; };
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      const alpha = st.k === 0 ? Math.min(1, Math.max(0.05, st.f)) : 1;
      items.forEach(function (it) {
        const fog = Math.max(0, Math.min(1, (data.radius - it.z) / (2 * data.radius))) * 0.42;
        if (it.line) {
          const g = hex(REFERENCE).map(function (x) { return Math.round(x + (SURFACE[0] - x) * fog); });
          ctx.globalAlpha = 0.9; ctx.strokeStyle = "rgb(" + g.join(",") + ")"; ctx.lineWidth = Math.max(1.5, 0.28 * scale);
          ctx.beginPath(); ctx.moveTo(X(it.line[0]), Y(it.line[0])); ctx.lineTo(X(it.line[1]), Y(it.line[1])); ctx.stroke();
          return;
        }
        const base = hex(it.colour), col = base.map(function (x) { const lit = x * it.light + 255 * (1 - it.light) * 0.25; return Math.round(lit + (SURFACE[0] - lit) * fog); });
        ctx.globalAlpha = alpha * it.fade; ctx.fillStyle = ctx.strokeStyle = "rgb(" + col.join(",") + ")"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(X(it.q[0]), Y(it.q[0]));
        for (let k = 1; k < 4; k++) ctx.lineTo(X(it.q[k]), Y(it.q[k]));
        ctx.closePath(); ctx.fill(); ctx.stroke();
        /* a dark line along both edges of the ribbon, as in a ray-traced cartoon: nearer parts paint over the edges of farther ones */
        const edge = base.map(function (x) { const dark = x * 0.32; return Math.round(dark + (SURFACE[0] - dark) * fog); });
        ctx.strokeStyle = "rgb(" + edge.join(",") + ")"; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(X(it.q[0]), Y(it.q[0])); ctx.lineTo(X(it.q[1]), Y(it.q[1]));
        ctx.moveTo(X(it.q[3]), Y(it.q[3])); ctx.lineTo(X(it.q[2]), Y(it.q[2])); ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }

    function writeLog(minute) {
      let n = 0;
      while (n < data.events.length && data.events[n].minute <= minute) n++;
      const ended = minute >= end - 1e-6, id = n + (ended ? 0.5 : 0);
      if (id === state.shown) return;
      state.shown = id;
      lines.textContent = "";
      const from = Math.max(0, n - 18);
      for (let i = from; i < n; i++) {
        const e = data.events[i], ln = el("div", "ln" + (e.version ? " ver" : "") + (i === n - 1 && !ended ? " now" : ""), null, lines);
        el("span", "m", String(Math.floor(e.minute)) + "′", ln);
        const k = el("span", "k", null, ln);
        k.style.background = e.version ? "#2D2A23" : data.kindColour[e.kind];
        el("span", "x", e.text, ln);
      }
      if (ended) {
        const ln = el("div", "ln ver now", null, lines);
        el("span", "m", Math.floor(end) + "′", ln); el("span", "k", null, ln);
        el("span", "x", "The agent ends its session: model.pdb is submitted.", ln);
      }
      if (n === 0) {
        const ln = el("div", "ln now", null, lines);
        el("span", "m", "0′", ln); el("span", "k", null, ln).style.background = "#A39C8C";
        el("span", "x", "The session begins: one sequence, a terminal, three hours.", ln);
      }
    }

    function draw() {
      const minute = Math.max(0, Math.min(end, state.seconds * rate));
      state.spin = state.seconds * 2 * Math.PI / TURN_SECONDS;
      clock.textContent = "minute " + Math.floor(minute) + " of the session";
      writeLog(minute);
      paint(minute);
      if (!tsvg || Math.abs(tl.clientWidth - 36 - TW) > 2) timeline();
      if (head) { const x = tx(minute); head.setAttribute("x1", x); head.setAttribute("x2", x); revealed.setAttribute("width", x + 0.5); }
      button.textContent = state.playing ? "❚❚" : (minute >= end ? "↺" : "▶");
    }

    function tick(now) {
      if (!state.playing) return;
      if (state.last !== null) state.seconds += (now - state.last) / 1000;
      state.last = now;
      if (state.seconds >= PLAY_SECONDS + 4) { state.playing = false; state.seconds = PLAY_SECONDS; }
      draw();
      if (state.playing) requestAnimationFrame(tick);
    }
    function play() { if (state.seconds >= PLAY_SECONDS) state.seconds = 0; state.playing = true; state.last = null; requestAnimationFrame(tick); }
    function pause() { state.playing = false; draw(); }
    button.addEventListener("click", function () { if (state.playing) pause(); else play(); });

    /* turning the chain by hand */
    let grab = null;
    canvas.addEventListener("pointerdown", function (e) { grab = [e.clientX, e.clientY, state.yaw, state.pitch]; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", function (e) {
      if (!grab) return;
      state.yaw = grab[2] + (e.clientX - grab[0]) * 0.01;
      state.pitch = Math.max(-1.5, Math.min(1.5, grab[3] + (e.clientY - grab[1]) * 0.01));
      if (!state.playing) draw();
    });
    canvas.addEventListener("pointerup", function () { grab = null; });
    if (window.ResizeObserver) new ResizeObserver(function () { if (!state.playing) draw(); }).observe(host);

    draw();
    return {
      play: play, pause: pause, data: data, seconds: PLAY_SECONDS,
      /* for the recording: the picture at a given second of the replay (beyond the last second: the final state, still turning) */
      renderAt: function (seconds, frame) {
        state.playing = false; state.seconds = Math.max(0, seconds); draw();
        const m = Math.min(end, state.seconds * rate);
        if (!picture || frame === undefined || !structure(m)) return Promise.resolve({ minute: m });
        picture.src = opts.frames + "/s" + String(frame).padStart(5, "0") + ".png";
        return picture.decode().then(function () { return { minute: m }; });
      },
      seekMinute: function (m) { state.seconds = m / rate; draw(); }
    };
  }

  window.DFBReplayView = Replay;
})();
