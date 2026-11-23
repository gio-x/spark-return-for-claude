/*
 * Spark Return for Claude: the spark artwork.
 * Every shape is generated at runtime from a short table of numbers (one row
 * per ray). No image files, no external data, no network.
 * Unofficial project, not affiliated with or endorsed by Anthropic.
 *
 * window.SparkReturnArt.still()      -> one 100x100 SVG frame
 * window.SparkReturnArt.strip(name)  -> { svg, frameCount, frameMs, loop }
 *   name: thinking | writing | shimmer | waiting | tickle
 *   Frame i of a strip occupies y in [100*i, 100*(i+1)) of its viewBox.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- helpers
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function num(n) {
    var s = Math.round(n * 100) / 100;
    if (s === 0) s = 0; // normalise -0
    return String(s);
  }

  var TAU = Math.PI * 2;
  var DEG = Math.PI / 180;
  var K = 0.5523; // quarter-circle bezier constant

  // ------------------------------------------------------- spark parameters
  // Twelve rays. Each ray is a short outline in its own frame: pairs of
  // (distance from the centre along the ray, distance to the side of it),
  // from the centre out along one edge, round the tip, and back along the other.
  // [angle (rad), [r,w, r,w, ...]]
  var RAYS = [
    [-1.4125, [0.2,3.5, 23.82,4.09, 42.41,4.9, 44.22,4.44, 46.24,2.45, 47.23,-0.2, 45.64,-1.97, 44.02,-3.42, 43.21,-3.95, 24.02,-2.94, 0.8,-1.51]],
    [-0.8639, [1.6,11.81, 24.57,8.78, 43.42,7.62, 46.28,6.4, 48.01,4.21, 48.75,0.4, 45.98,-2.98, 43.22,-3.84, 23.77,-3.39, 0.4,-2.14]],
    [-0.1287, [0.8,8.12, 24.83,5.78, 46.5,3.75, 48.41,0.4, 48.15,-1.1, 45.7,-2.59, 43.78,-2.99, 24.63,-2.04, 0.4,0.33]],
    [0.2818, [-0.8,5.89, 25.01,4.92, 44.55,3.8, 46.45,3.29, 49.95,0.0, 49.13,-2.7, 46.65,-4.08, 43.95,-5.4, 24.61,-0.77, 0.4,4.49]],
    [0.7779, [-0.4,6.3, 27.59,3.43, 49.47,1.09, 50.59,0.94, 51.62,0.0, 51.02,-2.11, 49.79,-2.96, 49.07,-3.42, 27.39,-2.63, 0,-2.07]],
    [1.0436, [0.4,5.86, 26.67,6.18, 44.91,5.0, 48.08,4.33, 49.82,2.5, 50.25,0.0, 49.32,-1.44, 45.91,-3.28, 25.67,-1.97, 0,-2.85]],
    [1.6334, [0.0,-0.86, 26.17,2.03, 47.39,4.71, 48.97,4.08, 51.22,2.36, 51.55,0.2, 51.02,-1.61, 49.57,-2.79, 47.99,-3.22, 26.97,-4.01, 0.4,-4.98]],
    [2.1223, [0.4,-1.71, 26.82,1.37, 48.0,3.55, 50.03,3.47, 52.03,2.17, 51.67,-0.2, 50.83,-1.7, 48.8,-3.0, 27.02,-5.02, 0.0,-7.08]],
    [2.527, [0.6,-0.24, 25.38,2.01, 44.81,3.84, 47.14,3.33, 48.46,1.92, 49.27,0.8, 49.16,-1.94, 46.21,-4.08, 25.38,-4.73, -0.4,-5.76]],
    [3.1016, [1.6,-1.76, 26.12,1.41, 50.22,4.0, 52.53,2.0, 49.42,-2.25, 27.92,-4.27, 0.0,-6.14]],
    [-2.5825, [0.4,1.0, 25.31,3.1, 45.62,5.15, 48.48,4.46, 50.69,2.57, 50.95,-0.6, 49.69,-2.35, 48.09,-4.08, 45.42,-5.11, 26.11,-5.64, -0.4,-6.57]],
    [-2.029, [0.4,4.5, 27.82,3.72, 48.6,4.3, 51.18,3.55, 52.82,1.65, 54.37,-0.4, 52.82,-3.52, 51.18,-6.09, 48.6,-7.43, 27.82,-6.2, -0.8,-5.19]]
  ];
  var OX = 1.46, OY = -1.83; // the centre sits slightly off the middle of the box
  var HUB = 9.84;            // radius of the solid centre
  var N = RAYS.length;
  var RMAX = 48;

  var BASE = (function () {
    var ang = [], len = [], wf = [];
    for (var i = 0; i < N; i++) {
      var q = RAYS[i][1], far = 0, n = q.length;
      for (var j = 0; j < n; j += 2) if (q[j] > far) far = q[j];
      ang.push(RAYS[i][0]);
      len.push(far / RMAX);
      wf.push((q[5] - q[n - 3]) / 8);
    }
    return { ang: ang, len: len, wf: wf };
  })();

  // ------------------------------------------------------------ frame context
  // ctx: { cx, cy, sx, sy } - squash is applied to every emitted point
  function mkCtx(frameIndex, sx, sy) {
    return { cx: 50 + OX, cy: 50 + OY + 100 * frameIndex, sx: sx || 1, sy: sy || 1 };
  }
  function pt(ctx, x, y) {
    return num(ctx.cx + x * ctx.sx) + ' ' + num(ctx.cy + y * ctx.sy);
  }

  // A tapered ray: wide near r0, narrowing to a rounded tip that ends at r1.
  // o: a (angle), r0, r1, wb (half width at r0), rc (tip radius), round (round the inner end too)
  function ray(ctx, o) {
    var ux = Math.cos(o.a), uy = Math.sin(o.a);
    var nx = -uy, ny = ux;
    function P(r, w) { return pt(ctx, ux * r + nx * w, uy * r + ny * w); }
    var rc = o.rc;
    var rt = o.r1 - rc;
    if (rt < o.r0 + 0.2) rt = o.r0 + 0.2;
    var wb = o.wb;
    var wm = ((wb + rc) / 2) * 0.98;
    var rm = (o.r0 + rt) / 2;
    var d = 'M' + P(o.r0, -wb) +
      'Q' + P(rm, -wm) + ' ' + P(rt, -rc) +
      'C' + P(rt + K * rc, -rc) + ' ' + P(rt + rc, -K * rc) + ' ' + P(rt + rc, 0) +
      'C' + P(rt + rc, K * rc) + ' ' + P(rt + K * rc, rc) + ' ' + P(rt, rc) +
      'Q' + P(rm, wm) + ' ' + P(o.r0, wb);
    if (o.round) {
      d += 'C' + P(o.r0 - K * wb, wb) + ' ' + P(o.r0 - wb, K * wb) + ' ' + P(o.r0 - wb, 0) +
        'C' + P(o.r0 - wb, -K * wb) + ' ' + P(o.r0 - K * wb, -wb) + ' ' + P(o.r0, -wb);
    }
    return '<path d="' + d + 'Z"/>';
  }

  // One ray of the spark, stretched along its length by sl and across by sw.
  function sparkRay(ctx, a, q, sl, sw) {
    var ux = Math.cos(a), uy = Math.sin(a);
    var nx = -uy, ny = ux, d = '';
    for (var j = 0; j < q.length; j += 2) {
      var r = q[j] * sl, w = q[j + 1] * sw;
      d += (j ? 'L' : 'M') + pt(ctx, ux * r + nx * w, uy * r + ny * w);
    }
    return '<path d="' + d + 'Z"/>';
  }

  function dot(ctx, x, y, r) {
    var cx = num(ctx.cx + x * ctx.sx), cy = num(ctx.cy + y * ctx.sy);
    if (ctx.sx === 1 && ctx.sy === 1) return '<circle cx="' + cx + '" cy="' + cy + '" r="' + num(r) + '"/>';
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + num(r * ctx.sx) + '" ry="' + num(r * ctx.sy) + '"/>';
  }

  // The spark itself. o: s (size 0..1), ws (width scale), hs (hub scale, 0 = none),
  // rot (radians), dA(i), dL(i), dW(i) per-ray deformations.
  function spark(ctx, o) {
    var s = o.s, ws = o.ws === undefined ? 1 : o.ws, hs = o.hs === undefined ? 1 : o.hs;
    var rot = o.rot || 0, out = '', i;
    var hub = HUB * hs * ws * Math.min(1, 0.35 + 0.65 * s);
    for (i = 0; i < N; i++) {
      var a = RAYS[i][0] + rot + (o.dA ? o.dA(i) : 0);
      var sl = s * (o.dL ? o.dL(i) : 1);
      var sw = ws * (o.dW ? o.dW(i) : 1);
      out += sparkRay(ctx, a, RAYS[i][1], sl, sw);
    }
    if (hub > 0) out += dot(ctx, 0, 0, hub);
    return out;
  }

  function group(inner) { return '<g>' + inner + '</g>'; }

  function stripSvg(frames) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ' + (100 * frames.length) +
      '" fill="currentColor">' + frames.join('') + '</svg>';
  }

  // ------------------------------------------------------------------- still
  function stillFrame(i) { return group(spark(mkCtx(i), { s: 1 })); }

  // ---------------------------------------------------------------- thinking
  function thinkingFrames() {
    var f = [], rnd = mulberry32(4411);
    // 1: solid round dot (15% of the box wide)
    f.push(group(dot(mkCtx(0), 0, 0, 7.5)));
    var sizes = [0.30, 0.60, 0.90, 1.0, 0.90, 0.60, 0.35];
    var rots = [-14, -9, -4, 0, 3, 7, 11];
    for (var k = 0; k < sizes.length; k++) {
      var s = sizes[k], idx = k + 1;
      var ws = Math.pow(s, 0.68);
      f.push(group(spark(mkCtx(idx), { s: s, ws: ws, hs: 1, rot: rots[k] * DEG })));
    }
    // 9: small ragged blob (about 20% of the box)
    var ctx = mkCtx(8), out = '', i;
    var off = 0.35;
    for (i = 0; i < N; i++) {
      var r1 = 8.2 + rnd() * 1.9;
      out += ray(ctx, { a: BASE.ang[i] + off, r0: 0, r1: r1, wb: 3.0, rc: 1.9 });
    }
    out += dot(ctx, 0, 0, 5.6);
    f.push(group(out));
    return f;
  }

  // ----------------------------------------------------------------- writing
  function writingFrames() {
    var F = 8, f = [], rnd = mulberry32(777), i, k;
    var ka = [], kl = [], kw = [], pa = [], pl = [];
    for (i = 0; i < N; i++) {
      ka.push(1 + Math.floor(rnd() * 3)); kl.push(1 + Math.floor(rnd() * 3)); kw.push(1 + Math.floor(rnd() * 3));
      pa.push(rnd() < 0.5 ? 1 : -1); pl.push(rnd() < 0.5 ? 1 : -1);
    }
    for (k = 0; k < F; k++) {
      (function (k) {
        var t = (k / F) * TAU;
        var jr = mulberry32(5000 + k * 31);
        var jit = [], jl = [], jw = [];
        for (var j = 0; j < N; j++) {
          jit.push(k === 0 ? 0 : (jr() - 0.5) * 4 * DEG);
          jl.push(k === 0 ? 0 : (jr() - 0.5) * 0.06);
          jw.push(k === 0 ? 0 : (jr() - 0.5) * 0.12);
        }
        var o = {
          s: 1,
          rot: 6.5 * DEG * Math.sin(t),
          dA: function (i) { return pa[i] * 5 * DEG * Math.sin(ka[i] * t) + jit[i]; },
          dL: function (i) { return 1 + pl[i] * 0.07 * Math.sin(kl[i] * t + 0.0) + jl[i]; },
          dW: function (i) { return 1 + 0.16 * Math.sin(kw[i] * t) + jw[i]; }
        };
        f.push(group(spark(mkCtx(k), o)));
      })(k);
    }
    return f;
  }

  // ----------------------------------------------------------------- shimmer
  function shimmerFrames() {
    var f = [], i, k;
    var rnd = mulberry32(31337);
    var ph = [], ph2 = [];
    for (i = 0; i < N; i++) { ph.push(rnd() * TAU); ph2.push(rnd() * TAU); }
    var RING = 40;

    // 1: full spark
    f.push(group(spark(mkCtx(0), { s: 1 })));

    // 2: rays shorten and detach (dashes pointing outward), centre dwindles
    (function () {
      var ctx = mkCtx(1), out = '';
      for (i = 0; i < N; i++) {
        var L = BASE.len[i] * RMAX;
        out += ray(ctx, { a: BASE.ang[i], r0: 0.30 * L, r1: 0.80 * L, wb: 3.2 * BASE.wf[i], rc: 2.2, round: true });
      }
      out += dot(ctx, 0, 0, 4.2);
      f.push(group(out));
    })();

    // 3: shorter dashes forming a broken ring
    (function () {
      var ctx = mkCtx(2), out = '';
      for (i = 0; i < N; i++) {
        if (i === 3 || i === 8) continue;
        var off = (i % 3) - 1;
        out += ray(ctx, { a: BASE.ang[i], r0: 29.5 + off * 0.8, r1: 43.2 + off * 0.8, wb: 3.6, rc: 3.6, round: true });
      }
      f.push(group(out));
    })();

    // 4-12: ring of twelve round dots, slowly turning and twinkling
    for (k = 0; k < 9; k++) {
      (function (k) {
        var idx = 3 + k, ctx = mkCtx(idx), out = '';
        var rot = (2.5 + k * 2.1) * DEG;
        for (var j = 0; j < N; j++) {
          var tw = Math.sin(ph[j] + k * 0.95) * 0.5 + Math.sin(ph2[j] + k * 1.7) * 0.5; // -1..1
          var r = 3.8 * (1 + 0.3 * tw);
          var ringR = RING + 0.9 * Math.sin(ph2[j] + k * 0.6);
          var a = BASE.ang[j] + rot;
          out += dot(ctx, Math.cos(a) * ringR, Math.sin(a) * ringR, r);
        }
        f.push(group(out));
      })(k);
    }

    // 13: dots lengthen inward into dashes
    (function () {
      var ctx = mkCtx(12), out = '';
      var rot = 22 * DEG;
      for (var j = 0; j < N; j++) {
        var jr = 1 + 0.12 * Math.sin(ph[j] + 3);
        out += ray(ctx, { a: BASE.ang[j] + rot, r0: 31.5 * jr, r1: 43.0, wb: 3.7, rc: 3.7, round: true });
      }
      f.push(group(out));
    })();

    // 14: the spark re-forms, slightly smaller
    f.push(group(spark(mkCtx(13), { s: 0.9, ws: 0.95, rot: 5 * DEG })));

    // 15: full spark
    f.push(group(spark(mkCtx(14), { s: 1 })));
    return f;
  }

  // ----------------------------------------------------------------- waiting
  function waitingFrames() {
    var F = 16, f = [], i, k, rnd = mulberry32(2468);
    var kl = [], ph = [];
    for (i = 0; i < N; i++) { kl.push(1 + Math.floor(rnd() * 2)); ph.push(rnd() < 0.5 ? 1 : -1); }
    for (k = 0; k < F; k++) {
      var t = (k / F) * TAU;
      (function (t, k) {
        f.push(group(spark(mkCtx(k), {
          s: 1,
          rot: 1.6 * DEG * Math.sin(t),
          dA: function (i) { return ph[i] * 0.8 * DEG * Math.sin(kl[i] * t); },
          dL: function (i) { return 1 - 0.012 * (1 - Math.cos(t)) * 0.5 * (i % 2 ? 1 : -0.6) + 0.0; },
          dW: function (i) { return 1 + 0.04 * Math.sin(kl[i] * t); }
        })));
      })(t, k);
    }
    return f;
  }

  // ------------------------------------------------------------------ tickle
  function tickleFrames() {
    // A quick "squish" when poked: the spark pulls in to a small knot and pops back.
    var f = [], rnd = mulberry32(1357);
    var sizes = [1.0, 0.84, 0.55, 0, 0.62, 0.9, 1.0];
    var rots = [0, 4, 9, 0, -6, -2, 0];
    for (var k = 0; k < sizes.length; k++) {
      if (sizes[k] === 0) {
        var ctx = mkCtx(k), out = '', i;
        for (i = 0; i < N; i++) {
          out += ray(ctx, { a: BASE.ang[i] + 0.2, r0: 0, r1: 9.5 + rnd() * 2.2, wb: 3.4, rc: 2.2 });
        }
        out += dot(ctx, 0, 0, 6.6);
        f.push(group(out));
        continue;
      }
      var s = sizes[k];
      f.push(group(spark(mkCtx(k), { s: s, ws: k === 6 ? 1 : Math.pow(s, 0.68), rot: rots[k] * DEG })));
    }
    return f;
  }

  // ------------------------------------------------------------------ public
  var cache = {};
  var STRIPS = {
    thinking: { build: thinkingFrames, frameMs: 90, loop: true },
    writing: { build: writingFrames, frameMs: 90, loop: true },
    shimmer: { build: shimmerFrames, frameMs: 100, loop: true },
    waiting: { build: waitingFrames, frameMs: 600, loop: true },
    tickle: { build: tickleFrames, frameMs: 40, loop: false }
  };

  var api = {
    still: function () {
      if (!cache.still) {
        cache.still = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="currentColor">' +
          spark(mkCtx(0), { s: 1 }) + '</svg>';
      }
      return cache.still;
    },
    strip: function (name) {
      var d = STRIPS[name];
      if (!d) throw new Error('unknown strip: ' + name);
      if (!cache[name]) {
        var frames = d.build();
        cache[name] = { svg: stripSvg(frames), frameCount: frames.length, frameMs: d.frameMs, loop: d.loop };
      }
      return cache[name];
    }
  };

  root.SparkReturnArt = api;
})(typeof window !== 'undefined' ? window : this);
