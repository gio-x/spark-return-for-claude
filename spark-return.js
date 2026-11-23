/*
 * Spark Return for Claude: content script, runs in the page at document_start.
 * Unofficial project, not affiliated with or endorsed by Anthropic.
 *
 * What it does:
 *   1. Asks claude.ai for its older ("classic") reply footer by switching off,
 *      as they are created, the page's frozen capability flags whose names start
 *      with "turnStatus". Nothing of the page is copied into this extension.
 *   2. Shows an animated spark where the page now shows a row of dots while
 *      Claude works, and below each reply, with a small tooltip and a wiggle
 *      when you click it. The frames are claude.ai's own: the site still ships
 *      its spark animations in a module it loads on demand ("cds_spark_sprites"),
 *      and this script asks the page to load that same module, from the same
 *      place the site loads it. If it cannot be found, the spark drawn from
 *      scratch in spark-art.js is used instead.
 *
 * Switch it off without uninstalling: run localStorage.setItem("spark-return.off", "1")
 * in the console of claude.ai and reload; removeItem to switch it back on.
 */
(function () {
  "use strict";
  if (window.__sparkReturn) return;
  var info = (window.__sparkReturn = { version: "1.1.0", flags: [] });
  try {
    if (localStorage.getItem("spark-return.off") === "1") { info.off = true; return; }
  } catch (_) {}

  // ---------------------------------------------------------------------------
  // 1. Classic footer: turn the page's "turnStatus*" flags off as they are frozen.
  var nativeFreeze = Object.freeze;
  function relax(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
    var keys;
    try { keys = Object.keys(obj); } catch (_) { return; }
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k.indexOf("turnStatus") !== 0 || obj[k] !== true) continue;
      try {
        obj[k] = false;
        if (info.flags.indexOf(k) < 0) info.flags.push(k);
      } catch (_) {}
    }
  }
  var freeze = function freeze(obj) {
    relax(obj);
    return nativeFreeze(obj);
  };
  Object.freeze = freeze;

  // ---------------------------------------------------------------------------
  // 2. The spark.
  var Own = window.SparkReturnArt;
  if (!Own) { info.noArt = true; return; }

  // The page's own spark frames, when they can be found (see the header).
  // The site lazy-loads them with code shaped like
  //   b6("cds_spark_sprites", () => Au(() => import("./<chunk>.js"), ...))
  // in one of its already-loaded scripts. We find that line, import the same
  // chunk the same way, and use its `animations` export. The resolved address
  // is remembered so later visits start with it at once.
  var Site = null;
  var SPRITE_KEY = "spark-return.sprites";
  var SPRITE_RE = /"cds_spark_sprites"[^]{0,160}?import\(\s*"([^"]+\.js)"\s*\)/;
  var ONE_SHOT = { tickle: 1, entrance: 1, exit: 1 };
  function adopt(mod) {
    var anims = mod && mod.animations;
    if (!anims || !anims.tickle || !anims.thinking || typeof anims.tickle.svg !== "string") return false;
    var strips = {};
    Object.keys(anims).forEach(function (name) {
      var a = anims[name];
      if (!a || typeof a.svg !== "string" || !(a.frameCount > 0) || !(a.speed > 0)) return;
      strips[name] = { svg: a.svg, frameCount: a.frameCount, frameMs: a.speed, loop: !ONE_SHOT[name] };
    });
    // At rest the spark is the first frame of its "tickle" strip.
    var still = anims.tickle.svg.replace(/viewBox="[^"]*"/, 'viewBox="0 0 100 100"');
    Site = { strips: strips, still: still };
    info.frames = "claude.ai";
    return true;
  }
  function importSprites(url) {
    return import(url).then(function (mod) {
      if (!adopt(mod)) throw new Error("unexpected module");
      try { localStorage.setItem(SPRITE_KEY, url); } catch (_) {}
    });
  }
  function siteScripts() {
    var seen = {}, list = [];
    function add(u) {
      if (!u || seen[u] || !/\.js(\?|$)/.test(u)) return;
      var host;
      try { host = new URL(u).hostname; } catch (_) { return; }
      if (host !== "claude.ai" && !/\.anthropic\.com$/.test(host)) return;
      seen[u] = 1;
      list.push(u);
    }
    performance.getEntriesByType("resource").forEach(function (e) { add(e.name); });
    Array.prototype.forEach.call(document.querySelectorAll("script[src],link[rel=modulepreload]"), function (el) {
      add(el.src || el.href);
    });
    // The module is referenced from the shared code, so look there first.
    list.sort(function (a, b) { return (/shared/.test(b) ? 1 : 0) - (/shared/.test(a) ? 1 : 0); });
    return list;
  }
  function searchSprites() {
    var list = siteScripts(), i = 0;
    function next() {
      if (Site) return Promise.resolve();
      if (i >= list.length) return Promise.reject(new Error("not found"));
      var src = list[i++];
      return fetch(src, { credentials: "omit" }).then(function (r) { return r.text(); }).then(function (text) {
        var m = SPRITE_RE.exec(text);
        if (!m) return next();
        return importSprites(new URL(m[1], src).href);
      }, next);
    }
    return next();
  }
  var searching = false, tries = 0;
  function findSprites() {
    if (Site || searching || tries >= 3) return;
    searching = true;
    tries++;
    searchSprites().catch(function () {}).then(function () { searching = false; });
  }
  (function () {
    var saved = null;
    try { saved = localStorage.getItem(SPRITE_KEY); } catch (_) {}
    var start = function () {
      setTimeout(findSprites, 0);
      setTimeout(findSprites, 4000);
      setTimeout(findSprites, 15000);
    };
    if (saved) importSprites(saved).catch(function () {
      try { localStorage.removeItem(SPRITE_KEY); } catch (_) {}
      if (document.readyState === "complete") start(); else window.addEventListener("load", start, { once: true });
    });
    else if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
  })();

  var Art = {
    still: function () { return Site ? Site.still : Own.still(); },
    strip: function (name) { return (Site && Site.strips[name]) || Own.strip(name); }
  };

  // Where the page draws things (stable test ids and attributes of claude.ai).
  var MARK = '[data-testid="TurnStatusClayMark"]';
  var FOOT = '[data-testid="chat-footer-spark"],[data-testid="chat-live-row-spark"]';
  var REPLY = '[data-testid="assistant-message"]';
  var OURS = "data-spark-return";
  var HOST = "data-spark-return-host";
  var QUIET = "data-spark-return-quiet";
  var BELOW = '[data-testid="chat-footer-spark"]';
  var LIVE_ROW = '[data-testid="chat-live-row-spark"]';

  // 2rem, following the page's own text-size setting, in the page's accent colour.
  var SIZE = "calc(var(--cds-rem-scale, 1) * 2rem)";
  var COLOR = "var(--cds-clay, #d6745a)";
  var TOOL_ACTIVITIES = { search: 1, read: 1, code: 1, write: 1, compose: 1 };
  var TOOL_BLOCKS = { tool_use: 1, tool_result: 1 };
  var HOVER_DELAY = 300; // ms before the tooltip shows
  var TIP_GAP = 4; // px between the spark and the tooltip
  var reduceMotion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  // Our own words, about the spark itself. Each click charges it a little more.
  var WORDS = {
    en: [
      "Just a little spark, keeping you company.",
      "Twinkle, twinkle. That was me.",
      "Every click adds a bit of shine.",
      "Fully charged! Thanks for the boost.",
      "Easy now, too much sparkle and I'll catch fire.",
    ],
    it: [
      "Solo una stellina che ti fa compagnia.",
      "Brillo, brillo: ero io.",
      "Ogni clic mi dà un po' di luce in più.",
      "Carica al massimo! Grazie della spinta.",
      "Piano, con troppa scintilla prendo fuoco.",
    ],
  };
  // Clicks needed to reach each line; after a full charge of 30 clicks it starts over.
  var CHARGE = [0, 4, 9, 15, 22];
  var FULL_CHARGE = 30;
  function words() {
    var lang = (document.documentElement.getAttribute("lang") || navigator.language || "en").toLowerCase();
    return lang.indexOf("it") === 0 ? WORDS.it : WORDS.en;
  }
  function line(clicks) {
    var level = clicks % FULL_CHARGE, pick = 0;
    for (var i = 0; i < CHARGE.length; i++) if (level >= CHARGE[i]) pick = i;
    return words()[pick];
  }


  // --- reading what the page is doing (React props of the elements) ----------
  function fiberOf(el) {
    var keys = Object.keys(el);
    for (var i = 0; i < keys.length; i++) if (keys[i].indexOf("__reactFiber$") === 0) return el[keys[i]];
    return null;
  }
  function propUp(el, name, depth) {
    var f = el ? fiberOf(el) : null;
    for (var i = 0; f && i < depth; i++, f = f.return) {
      var p = f.memoizedProps;
      if (p && typeof p === "object" && name in p) return p[name];
    }
    return undefined;
  }
  function lastReply() {
    var all = document.querySelectorAll(REPLY);
    return all.length ? all[all.length - 1] : null;
  }
  function hasText(reply) {
    var prose = reply && reply.querySelector('[data-cds="Prose"]');
    return !!prose && prose.textContent.trim().length > 0;
  }
  function blockType() {
    var feet = document.querySelectorAll(FOOT);
    for (var i = 0; i < feet.length; i++) {
      var b = propUp(feet[i], "streamingBlockType", 4);
      if (b) return b;
    }
    return undefined;
  }

  // While the page shows its working dots: thinking, a tool (web search...) or waiting for you.
  function markState(mark) {
    var reply = mark.closest(REPLY) || lastReply();
    var activity = propUp(mark, "activity", 6);
    if (activity === undefined) return hasText(reply) ? "writing" : "thinking";
    if (propUp(mark, "state", 3) === "blocked") return "waiting";
    var bt = blockType();
    if (TOOL_ACTIVITIES[activity] || (activity !== "think" && TOOL_BLOCKS[bt])) return "shimmer";
    if (bt === "text" && hasText(reply)) return "writing";
    return "thinking";
  }

  function pageSpark(foot) {
    var kids = foot.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].hasAttribute(OURS)) continue;
      var r = kids[i].getBoundingClientRect();
      if (r.width >= 4 && r.height >= 4 && kids[i].querySelector("svg")) return true;
    }
    return false;
  }

  // Below the reply: animated while it is being written; at rest, the page's own spark.
  function footState(foot) {
    if (foot.getAttribute("data-state") !== "shown") return null;
    var reply = lastReply();
    var flag = reply ? reply.getAttribute("data-is-streaming") : null;
    var app = propUp(foot, "avatarState", 4);
    var busy = flag === "true" || (reply && flag === null && app && app !== "idle");
    // At rest the page draws its own classic spark here, with its own hover message,
    // poke replies and wiggle: leave it alone, and draw ours only if it is missing.
    if (!busy) return pageSpark(foot) ? null : "still";
    return TOOL_BLOCKS[blockType()] ? "shimmer" : hasText(reply) ? "writing" : "thinking";
  }

  // --- drawing ------------------------------------------------------------------
  function sizeSvg(svg) {
    if (!svg) return;
    svg.style.display = "block";
    svg.style.width = "100%";
    svg.style.height = "auto";
  }
  function paintStill(box) {
    box.innerHTML = Art.still();
    sizeSvg(box.firstElementChild);
  }
  // Frame player: one shared requestAnimationFrame loop shows, for every playing
  // strip, frame floor(elapsed / frameMs) by moving the strip up by whole frames.
  var players = [], ticking = false;
  function tick(now) {
    for (var i = players.length - 1; i >= 0; i--) {
      var p = players[i];
      if (!p.strip.isConnected) { players.splice(i, 1); continue; }
      if (p.start === null) p.start = now;
      var k = Math.floor((now - p.start) / p.ms);
      if (!p.loop && k >= p.n) {
        finish(p);
        continue;
      }
      k = k % p.n;
      if (k !== p.shown) {
        p.shown = k;
        p.strip.style.transform = "translateY(" + (-100 * k) / p.n + "%)";
      }
    }
    if (players.length) requestAnimationFrame(tick);
    else ticking = false;
  }
  // A one-shot strip always ends on time, even when the browser slows animation frames down.
  function finish(p) {
    var i = players.indexOf(p);
    if (i < 0) return;
    players.splice(i, 1);
    clearTimeout(p.timer);
    if (p.done) p.done();
  }
  function play(box, name, onEnd) {
    var s = Art.strip(name);
    if (!s || reduceMotion.matches) {
      paintStill(box);
      return false;
    }
    box.textContent = "";
    var strip = document.createElement("span");
    strip.style.cssText = "position:absolute;left:0;top:0;width:100%;display:block";
    strip.innerHTML = s.svg;
    sizeSvg(strip.firstElementChild);
    box.appendChild(strip);
    var p = { strip: strip, n: s.frameCount, ms: s.frameMs, loop: s.loop, done: onEnd || null, start: null, shown: 0, timer: 0 };
    if (!p.loop) p.timer = setTimeout(function () { finish(p); }, p.n * p.ms + 30);
    players.push(p);
    if (!ticking) { ticking = true; requestAnimationFrame(tick); }
    return true;
  }

  function makeSpark(state) {
    var box = document.createElement("span");
    box.setAttribute(OURS, state);
    box.setAttribute("aria-hidden", "true");
    box.style.cssText =
      "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:block;overflow:hidden;" +
      "width:" + SIZE + ";height:" + SIZE + ";color:" + COLOR + ";fill:currentColor;" +
      "pointer-events:none;user-select:none;-webkit-user-select:none;line-height:0";
    if (state === "still") {
      paintStill(box);
      makeClickable(box);
    } else {
      play(box, state);
    }
    return box;
  }

  // --- the resting spark: tooltip and wiggle ------------------------------------
  var tip = null, tipOwner = null, tipTimer = 0, tipHideTimer = 0;
  function tipElement() {
    if (tip) return tip;
    tip = document.createElement("div");
    tip.setAttribute(OURS + "-tip", "");
    tip.setAttribute("role", "tooltip");
    tip.style.cssText = [
      "position:fixed", "left:0", "top:0", "z-index:130", "pointer-events:none", "box-sizing:border-box",
      "display:inline-flex", "align-items:center", "min-height:24px", "max-width:240px", "padding:3px 8px",
      "border-radius:6px", "font-size:13px", "line-height:18px", "font-weight:400", "text-wrap:balance",
      "background-color:var(--cds-tooltip-bg, #303030)", "color:var(--cds-tooltip-fg, #ededed)",
      "box-shadow:0 1px 2px rgba(0,0,0,.08),0 2px 8px rgba(0,0,0,.22)",
      "opacity:0", "scale:.98", "transition-property:opacity,scale", "transition-duration:120ms", "transition-timing-function:cubic-bezier(.3,.7,.1,1)",
    ].join(";");
    if (reduceMotion.matches) tip.style.transition = "none";
    return tip;
  }
  function placeTip() {
    if (!tip || !tipOwner || !tipOwner.isConnected) return hideTip(true);
    var r = tipOwner.getBoundingClientRect();
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = r.right + TIP_GAP, origin = "left center";
    if (left + w > window.innerWidth - 8) { left = r.left - TIP_GAP - w; origin = "right center"; }
    tip.style.left = Math.round(left) + "px";
    tip.style.top = Math.round(r.top + r.height / 2 - h / 2) + "px";
    tip.style.transformOrigin = origin;
  }
  function showTip(owner) {
    clearTimeout(tipHideTimer);
    var t = tipElement();
    tipOwner = owner;
    t.textContent = line(owner.__clicks || 0);
    if (!t.isConnected) (document.body || document.documentElement).appendChild(t);
    placeTip();
    requestAnimationFrame(function () { t.style.opacity = "1"; t.style.scale = "1"; });
  }
  function hideTip(now) {
    clearTimeout(tipTimer);
    if (!tip) return;
    tipOwner = null;
    tip.style.opacity = "0";
    tip.style.scale = ".98";
    clearTimeout(tipHideTimer);
    var t = tip;
    tipHideTimer = setTimeout(function () { if (!tipOwner && t.isConnected) t.remove(); }, now || reduceMotion.matches ? 0 : 130);
  }
  window.addEventListener("scroll", function () { if (tipOwner) placeTip(); }, true);
  window.addEventListener("resize", function () { if (tipOwner) placeTip(); });

  function makeClickable(box) {
    box.style.pointerEvents = "auto";
    box.__clicks = 0;
    var wiggling = false, pressed = false;
    box.addEventListener("pointerenter", function (e) {
      if (e.pointerType === "touch") return; // the tooltip is for mouse hover only
      pressed = false;
      clearTimeout(tipTimer);
      tipTimer = setTimeout(function () { if (!pressed) showTip(box); }, HOVER_DELAY);
    });
    box.addEventListener("pointerleave", function () { pressed = false; hideTip(false); });
    box.addEventListener("mousedown", function () {
      // A press closes the tooltip; hover again to read the next line.
      pressed = true;
      hideTip(true);
      if (wiggling) return;
      wiggling = true;
      box.__clicks += 1;
      var started = play(box, "tickle", function () { wiggling = false; paintStill(box); });
      if (!started) wiggling = false;
    });
  }

  // --- placing it -----------------------------------------------------------------
  function mount(host, state) {
    var current = host.querySelector(":scope > [" + OURS + "]");
    if (current && current.getAttribute(OURS) === state) return;
    if (!host.hasAttribute(HOST)) {
      host.setAttribute(HOST, "");
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
    }
    var spark = makeSpark(state);
    if (!host.matches(MARK)) centreOver(host, spark);
    if (current) {
      if (tipOwner === current) hideTip(true);
      current.replaceWith(spark);
    } else {
      host.appendChild(spark);
    }
  }
  // Below a reply, sit exactly where the page's own spark sits.
  function centreOver(host, box) {
    var kids = host.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].hasAttribute(OURS)) continue;
      var a = kids[i].getBoundingClientRect(), h = host.getBoundingClientRect();
      if (a.width < 4) return;
      box.style.left = a.left - h.left + a.width / 2 + "px";
      box.style.top = a.top - h.top + a.height / 2 + "px";
      return;
    }
  }
  function unmount(host) {
    if (!host.hasAttribute(HOST)) return;
    host.removeAttribute(HOST);
    var ours = host.querySelectorAll(":scope > [" + OURS + "]");
    for (var i = 0; i < ours.length; i++) {
      if (tipOwner === ours[i]) hideTip(true);
      ours[i].remove();
    }
  }

  // One spark at a time. Some views (Cowork, long tasks) show a status row with its own
  // mark and the spark below the reply together: while the row is visible, the one
  // below the reply stays hidden.
  function isVisible(el) {
    var r = el.getBoundingClientRect();
    return r.width >= 4 && r.height >= 4;
  }
  function statusRowShown() {
    var marks = document.querySelectorAll(MARK);
    for (var i = 0; i < marks.length; i++) if (isVisible(marks[i])) return true;
    var rows = document.querySelectorAll(LIVE_ROW);
    for (var j = 0; j < rows.length; j++) {
      if (rows[j].getAttribute("data-state") === "shown" && isVisible(rows[j])) return true;
    }
    return false;
  }

  function scan() {
    // When the turn ends the page shrinks its mark away in a few frames: the spark
    // leaves with it, so it never sits next to the one that appears below the reply.
    var marks = document.querySelectorAll(MARK);
    for (var i = 0; i < marks.length; i++) {
      if (isVisible(marks[i])) mount(marks[i], markState(marks[i]));
      else unmount(marks[i]);
    }
    var quiet = statusRowShown();
    var feet = document.querySelectorAll(FOOT);
    for (var j = 0; j < feet.length; j++) {
      if (quiet && feet[j].matches(BELOW)) {
        unmount(feet[j]);
        if (!feet[j].hasAttribute(QUIET)) feet[j].setAttribute(QUIET, "");
        continue;
      }
      if (feet[j].hasAttribute(QUIET)) feet[j].removeAttribute(QUIET);
      var s = footState(feet[j]);
      if (s) mount(feet[j], s); else unmount(feet[j]);
    }
  }

  // Hide what the page draws in those places (its dots and its own spark).
  var css = document.createElement("style");
  css.textContent =
    MARK + " > :not([" + OURS + "]), [" + HOST + "] > :not([" + OURS + "]) { visibility: hidden !important; pointer-events: none !important; }" +
    MARK + ", [" + HOST + "] { overflow: visible !important; }" +
    "[" + QUIET + "] { visibility: hidden !important; pointer-events: none !important; }";
  (document.head || document.documentElement).appendChild(css);

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; scan(); });
  }
  new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  setInterval(function () { if (!document.hidden) schedule(); }, 250);
})();
