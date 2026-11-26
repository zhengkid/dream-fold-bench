/* Wires the page: the controls of the charts, the tables behind them, and the replay of the two sessions. */
(function () {
  "use strict";
  const C = window.DFBCharts, D = window.DFB;
  const $ = function (id) { return document.getElementById(id); };
  function segmented(id, onChange) {
    const host = $(id);
    host.addEventListener("click", function (e) {
      const b = e.target.closest("button");
      if (!b) return;
      host.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      onChange(b.getAttribute("data-v"));
    });
  }
  function toggle(button, table, build) {
    let built = false;
    $(button).addEventListener("click", function () {
      const t = $(table), hidden = t.classList.toggle("hidden");
      if (!hidden && !built) { build(t); built = true; }
      $(button).textContent = hidden ? "Show the table" : "Hide the table";
    });
  }

  /* ---- leaderboard */
  const lb = { setting: "open", metric: "gdt_ts" };
  let redraw = C.leaderboard($("lb-chart"), lb);
  const legend = function () {
    const extra = [];
    if (lb.setting === "open") extra.push(["ring", "#2D2A23", "the same model, closed-book"]);
    if (lb.setting !== "average") { extra.push(["dash", "#2D2A23", "AlphaFold 3 at CASP16"]); extra.push(["line", "#2D2A23", "± 1 standard deviation over runs"]); }
    C.harnessLegend($("lb-legend"), extra);
  };
  legend();
  segmented("lb-setting", function (v) { lb.setting = v; redraw(); legend(); });
  segmented("lb-metric", function (v) { lb.metric = v; redraw(); });
  toggle("lb-toggle", "lb-table", C.mainTable);

  /* ---- by template */
  C.templateChart($("tpl-chart"));
  C.harnessLegend($("tpl-legend"), [["line", "#2D2A23", "AlphaFold 3 at CASP16"], ["line", "#6B655A", "median of the agents"]]);
  toggle("tpl-toggle", "tpl-table", C.templateTable);

  /* ---- over time */
  C.timeChart($("time-closed"), "closed");
  C.timeChart($("time-open"), "open");
  C.harnessLegend($("time-legend"), [["dash", "#6B655A", "the earlier model of a pair"]]);
  toggle("time-toggle", "time-table", C.timeTable);

  /* ---- feedback */
  C.feedbackTable($("fb-table"));
  if (D.feedback.some(function (r) { return r.open.none; }))
    $("fb-note").textContent += " No evaluator: a control in which the session has the renderer but no evaluator (open-book).";
  C.signalsChart($("sig-chart"));
  (function () {
    const h = $("sig-legend");
    C.legendItem(h, "dot", "#2D2A23", "two attempts of the same agent, same setting");
    C.legendItem(h, "ring", "#6B655A", "any two models of one target");
    C.legendItem(h, "dash", "#2D2A23", "chance (50%)");
  })();

  /* ---- what the sessions do; every target */
  C.behaviourTable($("beh-table"));
  C.targetsTable($("tg-table"), "open");
  segmented("tg-setting", function (v) { C.targetsTable($("tg-table"), v); });

  /* ---- the task text */
  $("task-text").textContent = D.task_text;
  $("task-closed").textContent = "In the closed-book setting the two lines about pdb/ and seqdb/ are replaced by one: “" + D.task_closed_line + "”";

  /* ---- the citation: a button that copies it */
  $("cite-copy").addEventListener("click", function () {
    const text = $("cite-text").textContent, b = $("cite-copy");
    const done = function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
    else { const r = document.createRange(); r.selectNodeContents($("cite-text")); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
  });

  /* ---- the replay */
  let current = null;
  function show(target) {
    if (current) current.pause();
    current = window.DFBReplayView($("demo-replay"), window.DFB_REPLAY[target], {});
    const pre = $("demo-report").querySelector("pre");
    pre.textContent = window.DFB_REPLAY[target].final_report || "";
  }
  show("T1274");
  segmented("demo-target", function (v) { show(v); current.play(); });
  /* the replay starts by itself the first time it comes into view */
  if (window.IntersectionObserver) {
    let started = false;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting && !started) { started = true; current.play(); } });
    }, { threshold: 0.5 }).observe($("demo-replay"));
  }
})();
