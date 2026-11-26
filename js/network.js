/* Mapa de red tipo metro: 4 líneas (los 4 ejes del evento) que llegan a la estación central.
   Dibuja el mapa, anima los buses en reposo y ejecuta el recorrido del sorteo. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var HUB = { x: 800, y: 380, r: 58 };

  var LINES = [
    { id: 'telemetria', name: '', tagline: '', color: '#EDB700', ink: '#153980', icon: '',
      pts: [[90, 150], [300, 150], [420, 270], [420, 500], [500, 580], [600, 580], [650, 530], [650, 440], [710, 380], [800, 380]],
      label: { x: 58, y: 88, anchor: 'start' } },
    { id: 'recaudo', name: '', tagline: '', color: '#3B60AF', ink: '#FFFFFF', icon: '',
      pts: [[1500, 100], [1240, 100], [1140, 200], [900, 200], [800, 300], [800, 380]],
      label: { x: 1532, y: 164, anchor: 'end' } },
    { id: 'flota', name: '', tagline: '', color: '#5CE1E6', ink: '#153980', icon: '',
      pts: [[1510, 660], [1300, 660], [1180, 540], [1180, 450], [1110, 380], [800, 380]],
      label: { x: 1542, y: 596, anchor: 'end' } },
    { id: 'cctv', name: '', tagline: '', color: '#D0E9FF', ink: '#153980', icon: '',
      pts: [[150, 690], [700, 690], [800, 590], [800, 380]],
      label: { x: 118, y: 626, anchor: 'start' } }
  ];

  // Líneas decorativas de fondo (la "ciudad" conectada).
  var GHOSTS = [
    [[0, 300], [220, 300], [300, 380], [560, 380]],
    [[260, 0], [260, 60], [380, 60], [520, 200], [600, 200], [640, 160], [640, 0]],
    [[1600, 300], [1330, 300], [1270, 360], [1270, 560], [1200, 630], [1000, 630], [940, 760]],
    [[960, 760], [960, 520], [1040, 440], [1040, 300], [1300, 40], [1600, 40]],
    [[0, 560], [240, 560], [300, 500], [300, 380]],
    [[1600, 470], [1380, 470], [1340, 430]],
    [[460, 760], [460, 640], [540, 640]],
    [[700, 0], [700, 120], [1000, 120], [1060, 60], [1060, 0]]
  ];

  var ICONS = {
    bus: '<path fill="currentColor" fill-rule="evenodd" d="M8 3h8a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM7.5 6.6h9v4.6h-9zM8.6 13.2a1.2 1.2 0 1 0 0 2.4a1.2 1.2 0 1 0 0-2.4zM15.4 13.2a1.2 1.2 0 1 0 0 2.4a1.2 1.2 0 1 0 0-2.4zM10 4.3h4v1.1h-4zM6.6 18h2.8v2.6H6.6zM14.6 18h2.8v2.6h-2.8zM3.4 7.2h1.4v3.4H3.4zM19.2 7.2h1.4v3.4h-1.4z"/>',
    chart: '<path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M3.5 17.5l5.5-6 4 3.2 7-8.2M15 6.5h5.2v5.2"/><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M3.5 21h17"/>',
    card: '<rect x="2.8" y="5.5" width="18.4" height="13" rx="2.4" fill="none" stroke="currentColor" stroke-width="2.3"/><path stroke="currentColor" stroke-width="2.3" d="M2.8 10h18.4"/><path stroke="currentColor" stroke-width="2.3" stroke-linecap="round" d="M6.5 14.6h4"/>',
    camera: '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" d="M3 9.2l11.2-4.4 2.6 6.4-11.2 4.4z"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" d="M16.6 9.6l3.6-1.4 1 2.6-3.6 1.4M9.4 14.5l1.4 4.3H5.2M5.2 21v-4.6"/>'
  };

  var svg, lineEls = [], hubEl, idleBuses = [], heroes = [], raf = 0, idleOn = true;

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /** Polilínea -> path con esquinas redondeadas (estilo mapa de metro). */
  function roundedPath(pts, radius) {
    var d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 1; i < pts.length - 1; i++) {
      var p0 = pts[i - 1], p = pts[i], p1 = pts[i + 1];
      var v1x = p0[0] - p[0], v1y = p0[1] - p[1], l1 = Math.hypot(v1x, v1y);
      var v2x = p1[0] - p[0], v2y = p1[1] - p[1], l2 = Math.hypot(v2x, v2y);
      var r = Math.min(radius, l1 / 2, l2 / 2);
      var ax = p[0] + v1x / l1 * r, ay = p[1] + v1y / l1 * r;
      var bx = p[0] + v2x / l2 * r, by = p[1] + v2y / l2 * r;
      d += 'L' + ax.toFixed(1) + ' ' + ay.toFixed(1) + 'Q' + p[0] + ' ' + p[1] + ' ' + bx.toFixed(1) + ' ' + by.toFixed(1);
    }
    var last = pts[pts.length - 1];
    return d + 'L' + last[0] + ' ' + last[1];
  }

  function busMarker(parent, line, r, cls) {
    var g = el('g', { 'class': 'bus ' + (cls || '') }, parent);
    var inner = el('g', { 'class': 'bus-inner' }, g);
    el('circle', { r: r + 6, 'class': 'bus-halo', fill: line.color }, inner);
    el('circle', { r: r, fill: line.color, stroke: '#FFFFFF', 'stroke-width': Math.max(3, r * 0.16) }, inner);
    var s = r * 1.25;
    var ic = el('svg', { x: -s / 2, y: -s / 2, width: s, height: s, viewBox: '0 0 24 24', color: line.ink }, inner);
    ic.innerHTML = ICONS.bus;
    return g;
  }

  function build(target) {
    svg = target;
    svg.innerHTML =
      '<defs>' +
      '<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="softglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5"/></filter>' +
      '<radialGradient id="hubGlow"><stop offset="0" stop-color="#5CE1E6" stop-opacity=".55"/><stop offset="1" stop-color="#5CE1E6" stop-opacity="0"/></radialGradient>' +
      '</defs>';

    var ghosts = el('g', { 'class': 'ghosts' }, svg);
    GHOSTS.forEach(function (pts) { el('path', { d: roundedPath(pts, 34) }, ghosts); });

    el('circle', { cx: HUB.x, cy: HUB.y, r: 200, fill: 'url(#hubGlow)', 'class': 'hub-aura' }, svg);

    var linesG = el('g', { 'class': 'lines' }, svg);
    lineEls = LINES.map(function (line, i) {
      var g = el('g', { 'class': 'line', 'data-line': i, style: '--c:' + line.color }, linesG);
      var d = roundedPath(line.pts, 46);
      el('path', { d: d, 'class': 'line-casing' }, g);
      var path = el('path', { d: d, 'class': 'line-path', stroke: line.color }, g);
      var trail = el('path', { d: d, 'class': 'line-trail' }, g);
      var L = path.getTotalLength();
      trail.style.strokeDasharray = L + ' ' + L;
      trail.style.strokeDashoffset = L;

      // Estaciones
      var stops = [], start = 70, end = L - HUB.r - 34;
      var n = Math.max(3, Math.round((end - start) / 82));
      var stG = el('g', { 'class': 'stations' }, g);
      for (var k = 0; k <= n; k++) {
        var s = start + (end - start) * k / n;
        var pt = path.getPointAtLength(s);
        var c = el('circle', { cx: pt.x.toFixed(1), cy: pt.y.toFixed(1), r: 7.5, 'class': 'station' }, stG);
        stops.push({ s: s, el: c });
      }

      // Origen con ícono del eje
      var o = line.pts[0];
      var og = el('g', { 'class': 'origin', transform: 'translate(' + o[0] + ' ' + o[1] + ')' }, g);
      el('circle', { r: 30, fill: '#0B1F4D', stroke: line.color, 'stroke-width': 5 }, og);
      var ic = el('svg', { x: -15, y: -15, width: 30, height: 30, viewBox: '0 0 24 24', color: line.color }, og);
      ic.innerHTML = ICONS[line.icon];

      // Etiqueta tipo "pill" del manual del evento
      var lb = el('g', { 'class': 'line-label', transform: 'translate(' + line.label.x + ' ' + line.label.y + ')' }, g);
      var t = el('text', { 'text-anchor': line.label.anchor, 'class': 'line-name' }, lb);
      t.textContent = line.name.toUpperCase();
      var t2 = el('text', { 'text-anchor': line.label.anchor, y: 20, 'class': 'line-tag' }, lb);
      t2.textContent = line.tagline;

      return { g: g, path: path, trail: trail, L: L, stops: stops, line: line };
    });

    // Estación central
    hubEl = el('g', { 'class': 'hub', transform: 'translate(' + HUB.x + ' ' + HUB.y + ')' }, svg);
    el('circle', { r: HUB.r + 10, 'class': 'hub-pulse' }, hubEl);
    el('circle', { r: HUB.r + 10, 'class': 'hub-pulse hub-pulse--2' }, hubEl);
    el('circle', { r: HUB.r + 18, 'class': 'hub-dash' }, hubEl);
    el('circle', { r: HUB.r, fill: '#FFFFFF', 'class': 'hub-core' }, hubEl);
    el('image', { href: 'assets/logo/edsa-icono.svg', x: -38, y: -38, width: 76, height: 76 }, hubEl);
    var hl = el('g', { 'class': 'hub-label', transform: 'translate(' + (HUB.r + 26) + ' ' + (HUB.r + 40) + ')' }, hubEl);
    el('text', { 'class': 'hub-kicker' }, hl).textContent = '';
    el('text', { 'class': 'hub-title', y: 26 }, hl).textContent = '';

    // Buses en reposo (2 por línea)
    var busesG = el('g', { 'class': 'idle-buses' }, svg);
    idleBuses = [];
    lineEls.forEach(function (le, i) {
      [0, 0.5].forEach(function (phase) {
        idleBuses.push({ le: le, phase: phase + i * 0.13, speed: 70, g: busMarker(busesG, le.line, 15) });
      });
    });
    el('g', { 'class': 'hero-layer' }, svg);

    loop();
  }

  function place(g, pt, scale) {
    g.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1) + ')' + (scale ? ' scale(' + scale + ')' : ''));
  }

  function loop() {
    cancelAnimationFrame(raf);
    var t0 = performance.now();
    (function frame(now) {
      if (idleOn) {
        var t = (now - t0) / 1000;
        idleBuses.forEach(function (b) {
          var run = b.le.L - HUB.r - 10;
          var u = ((t * b.speed / run) + b.phase) % 1;
          place(b.g, b.le.path.getPointAtLength(u * run));
          b.g.style.opacity = Math.min(1, u * 12, (1 - u) * 12);
        });
      }
      raf = requestAnimationFrame(frame);
    })(t0);
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /** Perfil de velocidad del bus: acelera (0–10 %), crucero (hasta 40 %) y frena
      progresivamente hasta detenerse en la estación (suspenso). */
  function velocity(u) {
    if (u < 0.1) return Math.sin(u / 0.1 * Math.PI / 2);
    if (u < 0.4) return 1;
    return Math.pow((1 - u) / 0.6, 1.5);
  }
  // Tabla de distancia acumulada (integral de la velocidad), normalizada a 0..1.
  var STEPS = 2000, DIST = new Float64Array(STEPS + 1);
  (function () {
    for (var i = 1; i <= STEPS; i++) DIST[i] = DIST[i - 1] + velocity((i - 0.5) / STEPS);
    for (var j = 0; j <= STEPS; j++) DIST[j] /= DIST[STEPS];
  })();
  function ease(u) {
    if (!(u > 0)) return 0;          // también cubre NaN
    var x = u * STEPS, i = Math.floor(x);
    if (i >= STEPS) return 1;
    return DIST[i] + (DIST[i + 1] - DIST[i]) * (x - i);
  }
  function speed(u) { return velocity(u); } // 0..1

  /** Prepara el mapa para un sorteo: apaga los buses en reposo. */
  function begin() {
    reset();
    svg.classList.add('is-drawing');
    idleOn = false;
  }

  /**
   * Lanza un bus por una línea hasta la estación central. Puede haber varios a la vez.
   * hooks.onProgress(u, v): u = avance temporal 0..1, v = velocidad relativa 1..0
   * hooks.onStation(): el bus pasó por una estación
   * opts.intro: ms que el bus espera en el origen antes de salir
   * opts.size: radio del bus · opts.fadeOnArrive: desvanecer al llegar
   */
  function travel(lineIndex, durationMs, hooks, opts) {
    hooks = hooks || {}; opts = opts || {};
    var le = lineEls[lineIndex];
    le.g.classList.add('is-active');

    var layer = svg.querySelector('.hero-layer');
    var bus = busMarker(layer, le.line, opts.size || 30, 'bus--hero');
    heroes.push(bus);
    var dist = le.L - HUB.r - 16;
    place(bus, le.path.getPointAtLength(0));

    return wait(120).then(function () {
      bus.classList.add('is-ready');
      return wait(opts.intro == null ? 750 : opts.intro);
    }).then(function () {
      return new Promise(function (resolve) {
        var t0 = performance.now(), next = 0;
        (function frame(now) {
          if (!bus.parentNode) return resolve(hubScreenPoint()); // se reinició el mapa
          var u = Math.max(0, Math.min(1, (now - t0) / durationMs));
          var s = ease(u) * dist;
          place(bus, le.path.getPointAtLength(s));
          if (s > le.trailS) { le.trailS = s; le.trail.style.strokeDashoffset = le.L - s; }
          while (next < le.stops.length && le.stops[next].s <= s + 4) {
            var st = le.stops[next].el;
            st.classList.remove('is-hit'); void st.getBBox(); st.classList.add('is-hit', 'is-passed');
            if (hooks.onStation) hooks.onStation(next);
            next++;
          }
          if (hooks.onProgress) hooks.onProgress(u, speed(u));
          if (u < 1) { requestAnimationFrame(frame); return; }
          hubEl.classList.remove('is-arrived'); void hubEl.getBBox(); hubEl.classList.add('is-arrived');
          bus.classList.add(opts.fadeOnArrive ? 'is-gone' : 'is-docked');
          resolve(hubScreenPoint());
        })(t0);
      });
    });
  }

  /** Sorteo de un solo ganador: un bus, recorrido completo. */
  function run(lineIndex, durationMs, hooks) {
    begin();
    return travel(lineIndex, durationMs, hooks);
  }

  function hubScreenPoint() {
    var m = svg.getScreenCTM();
    return { x: m.a * HUB.x + m.e, y: m.d * HUB.y + m.f };
  }

  function reset() {
    heroes.forEach(function (b) { if (b.parentNode) b.parentNode.removeChild(b); });
    heroes = [];
    svg.classList.remove('is-drawing');
    hubEl.classList.remove('is-arrived');
    lineEls.forEach(function (le) {
      le.g.classList.remove('is-active');
      le.trailS = 0;
      le.trail.style.strokeDashoffset = le.L;
      le.stops.forEach(function (s) { s.el.classList.remove('is-hit', 'is-passed'); });
    });
    idleOn = true;
  }

  window.Network = { LINES: LINES, build: build, begin: begin, travel: travel, run: run, reset: reset, hubScreenPoint: hubScreenPoint };
})();
