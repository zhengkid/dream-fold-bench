/* The charts and tables of the page, drawn from window.DFB (site/data/data.js, written by website/build_data.py).
   Plain SVG and DOM; no library. Names and values are set with textContent. */
(function () {
  "use strict";
  const D = window.DFB;
  const NS = "http://www.w3.org/2000/svg";
  const COLOUR = { "Claude Code": "#B5613C", "Gemini CLI": "#3A78B2", "Codex CLI": "#6A9A3A" };
  const INK = "#000000", MUTED = "#6B7385", RULE = "#D9DDE4", SOFT = "#E9ECF0", SURFACE = "#FFFFFF";
  const DASHED = { fable51: 1, opus5: 1, flash38: 1, gemini31pro: 1 };         // the earlier model of a pair: a dashed line, as in the paper
  const MODEL = {};
  D.models.forEach(function (m) { MODEL[m.key] = m; });
  const FOOT = { hydrogen: "†" };

  function svg(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function el(tag, cls, text, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, s, attrs) {
    const t = svg("text", Object.assign({ x: x, y: y }, attrs || {}), parent);
    t.textContent = s;
    return t;
  }
  /* a number as the paper's tables print it (Python's formatting): a value exactly half way between two whole numbers goes
     to the even one, where toFixed would go up */
  function fx(v, d) {
    if (v === null || v === undefined) return "–";
    v = Number(v);
    if (d === 0) { const f = Math.floor(v); if (v - f === 0.5) return String(f % 2 === 0 ? f : f + 1); }
    return v.toFixed(d);
  }
  function colourOf(key) { return COLOUR[MODEL[key].harness]; }

  /* one tooltip per chart: a title and rows (key stroke, name, value) */
  function tooltip(host) {
    const tip = el("div", "tip", null, host);
    return {
      show: function (px, py, title, rows) {
        tip.textContent = "";
        el("div", "t", title, tip);
        rows.forEach(function (r) {
          const row = el("div", "row" + (r.dim ? " dim" : ""), null, tip);
          if (r.colour) { const i = el("i", null, null, row); i.style.borderTopColor = r.colour; if (r.dashed) i.style.borderTopStyle = "dashed"; }
          el("span", null, r.name, row);
          el("b", null, r.value, row);
        });
        tip.style.display = "block";
        const w = tip.offsetWidth, h = tip.offsetHeight, W = host.clientWidth;
        let x = px + 14, y = py - h / 2;
        if (x + w > W) x = px - w - 14;
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        tip.style.left = x + "px";
        tip.style.top = y + "px";
      },
      hide: function () { tip.style.display = "none"; }
    };
  }
  function responsive(host, draw) {
    let last = 0;
    const go = function () { const w = host.clientWidth; if (w >= 200 && Math.abs(w - last) > 2) { last = w; draw(w); } };       // not before the layout has given it room
    if (window.ResizeObserver) new ResizeObserver(go).observe(host); else window.addEventListener("resize", go);
    go();
    return function () { last = 0; go(); };
  }
  function clear(host) { while (host.firstChild) host.removeChild(host.firstChild); }
  function pointer(e, host) { const b = host.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; }

  /* ------------------------------------------------------------------------------------------------ the leaderboard */
  const METRIC = { gdt_ts: { name: "GDT_TS", max: 100, digits: 1, step: 20 }, tm: { name: "TM-score", max: 1, digits: 2, step: 0.2 }, lddt: { name: "lDDT", max: 100, digits: 1, step: 20 } };
  function cell(key, setting, metric) {
    const c = D.main[key][setting];
    return c && c[metric] ? c[metric] : null;
  }
  function leaderboard(host, state) {
    return responsive(host, function (W) {
      clear(host);
      const M = METRIC[state.metric], rows = D.models, narrow = W < 560, small = narrow ? "font-size:11.5px" : "";
      const right = narrow ? 40 : 58, top = narrow ? 32 : 30, rowH = narrow ? 24 : 30, bar = narrow ? 13 : 16, foot = narrow ? 44 : 34;
      const H = top + rows.length * rowH + foot;
      const s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Leaderboard: mean " + M.name + " of every agent" }, host);
      let left = 176;
      if (narrow) {                                              // in a panel: as much room for the names as the longest one needs, measured
        let widest = 0;
        rows.forEach(function (m) { const q = text(s, 0, -40, m.short + (FOOT[m.key] || ""), { class: "name", style: small }); widest = Math.max(widest, q.getComputedTextLength()); s.removeChild(q); });
        left = Math.ceil(widest) + 14;
      }
      const x = function (v) { return left + (W - left - right) * v / M.max; };
      for (let v = 0; v <= M.max + 1e-9; v += M.step) {
        svg("line", { x1: x(v), x2: x(v), y1: top - 6, y2: H - foot + 4, class: v === 0 ? "axis" : "grid" }, s);
        text(s, x(v), H - foot + 20, M.max === 1 ? v.toFixed(1) : String(Math.round(v)), { "text-anchor": "middle", style: small });
      }
      const average = state.setting === "average";
      const setting = average ? null : state.setting;
      const tip = tooltip(host);
      /* the reference: AlphaFold 3 at CASP16 on the same units (it had the databases; not shown with the average of the two settings) */
      const af = D.references.filter(function (r) { return r.name === "AlphaFold 3"; })[0];
      if (af && !average) {
        const v = state.metric === "lddt" ? af.lddt : af[state.metric];
        svg("line", { x1: x(v), x2: x(v), y1: top - 8, y2: H - foot + 4, stroke: INK, "stroke-width": 1.5, "stroke-dasharray": "5 4" }, s);
        text(s, x(v), top - 14, "AlphaFold 3 · " + fx(v, M.digits), { "text-anchor": "middle", class: "name", style: small });
      }
      rows.forEach(function (m, i) {
        const y = top + i * rowH + rowH / 2;
        const c = average ? null : cell(m.key, setting, state.metric);
        const value = average ? (state.metric === "gdt_ts" ? D.main[m.key].average : (function () {
          const a = cell(m.key, "closed", state.metric), b = cell(m.key, "open", state.metric);
          return a && b ? (a.mean + b.mean) / 2 : null;
        })()) : (c ? c.mean : null);
        text(s, left - 10, y + 4, (narrow ? m.short : m.label) + (FOOT[m.key] || ""), { "text-anchor": "end", class: "name", style: small });
        if (value === null) { text(s, left + 6, y + 4, "no finished run"); return; }
        const x1 = x(value), r = 4, x0 = x(0);
        const w = Math.max(x1 - x0, r);
        svg("path", { d: "M" + x0 + "," + (y - bar / 2) + "h" + (w - r) + "a" + r + "," + r + " 0 0 1 " + r + "," + r + "v" + (bar - 2 * r) + "a" + r + "," + r + " 0 0 1 " + (-r) + "," + r + "h" + (-(w - r)) + "z",
          fill: COLOUR[m.harness] }, s);
        let end = x1;
        if (c && c.sd !== null && c.sd !== undefined) {
          const a = x(Math.max(0, value - c.sd)), b = x(value + c.sd);
          svg("line", { x1: a, x2: b, y1: y, y2: y, stroke: INK, "stroke-width": 1 }, s);
          svg("line", { x1: a, x2: a, y1: y - 3.5, y2: y + 3.5, stroke: INK, "stroke-width": 1 }, s);
          svg("line", { x1: b, x2: b, y1: y - 3.5, y2: y + 3.5, stroke: INK, "stroke-width": 1 }, s);
          end = b;
        }
        text(s, end + (narrow ? 5 : 7), y + 4, fx(value, M.digits), { class: "value", style: small });
        if (setting === "open") {                               // the same model without databases, on the same line
          const o = cell(m.key, "closed", state.metric);
          if (o) svg("circle", { cx: x(o.mean), cy: y, r: 4.5, fill: SURFACE, stroke: INK, "stroke-width": 1.6 }, s);
        }
        const hit = svg("rect", { x: 0, y: y - rowH / 2, width: W, height: rowH, fill: "transparent", tabindex: 0 }, s);
        const show = function (e) {
          const p = e && e.clientX !== undefined ? pointer(e, host) : [x1, y];
          const line = function (name, set) {
            const q = cell(m.key, set, state.metric);
            return { name: name, value: q ? fx(q.mean, M.digits) + (q.sd !== null && q.sd !== undefined ? " ± " + fx(q.sd, M.digits) : "") + "  (" + D.main[m.key][set].runs + " runs)" : "–" };
          };
          const list = [line("Closed-book", "closed"), line("Open-book", "open")];
          if (state.metric === "gdt_ts") list.push({ name: "Average of the two", value: fx(D.main[m.key].average, 1) });
          tip.show(p[0], p[1], m.label + " · " + m.harness, list);
        };
        hit.addEventListener("pointermove", show);
        hit.addEventListener("focus", show);
        hit.addEventListener("pointerleave", tip.hide);
        hit.addEventListener("blur", tip.hide);
      });
      text(s, x(M.max / 2), H - (narrow ? 8 : 0), "Mean " + M.name + (narrow ? "" : " over " + D.counts.units + " evaluation units") + (average ? ", average of the two settings" : setting === "open" ? ", open-book" : ", closed-book"),
        { "text-anchor": "middle", style: small });
    });
  }

  function legendItem(parent, cls, colour, label) {
    const s = el("span", null, null, parent), i = el("i", cls, null, s);
    if (colour) { if (cls === "line" || cls === "dash") i.style.borderTopColor = colour; else if (cls === "ring") i.style.borderColor = colour; else i.style.background = colour; }
    s.appendChild(document.createTextNode(label));
  }
  function harnessLegend(host, extra) {
    clear(host);
    legendItem(host, "", COLOUR["Claude Code"], "Claude models (Claude Code)");
    legendItem(host, "", COLOUR["Gemini CLI"], "Gemini models (Gemini CLI)");
    legendItem(host, "", COLOUR["Codex CLI"], "GPT model (Codex CLI)");
    (extra || []).forEach(function (x) { legendItem(host, x[0], x[1], x[2]); });
  }

  /* ------------------------------------------------------------------------------------------------ the main table */
  function pm(c, digits, runs) {
    const td = document.createElement("td");
    if (!c) { td.textContent = "–"; return td; }
    td.appendChild(document.createTextNode(fx(c.mean, digits)));
    if (c.sd !== null && c.sd !== undefined) el("span", "sd", " ± " + fx(c.sd, digits), td);
    if (runs) el("sup", null, String(runs), td);
    return td;
  }
  function mainTable(host) {
    clear(host);
    const t = el("table", "data", null, host), head = el("thead", null, null, t);
    const h1 = el("tr", null, null, head);
    [["", 3, "l"], ["Closed-book", 3, "c"], ["Open-book", 3, "c"], ["Average", 1, ""]].forEach(function (g) { const th = el("th", g[2], g[0], h1); th.colSpan = g[1]; });
    const h2 = el("tr", null, null, head);
    ["Rank", "Model", "Agent harness", "GDT_TS", "TM", "lDDT", "GDT_TS", "TM", "lDDT", "GDT_TS"].forEach(function (n, i) { el("th", i === 1 || i === 2 ? "l" : "", n, h2); });
    const body = el("tbody", null, null, t);
    const best = { closed: 0, open: 0, average: 0 };
    D.models.forEach(function (m) { const r = D.main[m.key]; best.closed = Math.max(best.closed, r.closed.gdt_ts.mean); best.open = Math.max(best.open, r.open.gdt_ts.mean); best.average = Math.max(best.average, r.average); });
    D.models.forEach(function (m) {
      const r = D.main[m.key], tr = el("tr", null, null, body);
      el("td", null, String(m.rank), tr);
      const name = el("td", "l", null, tr), sw = el("span", "sw", null, name);
      sw.style.background = COLOUR[m.harness];
      name.appendChild(document.createTextNode(m.label + (FOOT[m.key] ? " " + FOOT[m.key] : "")));
      el("td", "l", m.harness, tr);
      ["closed", "open"].forEach(function (s) {
        const g = pm(r[s].gdt_ts, 1, r[s].runs);
        if (Math.abs(r[s].gdt_ts.mean - best[s]) < 1e-9) g.className = "best";
        tr.appendChild(g); tr.appendChild(pm(r[s].tm, 2)); tr.appendChild(pm(r[s].lddt, 1));
      });
      const a = el("td", Math.abs(r.average - best.average) < 1e-9 ? "best" : "", fx(r.average, 1), tr);
      a.title = "mean of the closed-book and the open-book GDT_TS";
    });
    D.references.forEach(function (x, i) {
      const tr = el("tr", "ref" + (i === 0 ? " group" : ""), null, body);
      el("td", null, "–", tr); el("td", "l", x.name, tr); el("td", "l", "CASP16 predictor (neural network)", tr);
      ["–", "–", "–", fx(x.gdt_ts, 1), fx(x.tm, 2), fx(x.lddt, 1), "–"].forEach(function (v) { el("td", null, v, tr); });
    });
  }

  /* ------------------------------------------------------------------------------------------------ by template */
  function templateChart(host, height) {
    const T = D.template, shown = T.shown;
    return responsive(host, function (W) {
      clear(host);
      const narrow = W < 620, left = narrow ? 30 : 40, right = narrow ? 10 : 178, top = narrow ? 26 : 14, H = height || 360, bottom = narrow ? 40 : 52;
      const s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Mean GDT_TS by template availability" }, host);
      const y = function (v) { return top + (H - top - bottom) * (1 - v / 100); };
      const band = (W - left - right) / T.classes.length;
      const cx = function (i) { return left + band * (i + 0.5); };
      for (let v = 0; v <= 100; v += 20) {
        svg("line", { x1: left, x2: W - right, y1: y(v), y2: y(v), class: v === 0 ? "axis" : "grid" }, s);
        text(s, left - 8, y(v) + 4, String(v), { "text-anchor": "end" });
      }
      T.classes.forEach(function (c, i) {
        svg("rect", { x: cx(i) - band * 0.38, y: y(100), width: band * 0.76, height: y(0) - y(100), fill: "#F1F3F6", opacity: 0.7, rx: 4 }, s);
        text(s, cx(i), H - (narrow ? 24 : 30), narrow ? c.name.replace(" template", "").replace(/^No$/, "None") : c.name, { "text-anchor": "middle", class: "name", style: narrow ? "font-size:11.5px" : "" });
        text(s, cx(i), H - (narrow ? 8 : 14), narrow ? "n = " + c.targets : c.targets + " targets", { "text-anchor": "middle", style: narrow ? "font-size:11.5px" : "" });
      });
      const path = function (vals) { return vals.map(function (v, i) { return (i ? "L" : "M") + cx(i) + "," + y(v); }).join(""); };
      const med = T.classes.map(function (c) { return c.median; }), af = T.classes.map(function (c) { return c.af3; });
      svg("path", { d: path(med), fill: "none", stroke: MUTED, "stroke-width": 2, "stroke-linejoin": "round" }, s);
      svg("path", { d: path(af), fill: "none", stroke: INK, "stroke-width": 2, "stroke-linejoin": "round" }, s);
      T.classes.forEach(function (c, i) {
        shown.forEach(function (m, j) {
          const dx = (j - (shown.length - 1) / 2) * Math.min(band * 0.052, 13);       // all the dots of a type stay inside its band
          svg("circle", { cx: cx(i) + dx, cy: y(T.models[m][i]), r: 5, fill: colourOf(m), stroke: SURFACE, "stroke-width": 2 }, s);
        });
        svg("circle", { cx: cx(i), cy: y(c.af3), r: 5, fill: INK, stroke: SURFACE, "stroke-width": 2 }, s);
      });
      if (!narrow) {
        const n = T.classes.length - 1;
        text(s, cx(n) + band * 0.4, y(af[n]) + 4, "AlphaFold 3", { class: "name" });
        text(s, cx(n) + band * 0.4, y(med[n]) - 2, "Agents, open-book", { class: "name" });
        text(s, cx(n) + band * 0.4, y(med[n]) + 13, "(median of " + shown.length + ")");
      }
      const tip = tooltip(host);
      T.classes.forEach(function (c, i) {
        const hit = svg("rect", { x: cx(i) - band / 2, y: top, width: band, height: H - top - bottom, fill: "transparent", tabindex: 0 }, s);
        const show = function (e) {
          const p = e && e.clientX !== undefined ? pointer(e, host) : [cx(i), 80];
          const rows = [{ name: "AlphaFold 3", value: fx(c.af3, 1), colour: INK }, { name: "Agents, median", value: fx(c.median, 1), colour: MUTED }];
          shown.slice().sort(function (a, b) { return T.models[b][i] - T.models[a][i]; }).forEach(function (m) {
            rows.push({ name: MODEL[m].label, value: fx(T.models[m][i], 1), colour: colourOf(m) });
          });
          tip.show(p[0], p[1], c.name + " · " + c.targets + " targets", rows);
        };
        hit.addEventListener("pointermove", show); hit.addEventListener("focus", show);
        hit.addEventListener("pointerleave", tip.hide); hit.addEventListener("blur", tip.hide);
      });
      text(s, 10, top + 2, "", {});
    });
  }
  function templateTable(host) {
    clear(host);
    const T = D.template, t = el("table", "data", null, host), h = el("tr", null, null, el("thead", null, null, t));
    el("th", "l", "Mean GDT_TS, open-book", h);
    T.classes.forEach(function (c) { el("th", null, c.name + " (" + c.targets + ")", h); });
    const body = el("tbody", null, null, t);
    const row = function (name, vals, cls, colour) {
      const tr = el("tr", cls || "", null, body), td = el("td", "l", null, tr);
      if (colour) { const sw = el("span", "sw", null, td); sw.style.background = colour; }
      td.appendChild(document.createTextNode(name));
      vals.forEach(function (v) { el("td", null, fx(v, 1), tr); });
    };
    T.shown.forEach(function (m) { row(MODEL[m].label, T.models[m], "", colourOf(m)); });
    row("Agents, median", T.classes.map(function (c) { return c.median; }), "group");
    row("AlphaFold 3 (CASP16)", T.classes.map(function (c) { return c.af3; }), "ref");
  }

  /* ------------------------------------------------------------------------------------------------ over time */
  function timeChart(host, state, height) {                     // state: "open" / "closed", or an object whose .setting says which
    const T = D.time;
    return responsive(host, function (W) {
      clear(host);
      const setting = typeof state === "string" ? state : state.setting, series = T.shown.filter(function (m) { return T[setting][m]; });
      const left = 30, right = 92, top = 14, H = height || 300, bottom = 52;
      let max = 0;
      series.forEach(function (m) { max = Math.max(max, Math.max.apply(null, T[setting][m])); });
      const step = max > 40 ? 20 : max > 20 ? 10 : 5, top_v = Math.ceil(max / step) * step;
      const s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Mean GDT_TS over the minutes of a session, " + setting + "-book" }, host);
      const x = function (v) { return left + (W - left - right) * v / 180; }, y = function (v) { return top + (H - top - bottom) * (1 - v / top_v); };
      for (let v = 0; v <= top_v; v += step) { svg("line", { x1: left, x2: W - right, y1: y(v), y2: y(v), class: v === 0 ? "axis" : "grid" }, s); text(s, left - 7, y(v) + 4, String(v), { "text-anchor": "end" }); }
      for (let v = 0; v <= 180; v += 30) text(s, x(v), H - 30, String(v), { "text-anchor": "middle" });
      text(s, x(90), H - 14, "Session time (minutes)", { "text-anchor": "middle" });
      const ends = [];
      series.forEach(function (m) {
        const v = T[setting][m];
        svg("path", { d: v.map(function (q, i) { return (i ? "L" : "M") + x(T.minutes[i]).toFixed(1) + "," + y(q).toFixed(1); }).join(""), fill: "none", stroke: colourOf(m), "stroke-width": 2,
          "stroke-linejoin": "round", "stroke-linecap": "round", "stroke-dasharray": DASHED[m] ? "5 4" : "" }, s);
        ends.push({ m: m, y: y(v[v.length - 1]), at: y(v[v.length - 1]) });
      });
      /* names at the lines' ends, moved apart where they would meet, each tied to its line by a thin leader */
      ends.sort(function (a, b) { return a.y - b.y; });
      for (let i = 1; i < ends.length; i++) if (ends[i].at - ends[i - 1].at < 13) ends[i].at = ends[i - 1].at + 13;
      const over = ends.length ? ends[ends.length - 1].at - (H - bottom) : 0;
      if (over > 0) ends.forEach(function (e) { e.at -= over; });
      for (let i = ends.length - 2; i >= 0; i--) if (ends[i + 1].at - ends[i].at < 13) ends[i].at = ends[i + 1].at - 13;
      ends.forEach(function (e) {
        svg("path", { d: "M" + (W - right + 2) + "," + e.y + "L" + (W - right + 12) + "," + e.at, stroke: RULE, "stroke-width": 1, fill: "none" }, s);
        svg("circle", { cx: W - right + 16, cy: e.at, r: 3, fill: colourOf(e.m) }, s);
        text(s, W - right + 23, e.at + 4, MODEL[e.m].short, { class: "name", "font-size": "11.5" });
      });
      const cross = svg("line", { y1: top, y2: H - bottom, stroke: MUTED, "stroke-width": 1, visibility: "hidden" }, s);
      const tip = tooltip(host);
      const hit = svg("rect", { x: left, y: top, width: W - left - right, height: H - top - bottom, fill: "transparent" }, s);
      hit.addEventListener("pointermove", function (e) {
        const p = pointer(e, host), minute = Math.max(0, Math.min(180, (p[0] - left) / (W - left - right) * 180));
        const i = Math.round(minute / 3), xi = x(T.minutes[i]);
        cross.setAttribute("x1", xi); cross.setAttribute("x2", xi); cross.setAttribute("visibility", "visible");
        const rows = series.slice().sort(function (a, b) { return T[setting][b][i] - T[setting][a][i]; }).map(function (m) {
          return { name: MODEL[m].label, value: fx(T[setting][m][i], 1), colour: colourOf(m), dashed: !!DASHED[m] };
        });
        tip.show(xi, p[1], "After " + T.minutes[i] + " minutes", rows);
      });
      hit.addEventListener("pointerleave", function () { cross.setAttribute("visibility", "hidden"); tip.hide(); });
    });
  }
  function timeTable(host) {
    clear(host);
    const T = D.time, marks = [30, 60, 90, 120, 150, 180];
    const t = el("table", "data", null, host), h = el("tr", null, null, el("thead", null, null, t));
    el("th", "l", "Mean GDT_TS after", h); el("th", "l", "", h);
    marks.forEach(function (m) { el("th", null, m + " min", h); });
    const body = el("tbody", null, null, t);
    T.shown.forEach(function (m) {
      ["closed", "open"].forEach(function (set, k) {
        const tr = el("tr", k === 0 ? "group" : "", null, body), td = el("td", "l", null, tr);
        if (k === 0) { const sw = el("span", "sw", null, td); sw.style.background = colourOf(m); td.appendChild(document.createTextNode(MODEL[m].label)); }
        el("td", "l", set + "-book", tr);
        marks.forEach(function (q) { el("td", null, fx(T[set][m][T.minutes.indexOf(q)], 1), tr); });
      });
    });
  }

  /* ------------------------------------------------------------------------------------------------ the feedback */
  function feedbackTable(host) {
    clear(host);
    const control = D.feedback.some(function (r) { return r.open.none; });
    const t = el("table", "data", null, host), head = el("thead", null, null, t), h1 = el("tr", null, null, head);
    [["", 1, "l"], ["Closed-book", 3, "c"], ["Open-book", control ? 5 : 3, "c"]].forEach(function (g) { const th = el("th", g[2], g[0], h1); th.colSpan = g[1]; });
    const h2 = el("tr", null, null, head);
    ["Model", "Geometry + physics", "Rosetta", "Diff.", "Geometry + physics", "Rosetta", "Diff."].concat(control ? ["No evaluator", "Diff."] : []).forEach(function (n, i) { el("th", i ? "wrap" : "l", n, h2); });
    const body = el("tbody", null, null, t);
    const diff = function (a, b) { if (!a || !b) return "–"; const d = b.mean - a.mean; return (Math.abs(d) < 0.05 ? "0.0" : (d > 0 ? "+" : "−") + Math.abs(d).toFixed(1)); };
    D.feedback.forEach(function (r) {
      const m = MODEL[r.model], tr = el("tr", null, null, body), td = el("td", "l", null, tr), sw = el("span", "sw", null, td);
      sw.style.background = COLOUR[m.harness]; td.appendChild(document.createTextNode(m.label));
      ["closed", "open"].forEach(function (s) {
        tr.appendChild(pm(r[s].gp, 1, r[s].gp && r[s].gp.runs)); tr.appendChild(pm(r[s].ros, 1, r[s].ros && r[s].ros.runs)); el("td", null, diff(r[s].gp, r[s].ros), tr);
        if (s === "open" && control) { tr.appendChild(pm(r[s].none, 1, r[s].none && r[s].none.runs)); el("td", null, diff(r[s].gp, r[s].none), tr); }
      });
    });
  }
  function signalsChart(host) {
    const rows = D.signals;
    return responsive(host, function (W) {
      clear(host);
      const narrow = W < 600, right = narrow ? 44 : 52, top = 30, rowH = 26, H = top + rows.length * rowH + 36, small = narrow ? "font-size:11.5px" : "";
      const s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "How often each feedback signal prefers the better of two attempts" }, host);
      const label = function (r) { return r.name.charAt(0).toUpperCase() + r.name.slice(1); };
      let left = 290;
      if (narrow) {                                              // as much room for the names as the longest one needs, measured
        let widest = 0;
        rows.forEach(function (r) { const m = text(s, 0, -40, label(r), { class: "name", style: small }); widest = Math.max(widest, m.getComputedTextLength()); s.removeChild(m); });
        left = Math.ceil(widest) + 14;
      }
      const x = function (v) { return left + (W - left - right) * v / 100; };
      [0, 25, 50, 75, 100].forEach(function (v) {
        svg("line", { x1: x(v), x2: x(v), y1: top - 4, y2: H - 32, class: v === 0 ? "axis" : "grid" }, s);
        if (!narrow || v % 50 === 0) text(s, x(v), H - 16, v + "%", { "text-anchor": "middle", style: small });
      });
      svg("line", { x1: x(50), x2: x(50), y1: top - 8, y2: H - 32, stroke: INK, "stroke-width": 1.5, "stroke-dasharray": "5 4" }, s);
      text(s, x(50), top - 14, "chance", { "text-anchor": "middle", class: "name" });
      const tip = tooltip(host);
      rows.forEach(function (r, i) {
        const y = top + i * rowH + rowH / 2;
        text(s, left - 10, y + 4, label(r), { "text-anchor": "end", class: "name", style: small });
        svg("line", { x1: x(0), x2: x(100), y1: y, y2: y, stroke: SOFT, "stroke-width": 1 }, s);
        if (r.any !== null) svg("circle", { cx: x(r.any), cy: y, r: 4.5, fill: SURFACE, stroke: MUTED, "stroke-width": 1.6 }, s);
        if (r.same !== null) svg("circle", { cx: x(r.same), cy: y, r: 5.5, fill: INK, stroke: SURFACE, "stroke-width": 2 }, s);
        text(s, W - right + 10, y + 4, fx(r.same, 0) + "%", { class: "value", style: small });
        const hit = svg("rect", { x: 0, y: y - rowH / 2, width: W, height: rowH, fill: "transparent", tabindex: 0 }, s);
        const show = function (e) {
          const p = e && e.clientX !== undefined ? pointer(e, host) : [x(r.same), y];
          tip.show(p[0], p[1], r.name.charAt(0).toUpperCase() + r.name.slice(1), [
            { name: "Two attempts of one agent, same setting", value: fx(r.same, 0) + "%  (" + r.n_same.toLocaleString("en-US") + " pairs)" },
            { name: "Any two models of one target", value: fx(r.any, 0) + "%  (" + r.n_any.toLocaleString("en-US") + " pairs)" },
            { name: "Two versions within one session", value: fx(r.versions, 0) + "%  (" + r.n_versions.toLocaleString("en-US") + " pairs)" }]);
        };
        hit.addEventListener("pointermove", show); hit.addEventListener("focus", show);
        hit.addEventListener("pointerleave", tip.hide); hit.addEventListener("blur", tip.hide);
      });
      if (narrow) text(s, W - 6, H - 0, "Pairs in which the signal prefers the better model", { "text-anchor": "end", style: small });
      else text(s, x(50), H - 0, "Pairs in which the signal prefers the model with the higher GDT_TS", { "text-anchor": "middle" });
    });
  }

  /* ------------------------------------------------------------------------------------------------ what the sessions do */
  function behaviourTable(host) {
    clear(host);
    const t = el("table", "data", null, host), head = el("thead", null, null, t), h1 = el("tr", null, null, head);
    [["", 1, "l"], ["Pace", 2, "c"], ["Sessions that use (%)", 3, "c"], ["Feedback", 2, "c"], ["", 1, ""]].forEach(function (g) { const th = el("th", g[2], g[0], h1); th.colSpan = g[1]; });
    const h2 = el("tr", null, null, head);
    ["Model", "Minutes to first model", "Versions of the model", "HH-suite", "MMseqs2", "HMMER", "Evaluator calls per session", "Sessions that use the renderer (%)", "GDT_TS"].forEach(function (n, i) { el("th", i ? "" : "l", n, h2); });
    const body = el("tbody", null, null, t);
    D.behaviour.forEach(function (r) {
      const m = MODEL[r.model], tr = el("tr", null, null, body), td = el("td", "l", null, tr), sw = el("span", "sw", null, td);
      sw.style.background = COLOUR[m.harness]; td.appendChild(document.createTextNode(m.label));
      [r.first, r.versions, r.hhsuite, r.mmseqs, r.hmmer, r.evaluator, r.viewer].forEach(function (v) { el("td", null, fx(v, 0), tr); });
      el("td", null, fx(r.gdt_ts, 1), tr);
    });
  }

  /* ------------------------------------------------------------------------------------------------ every target */
  function shade(v) {                                           // one hue, light to dark: the warm grey of the page towards its ink
    const a = [244, 245, 247], b = [20, 22, 26], f = Math.max(0, Math.min(1, v / 100)), g = Math.pow(f, 1.15);
    const c = a.map(function (q, i) { return Math.round(q + (b[i] - q) * g); });
    return { bg: "rgb(" + c.join(",") + ")", fg: g > 0.52 ? "#FFFFFF" : INK };
  }
  function targetsTable(host, setting) {
    clear(host);
    const order = ["Close template", "Remote template", "Partial template", "No template"];
    const t = el("table", "heat", null, host), h = el("tr", null, null, el("thead", null, null, t));
    el("th", null, "", h);
    D.models.forEach(function (m) { const th = el("th", "rot", null, h); el("div", null, m.short, th); });
    el("th", null, "", h);
    const af = el("th", "rot", null, h); el("div", null, "AlphaFold 3", af);
    const body = el("tbody", null, null, t);
    order.forEach(function (name) {
      const mine = D.targets.filter(function (x) { return x["class"] === name; }).sort(function (a, b) { return (b.af3 || 0) - (a.af3 || 0) || a.target.localeCompare(b.target); });
      const tr = el("tr", null, null, body), td = el("td", "cl", name + " · " + mine.length + " targets", tr);
      td.colSpan = D.models.length + 3;
      mine.forEach(function (x) {
        const r = el("tr", null, null, body);
        const lab = el("td", "t", x.target, r);
        lab.title = x.length + " residues" + (x.identity !== null ? "; best match in the archive: " + x.chain + ", " + Math.round(x.identity) + "% identical over " + Math.round(100 * x.coverage) + "% of the sequence" : "; no match in the archive");
        D.models.forEach(function (m) {
          const v = x[setting][m.key], c = el("td", null, v === undefined ? "" : fx(v, 0), r);
          if (v !== undefined) { const q = shade(v); c.style.background = q.bg; c.style.color = q.fg; c.title = m.label + " on " + x.target + ", " + setting + "-book: " + v.toFixed(1); }
        });
        el("td", "sep", "", r);
        const a = el("td", null, x.af3 === null ? "" : fx(x.af3, 0), r);
        if (x.af3 !== null) { const q = shade(x.af3); a.style.background = q.bg; a.style.color = q.fg; a.title = "AlphaFold 3 on " + x.target + " at CASP16: " + x.af3.toFixed(1); }
      });
    });
  }

  /* ------------------------------------------------------------------------------------------------ CASP12: beside the methods of 2016 */
  const NEUTRAL = "#9AA0A6";                                      // the groups of 2016: neither of the three harnesses
  const AGENT_COLOUR = { fable52: COLOUR["Claude Code"], neon: COLOUR["Gemini CLI"] };
  function c12Rows(cls, servers) {
    const C = D.casp12, val = function (x) { return cls === "all" ? x.gdt_ts : x.by_class[cls]; };
    const rows = C.experiments.map(function (e) { return { name: e.name, value: val(e), colour: AGENT_COLOUR[e.model], agent: true, e: e }; });
    C.servers.slice(0, servers).forEach(function (s) { rows.push({ name: s.name, value: val(s), colour: NEUTRAL, agent: false, e: s }); });
    return rows.sort(function (a, b) { return b.value - a.value; });
  }
  const HUMAN = "#5B616A";                                        // the human expert groups of 2016: darker than the servers
  function c12Short(n) { return n.replace("Claude ", "").replace("Gemini 4 ", "").replace("BAKER-ROSETTASERVER", "ROSETTASERVER"); }
  /* horizontal bars, one row per method; in a panel of the three-part figure (narrow) the names are short and the axis ends at 60 */
  function c12BarPanel(host, rowsFn, axisFn, tipFn, aria, largest) {
    return responsive(host, function (W) {
      clear(host);
      const rows = rowsFn(), compact = W < 560, right = compact ? 38 : 58, top = 8, rowH = compact ? 24 : 30, bar = compact ? 13 : 16,
        max = compact ? Math.max(60, Math.ceil((largest || 0) / 20) * 20) : 100, H = top + rows.length * rowH + 36, small = compact ? "font-size:11.5px" : "";
      const s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": aria }, host);
      let left = 236;
      if (compact) {                                             // as much room for the names as the longest one needs, measured
        let widest = 0;
        rows.forEach(function (r) { const m = text(s, 0, -40, c12Short(r.name), { class: "name", "font-weight": r.agent ? "700" : "400", style: small }); widest = Math.max(widest, m.getComputedTextLength()); s.removeChild(m); });
        left = Math.ceil(widest) + 14;
      }
      const x = function (v) { return left + (W - left - right) * v / max; };
      for (let v = 0; v <= max; v += 20) { svg("line", { x1: x(v), x2: x(v), y1: top - 4, y2: H - 32, class: v === 0 ? "axis" : "grid" }, s); text(s, x(v), H - 18, String(v), { "text-anchor": "middle", style: small }); }
      const tip = tooltip(host);
      rows.forEach(function (r, i) {
        const y = top + i * rowH + rowH / 2, x0 = x(0), w = Math.max(x(r.value) - x0, 4), q = 4;
        text(s, left - 8, y + 4, compact ? c12Short(r.name) : r.name, { "text-anchor": "end", class: "name", "font-weight": r.agent ? "700" : "400", style: small });
        svg("path", { d: "M" + x0 + "," + (y - bar / 2) + "h" + (w - q) + "a" + q + "," + q + " 0 0 1 " + q + "," + q + "v" + (bar - 2 * q) + "a" + q + "," + q + " 0 0 1 " + (-q) + "," + q + "h" + (-(w - q)) + "z", fill: r.colour }, s);
        text(s, x(r.value) + 6, y + 4, fx(r.value, 1), { class: "value", style: small });
        const hit = svg("rect", { x: 0, y: y - rowH / 2, width: W, height: rowH, fill: "transparent", tabindex: 0 }, s);
        const show = function (e) { const p = e && e.clientX !== undefined ? pointer(e, host) : [x(r.value), y]; const q2 = tipFn(r); tip.show(p[0], p[1], q2[0], q2[1]); };
        hit.addEventListener("pointermove", show); hit.addEventListener("focus", show);
        hit.addEventListener("pointerleave", tip.hide); hit.addEventListener("blur", tip.hide);
      });
      text(s, x(max / 2), H - 2, axisFn(), { "text-anchor": "middle", style: small });
    });
  }
  function casp12Bars(host, state) {
    return c12BarPanel(host, function () { return c12Rows(state.cls, 6); },
      function () { const c = D.casp12.classes.filter(function (q) { return q.key === state.cls; })[0]; return "Mean GDT_TS, " + (c ? c.units + " " + c.name + " units" : D.casp12.units + " units"); },
      function (r) {
        const list = [{ name: "All " + D.casp12.units + " units", value: fx(r.e.gdt_ts, 1) }];
        D.casp12.classes.forEach(function (c) { list.push({ name: c.name + " (" + c.units + ")", value: fx(r.e.by_class[c.key], 1) }); });
        return [r.name + (r.agent ? "" : " · server, CASP12"), list];
      }, "Mean GDT_TS on CASP12 targets: agents and the servers of 2016",
      Math.max.apply(null, ["all"].concat(D.casp12.classes.map(function (c) { return c.key; })).map(function (k) { return c12Rows(k, 6)[0].value; })));   // one axis for every class
  }
  function casp12Table(host) {
    clear(host);
    const C = D.casp12, t = el("table", "data", null, host), h = el("tr", null, null, el("thead", null, null, t));
    el("th", "l", "Mean GDT_TS", h); el("th", null, "All (" + C.units + ")", h);
    C.classes.forEach(function (c) { el("th", null, c.name + " (" + c.units + ")", h); });
    const body = el("tbody", null, null, t);
    c12Rows("all", C.servers.length).forEach(function (r) {
      const tr = el("tr", r.agent ? "" : "ref", null, body), td = el("td", "l", null, tr), sw = el("span", "sw", null, td);
      sw.style.background = r.colour; td.appendChild(document.createTextNode(r.name + (r.agent ? "" : "  (server)")));
      el("td", r.agent ? "best" : "", fx(r.e.gdt_ts, 1), tr);
      C.classes.forEach(function (c) { el("td", null, fx(r.e.by_class[c.key], 1), tr); });
    });
  }
  function casp12Time(host, height, opts) {                     // opts: {key: which curve of an experiment, levels: [{name, value, colour}], max}
    const C = D.casp12, O = opts || {}, key = O.key || "over_time",
      top3 = O.levels || C.servers.slice(0, 3).map(function (g) { return { name: g.name, value: g.gdt_ts, colour: NEUTRAL }; });
    return responsive(host, function (W) {
      clear(host);
      const end = Math.max.apply(null, C.experiments.map(function (e) { return e.hours * 60; }));
      const compact = W < 560, small = compact ? "font-size:11.5px" : "";
      const longest = Math.max.apply(null, C.experiments.map(function (e) { return e.hours; })), several = C.experiments.some(function (e) { return e.hours !== longest; });
      const left = compact ? 28 : 36, right = compact ? (several ? 82 : 12) : 150, top = compact ? 8 : 12, H = height || 320, bottom = compact ? 36 : 42, max = O.max || 70;
      const s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Mean GDT_TS over the minutes of a session, beside the servers of 2016" }, host);
      const x = function (v) { return left + (W - left - right) * v / end; }, y = function (v) { return top + (H - top - bottom) * (1 - v / max); };
      for (let v = 0; v <= max; v += 10) { svg("line", { x1: left, x2: W - right, y1: y(v), y2: y(v), class: v === 0 ? "axis" : "grid" }, s); text(s, left - 6, y(v) + 4, String(v), { "text-anchor": "end", style: small }); }
      for (let v = 0; v <= end; v += (end > 240 ? (compact ? 120 : 60) : (compact ? 60 : 30))) text(s, x(v), H - (compact ? 18 : 24), String(v), { "text-anchor": "middle", style: small });
      text(s, x(end / 2), H - (compact ? 2 : 6), "Session time (minutes)", { "text-anchor": "middle", style: small });
      (compact ? top3.slice(0, 1) : top3).forEach(function (g, i) {  // what the servers of 2016 reached: a level, not a curve
        svg("line", { x1: left, x2: W - right, y1: y(g.value), y2: y(g.value), stroke: g.colour || NEUTRAL, "stroke-width": i === 0 ? 2 : 1.2, "stroke-dasharray": "5 4" }, s);
      });
      if (compact && !several) text(s, left + 6, y(top3[0].value) - 7, top3[0].name + " · " + fx(top3[0].value, 1), { style: small });
      if (compact && several) {                                  // with runs of two lengths the lines are close: the server is named beside the plot
        text(s, W - right + 8, y(top3[0].value) - 1, top3[0].name, { style: small });
        text(s, W - right + 8, y(top3[0].value) + 12, fx(top3[0].value, 1), { style: small });
      }
      if (right > 100) {
        const names = top3.map(function (g) { return { y: y(g.value), at: y(g.value), label: c12Short(g.name) + " · " + fx(g.value, 1) }; });
        names[0].at -= 6;                                        // room for three lines of names beside three levels that are close
        for (let i = 1; i < names.length; i++) if (names[i].at - names[i - 1].at < 15) names[i].at = names[i - 1].at + 15;
        names.forEach(function (n) { text(s, W - right + 10, n.at + 4, n.label, { style: "font-size:11.5px" }); });
      }
      C.experiments.forEach(function (e) {
        svg("path", { d: e[key].map(function (v, i) { return (i ? "L" : "M") + x(e.minutes[i]).toFixed(1) + "," + y(v).toFixed(1); }).join(""), fill: "none",
          stroke: AGENT_COLOUR[e.model], "stroke-width": 2, "stroke-linejoin": "round", "stroke-dasharray": several && e.hours !== longest ? "5 4" : "" }, s);
        const n = e[key].length - 1;
        svg("circle", { cx: x(e.minutes[n]), cy: y(e[key][n]), r: 4, fill: AGENT_COLOUR[e.model], stroke: SURFACE, "stroke-width": 2 }, s);
        /* the name at the line's end: above it, or below where another line ends just above */
        const others = C.experiments.filter(function (o) { return o !== e && o.hours === e.hours; });
        const below = others.some(function (o) { const v = o[key][o[key].length - 1]; return v > e[key][n] && y(e[key][n]) - y(v) < 26; });
        const short = e.label.replace("Claude ", "").replace("Gemini 4 ", "");
        if (!(compact && several))                               // runs of two lengths in a panel: told apart by the line (key), not by names in the plot
          text(s, x(e.minutes[n]) - (compact ? 2 : 8), y(e[key][n]) + (below ? (compact ? 24 : 30) : -9),
            compact ? short : short + ", " + e.hours + " h · " + fx(e[key][n], 1), { "text-anchor": "end", class: "name", style: small });
        if (e.interim) svg("path", { d: "M" + x(e.minutes[n]) + "," + y(e[key][n]) + "H" + x(e.hours * 60), stroke: AGENT_COLOUR[e.model], "stroke-width": 1.2, "stroke-dasharray": "2 4", fill: "none", opacity: 0.6 }, s);
      });
      if (several) {                                             // which line is which run: said in the plot, where no curve passes
        const hs = C.experiments.map(function (e) { return e.hours; }), lo = Math.min.apply(null, hs), kx = W - right - 118, ky = y(max * 0.2);
        [[longest + "-hour run", ""], [lo + "-hour run", "5 4"]].forEach(function (k, i) {
          svg("line", { x1: kx, x2: kx + 26, y1: ky + i * 17, y2: ky + i * 17, stroke: MUTED, "stroke-width": 2, "stroke-dasharray": k[1] }, s);
          text(s, kx + 33, ky + i * 17 + 4, k[0], { style: "font-size:11.5px" });
        });
      }
      const cross = svg("line", { y1: top, y2: H - bottom, stroke: MUTED, "stroke-width": 1, visibility: "hidden" }, s), tip = tooltip(host);
      const hit = svg("rect", { x: left, y: top, width: W - left - right, height: H - top - bottom, fill: "transparent" }, s);
      hit.addEventListener("pointermove", function (ev) {
        const p = pointer(ev, host), m = Math.max(0, Math.min(end, Math.round((p[0] - left) / (W - left - right) * end / 5) * 5));
        cross.setAttribute("x1", x(m)); cross.setAttribute("x2", x(m)); cross.setAttribute("visibility", "visible");
        const rows = C.experiments.filter(function (e) { return m <= e.minutes[e.minutes.length - 1]; }).map(function (e) { return { name: e.name, value: fx(e[key][m / 5], 1), colour: AGENT_COLOUR[e.model] }; });
        top3.forEach(function (g) { rows.push({ name: g.name + " (2016)", value: fx(g.value, 1), colour: g.colour || NEUTRAL, dashed: true }); });
        tip.show(x(m), p[1], "After " + m + " minutes", rows);
      });
      hit.addEventListener("pointerleave", function () { cross.setAttribute("visibility", "hidden"); tip.hide(); });
    });
  }
  function casp12Humans(host) {
    const C = D.casp12;
    return c12BarPanel(host, function () {
      const rows = [];
      C.experiments.forEach(function (e) { rows.push({ name: e.name, kind: "agent, " + (e.interim ? e.interim.elapsed_hours + " of " : "") + e.hours + " hours", value: e.both, colour: AGENT_COLOUR[e.model], agent: true }); });
      C.humans.slice(0, 4).forEach(function (g) { rows.push({ name: g.name, kind: "human group, three weeks", value: g.both, colour: HUMAN }); });
      C.servers.slice(0, 2).forEach(function (g) { rows.push({ name: g.name, kind: "server, three days", value: g.both, colour: NEUTRAL }); });
      return rows.sort(function (a, b) { return b.value - a.value; });
    }, function () { return "Mean GDT_TS, " + C.units_both + " units"; },
      function (r) { return [r.name, [{ name: r.kind, value: fx(r.value, 1) }]]; }, "Mean GDT_TS on the units that human groups predicted too");
  }

  window.DFBCharts = { leaderboard: leaderboard, harnessLegend: harnessLegend, mainTable: mainTable, templateChart: templateChart, templateTable: templateTable, timeChart: timeChart,
    timeTable: timeTable, casp12Bars: casp12Bars, casp12Table: casp12Table, casp12Time: casp12Time, casp12Humans: casp12Humans, NEUTRAL: NEUTRAL, HUMAN: HUMAN, feedbackTable: feedbackTable, signalsChart: signalsChart, behaviourTable: behaviourTable, targetsTable: targetsTable, legendItem: legendItem, COLOUR: COLOUR, MODEL: MODEL };
})();
