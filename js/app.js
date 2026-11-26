/* Interfaz del sorteo: tablero, flujo de sorteo, revelación y configuración. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var S = Store, LINES = Network.LINES;

  var ui = {
    title: $('eventTitle'), statPool: $('statPool'), statWinners: $('statWinners'),
    board: $('board'), boardLabel: $('boardLabel'), boardName: $('boardName'), boardDetail: $('boardDetail'),
    boardPrize: $('boardPrize'), boardPrizeName: $('boardPrizeName'),
    btnDraw: $('btnDraw'), reveal: $('reveal'), settings: $('settings'), toast: $('toast')
  };

  var drawing = false, lastLine = -1, current = null;

  /* ================= Utilidades ================= */
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  var toastTimer;
  function toast(msg) {
    // El diálogo vive en la "top layer": el aviso debe estar dentro para verse encima.
    var host = ui.settings.open ? ui.settings : document.body;
    if (ui.toast.parentNode !== host) host.appendChild(ui.toast);
    ui.toast.textContent = msg;
    ui.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { ui.toast.classList.remove('is-on'); }, 3200);
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /* ================= Tablero ================= */
  function setBoard(label, name, detail, opts) {
    opts = opts || {};
    ui.boardLabel.textContent = label;
    ui.boardName._scr = (ui.boardName._scr || 0) + 1; // cancela un efecto de letras en curso
    ui.boardName.textContent = name;
    ui.boardDetail.innerHTML = '&nbsp;';
    if (detail) ui.boardDetail.textContent = detail;
    ui.boardName.classList.toggle('is-long', name.length > 30);
    if (opts.flip) {
      ui.boardName.classList.remove('flip'); void ui.boardName.offsetWidth; ui.boardName.classList.add('flip');
    }
  }

  function idleBoard() {
    var st = S.state, w = st.winners[st.winners.length - 1];
    ui.board.classList.remove('is-live', 'is-winner');
    ui.board.style.removeProperty('--line');
    if (!st.participants.length) setBoard('Sin participantes', 'Carga la lista para empezar', 'Configuración → Cargar lista  (tecla C)');
    else if (w) setBoard('Último ganador', w.name, w.detail);
    else setBoard('Próxima parada', 'Listos para sortear', plural(S.pool().length, 'participante a bordo', 'participantes a bordo'));
  }

  /** Efecto "split-flap": las letras se barajan y se asientan de izquierda a derecha. */
  var SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
  function scramble(el, target, dur) {
    var t0 = performance.now(), token = (el._scr = (el._scr || 0) + 1);
    return new Promise(function (resolve) {
      (function frame(now) {
        if (el._scr !== token) return resolve(); // otro efecto tomó este elemento
        var k = Math.max(0, Math.min(1, (now - t0) / dur));
        var fixed = Math.floor(k * target.length);
        var out = target.slice(0, fixed);
        for (var i = fixed; i < target.length; i++) {
          out += target[i] === ' ' ? ' ' : SCRAMBLE_CHARS[(Math.random() * SCRAMBLE_CHARS.length) | 0];
        }
        el.textContent = out;
        if (k < 1) requestAnimationFrame(frame); else resolve();
      })(t0);
    });
  }

  function settleName(person, dur) {
    ui.boardName.classList.toggle('is-long', person.name.length > 30);
    ui.boardDetail.textContent = person.detail || ' ';
    return scramble(ui.boardName, person.name, dur || 950);
  }

  /* ================= Sorteo ================= */
  function pickLine() {
    var i;
    do { i = Math.floor(Math.random() * LINES.length); } while (LINES.length > 1 && i === lastLine);
    lastLine = i;
    return i;
  }

  function baseDuration() {
    var d = (Number(S.state.settings.duration) || 9) * 1000;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) d = Math.min(d, 4000);
    return d;
  }

  function startDrawing() {
    drawing = true;
    FX.Sound.unlock();
    document.body.classList.add('is-drawing');
    ui.btnDraw.disabled = true;
    ui.board.classList.add('is-live');
    ui.board.classList.remove('is-winner');
  }

  function draw() {
    if (drawing) return;
    var pool = S.pool();
    if (!pool.length) {
      toast(S.state.participants.length ? 'Ya no quedan participantes por sortear.' : 'No hay participantes. Abre Configuración (C) para cargar la lista.');
      return;
    }
    var n = S.perDraw();
    if (n > 1 && pool.length > 1) return drawMany(pool, n);
    return drawOne(pool);
  }

  /* ---------- Un ganador por tirada ---------- */
  function drawOne(pool) {
    startDrawing();

    // El ganador se decide AQUÍ, con azar criptográfico. La animación solo lo revela.
    var winner = pool[S.secureIndex(pool.length)];
    var li = pickLine(), line = LINES[li];

    // Nombres que desfilan por el tablero (sin el ganador, para no adelantarlo).
    var reel = S.shuffle(pool.filter(function (p) { return p.id !== winner.id; }));
    if (!reel.length) reel = [{ name: '· · ·', detail: '' }];
    var ri = 0, lastFlip = 0;

    ui.board.style.setProperty('--line', line.color);
    setBoard(line.name ? 'Línea ' + line.name + ' · en ruta' : 'En ruta', 'Saliendo de la estación…', line.tagline || '');

    Network.run(li, baseDuration(), {
      onProgress: function (u, v) {
        var now = performance.now();
        // Los nombres pasan rápido mientras el bus va a velocidad crucero y se frenan con él.
        var interval = Math.min(650, 55 / Math.max(u < 0.4 ? 1 : v, 0.085));
        if (u < 0.99 && now - lastFlip >= interval) {
          lastFlip = now;
          var p = reel[ri++ % reel.length];
          setBoard(u > 0.75 ? 'Llegando a la estación…' : 'Próxima parada', p.name, p.detail, { flip: true });
          FX.Sound.flap();
        }
      },
      onStation: function () { FX.Sound.station(); }
    }).then(function (hub) {
      FX.Sound.bell();
      ui.boardLabel.textContent = '¡Estación Ganador!';
      ui.board.classList.add('is-winner');
      return settleName(winner).then(function () { return hub; });
    }).then(function (hub) {
      FX.burst(hub.x, hub.y, 260);
      FX.Sound.win();
      return wait(900);
    }).then(function () {
      showReveal([{ person: winner, line: line }]);
    });
  }

  /* ---------- Varios ganadores por tirada: una flota de buses ---------- */
  function drawMany(pool, n) {
    if (pool.length < n) {
      toast('Solo quedan ' + pool.length + ' participantes: todos salen sorteados en esta tirada.');
      n = pool.length;
    }
    startDrawing();

    // Los n ganadores se deciden AQUÍ: barajado criptográfico (Fisher-Yates) y se toman los primeros n.
    var winners = S.shuffle(pool).slice(0, n);
    var ids = {};
    winners.forEach(function (w) { ids[w.id] = 1; });
    var reel = S.shuffle(pool.filter(function (p) { return !ids[p.id]; }));
    if (!reel.length) reel = [{ name: '· · ·', detail: '' }];

    // Tiempos: cada bus hace un recorrido más corto y salen escalonados (~20 s en total).
    var T = Math.max(3500, Math.min(6500, baseDuration() * 0.55));
    var gap = Math.max(650, Math.min(2000, (20000 - T) / Math.max(1, n - 1)));
    var first = pickLine();
    var batch = winners.map(function (p, i) { return { person: p, line: LINES[(first + i) % LINES.length] }; });

    Network.begin();
    clearTally(true);
    ui.board.style.setProperty('--line', 'var(--cian)');
    setBoard('Tirada de ' + n + ' ganadores', 'Salen los buses…', 'Flota en ruta hacia la Estación Ganador');

    var ri = 0, holdUntil = 0, arrived = 0;
    var ticker = setInterval(function () {
      if (performance.now() < holdUntil) return;
      var p = reel[ri++ % reel.length];
      setBoard('En ruta · ' + arrived + ' de ' + n + ' ganadores', p.name, p.detail, { flip: true });
      FX.Sound.flap();
    }, 90);

    return new Promise(function (done) {
      batch.forEach(function (b, i) {
        setTimeout(function () {
          var li = LINES.indexOf(b.line);
          Network.travel(li, T, {}, { intro: 200, size: 24, fadeOnArrive: true }).then(function (hub) {
            arrived++;
            holdUntil = performance.now() + Math.min(1100, gap - 80);
            FX.Sound.bell();
            FX.burst(hub.x, hub.y, 60);
            ui.board.style.setProperty('--line', b.line.color);
            ui.boardLabel.textContent = 'Ganador ' + arrived + ' de ' + n;
            settleName(b.person, 420);
            addTally(b, i);
            if (arrived === n) { clearInterval(ticker); done(hub); }
          });
        }, i * gap);
      });
    }).then(function (hub) {
      ui.board.classList.add('is-winner');
      return wait(1300).then(function () { return hub; });
    }).then(function (hub) {
      FX.burst(hub.x, hub.y, 300);
      FX.Sound.win();
      return wait(700);
    }).then(function () {
      showReveal(batch);
    });
  }

  /* ---------- Marcador de ganadores durante el recorrido ---------- */
  function clearTally(show) {
    var t = $('tally');
    t.innerHTML = '';
    t.hidden = !show;
  }
  function addTally(b, i) {
    var chip = h('span', 'tally-chip');
    chip.style.setProperty('--line', b.line.color);
    chip.appendChild(h('span', 'tally-n', String(i + 1)));
    chip.appendChild(h('span', null, b.person.name));
    var t = $('tally');
    t.appendChild(chip);
    while (t.children.length > 12) t.removeChild(t.firstChild); // solo los últimos, para no tapar el mapa
  }

  /* ---------- Revelación (1 o varios) ---------- */
  function showReveal(batch) {
    var first = S.state.winners.length + 1, n = batch.length;
    current = batch.map(function (b, i) { return { person: b.person, line: b.line, prize: S.currentPrize(i) }; });
    var multi = n > 1;
    ui.reveal.classList.toggle('is-multi', multi);

    var route = $('revealRoute');
    route.innerHTML = '';
    route.style.setProperty('--line', batch[0].line.color);
    route.appendChild(h('span', 'dot'));
    route.appendChild(h('span', null, multi
      ? 'Tirada de ' + n + ' ganadores  ·  Sorteos N.º ' + first + ' al ' + (first + n - 1)
      : (batch[0].line.name ? 'Línea ' + batch[0].line.name + '  ·  ' : '') + 'Sorteo N.º ' + first));

    $('revealKicker').textContent = multi ? '¡Felicitaciones a los ' + n + ' ganadores!' : '¡Felicitaciones!';
    $('confirmLabel').textContent = multi ? 'Confirmar los ' + n + ' ganadores' : 'Confirmar ganador';
    $('btnAbsent').hidden = multi;

    if (multi) renderRevealGrid();
    else {
      var c = current[0];
      $('revealName').textContent = c.person.name;
      $('revealName').classList.toggle('is-long', c.person.name.length > 26);
      $('revealDetail').textContent = c.person.detail || '';
      $('revealPrize').textContent = c.prize ? 'Premio: ' + c.prize : '';
      $('revealPrize').hidden = !c.prize;
    }

    // El confeti pasa detrás de la tarjeta para no tapar los nombres.
    ui.reveal.insertBefore($('confetti'), ui.reveal.firstChild);
    ui.reveal.hidden = false;
    requestAnimationFrame(function () { ui.reveal.classList.add('is-on'); });
    FX.rain(2.5);
    setTimeout(function () { $('btnConfirm').focus(); }, 60);
  }

  function renderRevealGrid() {
    var grid = $('revealGrid'), n = current.length;
    grid.innerHTML = '';
    grid.dataset.size = n <= 4 ? 'l' : n <= 9 ? 'm' : n <= 20 ? 's' : 'xs';
    current.forEach(function (c, i) {
      var tile = h('div', 'tile');
      tile.style.setProperty('--line', c.line.color);
      tile.appendChild(h('span', 'tile-n', String(S.state.winners.length + i + 1)));
      var main = h('div', 'tile-main');
      main.appendChild(h('span', 'tile-name', c.person.name));
      if (c.person.detail) main.appendChild(h('span', 'tile-detail', c.person.detail));
      if (c.prize) main.appendChild(h('span', 'tile-prize', c.prize));
      tile.appendChild(main);
      var ab = h('button', 'tile-absent', 'Ausente');
      ab.title = 'No está presente: se reemplaza por otra persona sorteada';
      ab.dataset.slot = i;
      tile.appendChild(ab);
      grid.appendChild(tile);
    });
  }

  /** Reemplaza al ganador de un puesto (ausente) por otra persona sorteada del bombo. */
  function replaceSlot(i) {
    var c = current && current[i];
    if (!c) return;
    S.markAbsent(c.person);
    var taken = {};
    current.forEach(function (x) { taken[x.person.id] = 1; });
    var pool = S.pool().filter(function (p) { return !taken[p.id]; });
    if (!pool.length) {
      toast(c.person.name + ' quedó como ausente. No quedan participantes para reemplazarlo.');
      current.splice(i, 1);
      if (!current.length) { current = null; closeReveal().then(idleBoard); return; }
      renderRevealGrid();
      $('confirmLabel').textContent = 'Confirmar los ' + current.length + ' ganadores';
      return;
    }
    var next = pool[S.secureIndex(pool.length)];
    toast(c.person.name + ' quedó como ausente. Nuevo ganador: ' + next.name);
    c.person = next;
    renderRevealGrid();
    var tile = $('revealGrid').children[i];
    tile.classList.add('is-new');
    scramble(tile.querySelector('.tile-name'), next.name, 700);
    FX.Sound.bell();
  }

  function closeReveal() {
    ui.reveal.classList.remove('is-on');
    return wait(350).then(function () {
      ui.reveal.hidden = true;
      document.body.appendChild($('confetti'));
      clearTally(false);
      Network.reset();
      document.body.classList.remove('is-drawing');
      ui.btnDraw.disabled = false;
      drawing = false;
    });
  }

  function confirmWinner() {
    if (!current) return;
    S.addWinners(current.map(function (c) { return { person: c.person, prize: c.prize, line: c.line.name, lineId: c.line.id }; }));
    current = null;
    closeReveal().then(idleBoard);
  }

  function absentWinner() {
    if (!current || current.length !== 1) return;
    var p = current[0].person;
    S.markAbsent(p);
    toast(p.name + ' quedó registrado como ausente. Sorteando de nuevo…');
    current = null;
    closeReveal().then(function () { idleBoard(); return wait(500); }).then(draw);
  }

  /* ================= Cabecera ================= */
  function renderHeader() {
    var st = S.state, n = S.perDraw();
    // El título es opcional: si se quita de la cabecera, el resto de la interfaz sigue funcionando.
    if (ui.title) ui.title.textContent = st.settings.title || 'Gran Sorteo';
    ui.statPool.textContent = S.pool().length;
    ui.statWinners.textContent = st.winners.length;
    var prizes = [];
    for (var i = 0; i < n; i++) if (S.currentPrize(i)) prizes.push(S.currentPrize(i));
    ui.boardPrize.hidden = !prizes.length;
    $('boardPrizeLabel').textContent = n > 1 ? 'Premios en juego' : 'Premio';
    ui.boardPrizeName.textContent = n > 1 ? plural(prizes.length, 'premio', 'premios') : (prizes[0] || '');
    $('drawHint').textContent = n > 1 ? n + ' ganadores · barra espaciadora' : 'Barra espaciadora';
    document.body.classList.toggle('is-muted', !st.settings.sound);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(function () {});
    else document.exitFullscreen();
  }

  /* ================= Configuración ================= */
  function openSettings(tab) {
    if (drawing) return;
    renderSettings();
    if (tab) selectTab(tab);
    ui.settings.showModal();
  }

  function selectTab(id) {
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('is-active', t.dataset.tab === id); });
    document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.toggle('is-active', p.id === id); });
  }
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () { selectTab(t.dataset.tab); });
  });

  function statusMap() {
    var m = {};
    S.state.winners.forEach(function (w) { m[w.id] = 'Ganador'; });
    S.state.absent.forEach(function (a) { m[a.id] = 'Ausente'; });
    return m;
  }

  function renderParticipants() {
    var st = S.state, q = $('searchP').value.trim().toLowerCase();
    var norm = function (s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
    var status = statusMap(), list = $('listP');
    list.innerHTML = '';
    var shown = st.participants.filter(function (p) { return !q || norm(p.name + ' ' + p.detail).indexOf(norm(q)) >= 0; });
    var frag = document.createDocumentFragment();
    shown.forEach(function (p, i) {
      var li = h('li', 'person');
      li.appendChild(h('span', 'person-n', String(i + 1)));
      var main = h('span', 'person-main');
      main.appendChild(h('span', 'person-name', p.name));
      if (p.detail) main.appendChild(h('span', 'person-detail', p.detail));
      li.appendChild(main);
      if (status[p.id]) li.appendChild(h('span', 'badge badge--' + status[p.id].toLowerCase(), status[p.id]));
      var x = h('button', 'x-btn', '×');
      x.title = 'Quitar de la lista';
      x.dataset.remove = p.id;
      li.appendChild(x);
      frag.appendChild(li);
    });
    list.appendChild(frag);
    if (!st.participants.length) list.appendChild(h('li', 'empty', 'Aún no hay participantes. Ve a "Cargar lista".'));
    $('poolSummary').textContent = plural(st.participants.length, 'participante cargado', 'participantes cargados') +
      ' · ' + S.pool().length + ' en el sorteo' + (q ? ' · ' + shown.length + ' coinciden con la búsqueda' : '');
    $('tabCountP').textContent = st.participants.length;
  }

  function renderWinners() {
    var st = S.state, list = $('listW');
    list.innerHTML = '';
    st.winners.forEach(function (w, i) {
      var li = h('li', 'person');
      // Se busca por id (estable); por nombre solo para ganadores guardados antes de este cambio.
      var line = LINES.filter(function (l) { return w.lineId ? l.id === w.lineId : (w.line && l.name === w.line); })[0];
      li.appendChild(h('span', 'person-n', String(i + 1)));
      var main = h('span', 'person-main');
      main.appendChild(h('span', 'person-name', w.name));
      var meta = [w.detail, w.prize && ('Premio: ' + w.prize), new Date(w.at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })].filter(Boolean).join('  ·  ');
      main.appendChild(h('span', 'person-detail', meta));
      li.appendChild(main);
      if (line) { var b = h('span', 'badge badge--line' + (line.name ? '' : ' badge--dot'), line.name); b.style.setProperty('--line', line.color); li.appendChild(b); }
      var x = h('button', 'x-btn', '×');
      x.title = 'Anular este resultado (vuelve al sorteo)';
      x.dataset.unwin = i;
      li.appendChild(x);
      list.appendChild(li);
    });
    if (!st.winners.length) list.appendChild(h('li', 'empty', 'Todavía no hay ganadores.'));
    $('winnersSummary').textContent = plural(st.winners.length, 'ganador', 'ganadores') + ' · ' + plural(st.absent.length, 'ausente', 'ausentes');
    $('tabCountW').textContent = st.winners.length;

    var la = $('listA');
    la.innerHTML = '';
    $('absentHead').hidden = !st.absent.length;
    st.absent.forEach(function (a, i) {
      var li = h('li', 'person');
      var main = h('span', 'person-main');
      main.appendChild(h('span', 'person-name', a.name));
      if (a.detail) main.appendChild(h('span', 'person-detail', a.detail));
      li.appendChild(main);
      var r = h('button', 'btn btn--small btn--ghost-dark', 'Devolver al sorteo');
      r.dataset.restore = i;
      li.appendChild(r);
      la.appendChild(li);
    });
  }

  function renderOptions() {
    var s = S.state.settings;
    $('titleInput').value = s.title;
    $('durationInput').value = String(s.duration);
    $('chkRemove').checked = !!s.removeWinners;
    $('perDrawInput').value = S.perDraw();
    $('chkSound').checked = !!s.sound;
    $('prizesInput').value = (s.prizes || []).join('\n');
  }

  function renderSettings() { renderParticipants(); renderWinners(); renderOptions(); }

  $('searchP').addEventListener('input', renderParticipants);
  $('listP').addEventListener('click', function (e) {
    var id = e.target.dataset && e.target.dataset.remove;
    if (id) S.removeParticipant(id);
  });
  $('listW').addEventListener('click', function (e) {
    var i = e.target.dataset && e.target.dataset.unwin;
    if (i == null) return;
    var w = S.state.winners[+i];
    if (confirm('¿Anular el resultado de ' + w.name + '? Volverá a participar en el sorteo.')) S.removeWinner(+i);
  });
  $('listA').addEventListener('click', function (e) {
    var i = e.target.dataset && e.target.dataset.restore;
    if (i != null) S.restoreAbsent(+i);
  });
  $('btnClearP').addEventListener('click', function () {
    if (!S.state.participants.length) return;
    if (confirm('¿Vaciar la lista de participantes? También se borrarán los ganadores registrados.')) S.setParticipants([], false);
  });
  $('btnResetDraw').addEventListener('click', function () {
    if (confirm('¿Reiniciar el sorteo? Se borran ganadores y ausentes; la lista de participantes se mantiene.')) S.resetDraw();
  });
  $('btnExport').addEventListener('click', function () {
    if (!S.state.winners.length) { toast('Aún no hay ganadores para exportar.'); return; }
    Importer.exportWinners(S.state.winners, S.state.absent);
  });

  // Opciones
  $('titleInput').addEventListener('input', function (e) { S.updateSettings({ title: e.target.value.trim() || 'Gran Sorteo' }); });
  $('durationInput').addEventListener('change', function (e) { S.updateSettings({ duration: +e.target.value }); });
  $('chkRemove').addEventListener('change', function (e) { S.updateSettings({ removeWinners: e.target.checked }); });
  $('perDrawInput').addEventListener('input', function (e) {
    var v = Math.floor(Number(e.target.value));
    if (v >= 1) S.updateSettings({ perDraw: Math.min(200, v) });
  });
  $('perDrawInput').addEventListener('change', function (e) { e.target.value = S.perDraw(); });
  $('chkSound').addEventListener('change', function (e) { S.updateSettings({ sound: e.target.checked }); });
  $('prizesInput').addEventListener('input', function (e) {
    S.updateSettings({ prizes: e.target.value.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean) });
  });

  /* ---------- Importación ---------- */
  var pending = null; // {source, rows}
  var book = null;    // {sheets, order, fileName}

  function showPreview() {
    var box = $('importPreview');
    if (!pending || !pending.rows.length) { box.hidden = true; return; }
    var res = Importer.finalize(pending.rows, []);
    box.hidden = false;
    $('previewCount').textContent = plural(res.list.length, 'participante listo', 'participantes listos') + ' para cargar';
    var notes = ['Origen: ' + pending.source];
    if (res.dupes) notes.push(plural(res.dupes, 'duplicado omitido', 'duplicados omitidos'));
    if (res.empty) notes.push(plural(res.empty, 'fila sin nombre omitida', 'filas sin nombre omitidas'));
    $('previewNotes').textContent = notes.join(' · ');
    var chips = $('previewSample');
    chips.innerHTML = '';
    res.list.slice(0, 8).forEach(function (p) { chips.appendChild(h('span', 'chip', p.name + (p.detail ? ' · ' + p.detail : ''))); });
    if (res.list.length > 8) chips.appendChild(h('span', 'chip chip--more', '+' + (res.list.length - 8) + ' más'));
  }

  var pasteTimer;
  $('pasteInput').addEventListener('input', function (e) {
    clearTimeout(pasteTimer);
    pasteTimer = setTimeout(function () {
      pending = { source: 'texto pegado', rows: Importer.parseText(e.target.value) };
      showPreview();
    }, 200);
  });

  function fillSelect(sel, header, value, allowNone) {
    sel.innerHTML = '';
    if (allowNone) { var o0 = h('option', null, '— Ninguna —'); o0.value = -1; sel.appendChild(o0); }
    header.forEach(function (name, i) {
      var o = h('option', null, Importer.columnLetter(i) + (name ? ' · ' + name : ''));
      o.value = i;
      sel.appendChild(o);
    });
    sel.value = value;
  }

  function setupMapping(resetGuess) {
    var rows = book.sheets[$('selSheet').value] || [];
    var width = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    var hasHeader = $('chkHeader').checked;
    var header = [];
    for (var i = 0; i < width; i++) header.push(hasHeader && rows[0] ? String(rows[0][i] || '').trim() : '');
    if (resetGuess) {
      var g = hasHeader ? Importer.guessColumns(header) : { name: 0, last: -1, detail: -1 };
      fillSelect($('selName'), header, g.name, false);
      fillSelect($('selLast'), header, g.last, true);
      fillSelect($('selDetail'), header, g.detail, true);
    }
    updateFromSheet();
  }

  function updateFromSheet() {
    var rows = book.sheets[$('selSheet').value] || [];
    pending = {
      source: book.fileName,
      rows: Importer.rowsFromSheet(rows, {
        hasHeader: $('chkHeader').checked,
        name: +$('selName').value, last: +$('selLast').value, detail: +$('selDetail').value
      })
    };
    showPreview();
  }

  function loadFile(file) {
    if (!file) return;
    Importer.readFile(file).then(function (b) {
      book = b; book.fileName = file.name;
      $('mapping').hidden = false;
      $('mappingFile').textContent = file.name;
      var sel = $('selSheet');
      sel.innerHTML = '';
      b.order.forEach(function (n) { var o = h('option', null, n + ' (' + b.sheets[n].length + ' filas)'); o.value = n; sel.appendChild(o); });
      $('fieldSheet').hidden = b.order.length < 2;
      // Detección de encabezado: ¿la 1.ª fila parece títulos?
      var first = (b.sheets[b.order[0]] || [])[0] || [];
      $('chkHeader').checked = first.some(function (c) { return /nombre|apellido|name|empresa|participante|asistente|correo|dni|cargo/i.test(String(c)); });
      setupMapping(true);
    }).catch(function (err) {
      console.error(err);
      toast('No se pudo leer el archivo: ' + (err && err.message ? err.message : err));
    });
  }

  $('fileInput').addEventListener('change', function (e) { loadFile(e.target.files[0]); e.target.value = ''; });
  var dz = $('dropzone');
  ['dragenter', 'dragover'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('is-over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { dz.addEventListener(ev, function () { dz.classList.remove('is-over'); }); });
  dz.addEventListener('drop', function (e) { e.preventDefault(); loadFile(e.dataTransfer.files[0]); });
  $('selSheet').addEventListener('change', function () { setupMapping(true); });
  $('chkHeader').addEventListener('change', function () { setupMapping(true); });
  ['selName', 'selLast', 'selDetail'].forEach(function (id) { $(id).addEventListener('change', updateFromSheet); });

  function commit(append) {
    if (!pending) return;
    if (!append && S.state.winners.length && !confirm('Reemplazar la lista borra también los ganadores registrados. ¿Continuar?')) return;
    var res = Importer.finalize(pending.rows, append ? S.state.participants : []);
    if (!res.list.length) { toast('No hay participantes nuevos para cargar.'); return; }
    S.setParticipants(res.list, append);
    toast(plural(res.list.length, 'participante cargado', 'participantes cargados') + (res.dupes ? ' (' + plural(res.dupes, 'duplicado omitido', 'duplicados omitidos') + ')' : '') + '.');
    pending = null;
    $('pasteInput').value = '';
    $('mapping').hidden = true;
    showPreview();
    selectTab('tabParticipants');
  }
  $('btnReplace').addEventListener('click', function () { commit(false); });
  $('btnAppend').addEventListener('click', function () { commit(true); });

  /* ================= Eventos globales ================= */
  ui.btnDraw.addEventListener('click', draw);
  $('btnConfirm').addEventListener('click', confirmWinner);
  $('btnAbsent').addEventListener('click', absentWinner);
  $('revealGrid').addEventListener('click', function (e) {
    var slot = e.target.dataset && e.target.dataset.slot;
    if (slot != null) replaceSlot(+slot);
  });
  $('btnSettings').addEventListener('click', function () { openSettings(); });
  $('btnFullscreen').addEventListener('click', toggleFullscreen);
  $('btnSound').addEventListener('click', function () { S.updateSettings({ sound: !S.state.settings.sound }); });
  ui.settings.addEventListener('close', function () { renderHeader(); if (!drawing) idleBoard(); });

  document.addEventListener('keydown', function (e) {
    if (ui.settings.open) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (!ui.reveal.hidden) {
      if (e.key === 'Enter') { e.preventDefault(); confirmWinner(); }
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); draw(); }
    else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    else if (e.key === 'm' || e.key === 'M') S.updateSettings({ sound: !S.state.settings.sound });
    else if (e.key === 'c' || e.key === 'C') openSettings();
  });

  S.onChange(function () {
    renderHeader();
    if (ui.settings.open) { renderParticipants(); renderWinners(); }
    if (!drawing) idleBoard();
  });

  /* ================= Inicio ================= */
  Network.build($('network'));
  renderHeader();
  idleBoard();
  if (!S.state.participants.length) setTimeout(function () { openSettings('tabImport'); }, 400);
})();
