/* Efectos: confeti con colores de marca y sonidos sintetizados (sin archivos externos). */
(function () {
  'use strict';

  var COLORS = ['#EDB700', '#3B60AF', '#5CE1E6', '#D0E9FF', '#FFFFFF', '#153980'];

  /* ---------- Confeti ---------- */
  var canvas = document.getElementById('confetti');
  var ctx = canvas.getContext('2d');
  var parts = [], running = false, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  }
  addEventListener('resize', resize);
  resize();

  function burst(x, y, count) {
    count = count || 220;
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var v = 6 + Math.random() * 14;
      parts.push({
        x: x, y: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 8,
        w: 6 + Math.random() * 8, h: Math.random() < 0.35 ? 18 + Math.random() * 10 : 8 + Math.random() * 6, // tiras tipo "línea de carril"
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        life: 0, max: 140 + Math.random() * 80
      });
    }
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  function rain(seconds) {
    var end = performance.now() + (seconds || 2.5) * 1000;
    (function drop() {
      for (var i = 0; i < 6; i++) {
        parts.push({
          x: Math.random() * innerWidth, y: -20,
          vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3,
          w: 6 + Math.random() * 6, h: 10 + Math.random() * 12,
          r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.2,
          c: COLORS[(Math.random() * COLORS.length) | 0],
          life: 0, max: 400
        });
      }
      if (!running) { running = true; requestAnimationFrame(tick); }
      if (performance.now() < end) requestAnimationFrame(drop);
    })();
  }

  function tick() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(function (p) { return p.life < p.max && p.y < innerHeight + 40; });
    parts.forEach(function (p) {
      p.life++;
      p.vx *= 0.985; p.vy = p.vy * 0.985 + 0.32;
      p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.scale(1, Math.cos(p.life * 0.12));
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (parts.length) requestAnimationFrame(tick);
    else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  /* ---------- Sonido ---------- */
  var ac = null;
  function audio() {
    if (!ac) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function enabled() { return Store.state.settings.sound; }

  function tone(freq, start, dur, type, gain) {
    var a = audio(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, a.currentTime + start);
    g.gain.setValueAtTime(0.0001, a.currentTime + start);
    g.gain.exponentialRampToValueAtTime(gain || 0.2, a.currentTime + start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
    o.connect(g).connect(a.destination);
    o.start(a.currentTime + start);
    o.stop(a.currentTime + start + dur + 0.05);
  }

  var Sound = {
    /** Clic de tablero (cada cambio de nombre). */
    flap: function () { if (enabled()) tone(1400 + Math.random() * 300, 0, 0.03, 'square', 0.035); },
    /** Paso por estación. */
    station: function () { if (enabled()) tone(880, 0, 0.12, 'triangle', 0.07); },
    /** Timbre de parada (ding-dong de bus). */
    bell: function () { if (!enabled()) return; tone(988, 0, 0.5, 'sine', 0.25); tone(784, 0.28, 0.7, 'sine', 0.22); },
    /** Fanfarria corta al revelar. */
    win: function () {
      if (!enabled()) return;
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, i * 0.11, 0.6, 'triangle', 0.16); });
      [523.25, 659.25, 783.99].forEach(function (f) { tone(f, 0.5, 1.4, 'sine', 0.1); });
    },
    unlock: function () { if (enabled()) audio(); }
  };

  window.FX = { burst: burst, rain: rain, Sound: Sound, COLORS: COLORS };
})();
