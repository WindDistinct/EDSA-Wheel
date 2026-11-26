/* Estado del sorteo + persistencia en localStorage + azar criptográfico. */
(function () {
  'use strict';

  var KEY = 'edsa-sorteo-v1';

  var DEFAULTS = {
    participants: [],   // [{id, name, detail}]
    winners: [],        // [{id, name, detail, prize, line, at}]
    absent: [],         // [{id, name, detail, at}]
    settings: {
      title: 'Gran Sorteo',
      duration: 9,
      removeWinners: true,
      perDraw: 1,
      sound: true,
      prizes: []
    }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return clone(DEFAULTS);
      var data = JSON.parse(raw);
      var s = clone(DEFAULTS);
      s.participants = Array.isArray(data.participants) ? data.participants : [];
      s.winners = Array.isArray(data.winners) ? data.winners : [];
      s.absent = Array.isArray(data.absent) ? data.absent : [];
      Object.assign(s.settings, data.settings || {});
      return s;
    } catch (e) {
      console.warn('No se pudo leer el estado guardado', e);
      return clone(DEFAULTS);
    }
  }

  var state = load();
  var listeners = [];

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn('No se pudo guardar', e); }
    listeners.forEach(function (fn) { fn(state); });
  }

  /** Entero uniforme en [0, n) usando crypto (con rechazo para evitar sesgo de módulo). */
  function secureIndex(n) {
    if (n <= 0) throw new Error('n debe ser > 0');
    var cryptoObj = window.crypto || window.msCrypto;
    if (!cryptoObj || !cryptoObj.getRandomValues) return Math.floor(Math.random() * n);
    var max = 0x100000000;               // 2^32
    var limit = max - (max % n);
    var buf = new Uint32Array(1);
    do { cryptoObj.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % n;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = secureIndex(i + 1);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /** Participantes que todavía pueden salir sorteados. */
  function pool() {
    var out = {};
    if (state.settings.removeWinners) state.winners.forEach(function (w) { out[w.id] = 1; });
    state.absent.forEach(function (a) { out[a.id] = 1; });
    return state.participants.filter(function (p) { return !out[p.id]; });
  }

  /** Premio del puesto `offset` dentro de la tirada actual (0 = el siguiente en entregarse). */
  function currentPrize(offset) {
    var prizes = state.settings.prizes || [];
    return prizes[state.winners.length + (offset || 0)] || '';
  }

  /** Ganadores por tirada (1..200). */
  function perDraw() {
    var n = Math.floor(Number(state.settings.perDraw) || 1);
    return Math.max(1, Math.min(200, n));
  }

  function uid() {
    return Date.now().toString(36) + '-' + secureIndex(0x7fffffff).toString(36);
  }

  window.Store = {
    get state() { return state; },
    save: save,
    onChange: function (fn) { listeners.push(fn); },
    pool: pool,
    currentPrize: currentPrize,
    perDraw: perDraw,
    secureIndex: secureIndex,
    shuffle: shuffle,
    uid: uid,

    setParticipants: function (list, append) {
      state.participants = append ? state.participants.concat(list) : list;
      if (!append) { state.winners = []; state.absent = []; }
      save();
    },
    removeParticipant: function (id) {
      state.participants = state.participants.filter(function (p) { return p.id !== id; });
      save();
    },
    /** Registra varios ganadores de una sola vez: [{person, prize, line}] */
    addWinners: function (items) {
      var at = new Date().toISOString();
      items.forEach(function (it) {
        state.winners.push({ id: it.person.id, name: it.person.name, detail: it.person.detail || '', prize: it.prize || '', line: it.line || '', at: at });
      });
      save();
    },
    addWinner: function (person, prize, line) {
      state.winners.push({ id: person.id, name: person.name, detail: person.detail || '', prize: prize || '', line: line || '', at: new Date().toISOString() });
      save();
    },
    removeWinner: function (index) { state.winners.splice(index, 1); save(); },
    markAbsent: function (person) {
      state.absent.push({ id: person.id, name: person.name, detail: person.detail || '', at: new Date().toISOString() });
      save();
    },
    restoreAbsent: function (index) { state.absent.splice(index, 1); save(); },
    resetDraw: function () { state.winners = []; state.absent = []; save(); },
    updateSettings: function (patch) { Object.assign(state.settings, patch); save(); }
  };
})();
