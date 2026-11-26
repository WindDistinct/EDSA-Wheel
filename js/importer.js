/* Lectura de participantes desde texto pegado u hojas de cálculo (SheetJS). */
(function () {
  'use strict';

  function clean(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  }

  /** Clave para detectar duplicados: sin tildes, minúsculas, espacios simples. */
  function key(name, detail) {
    var k = (name + '|' + (detail || '')).normalize('NFD').replace(/[̀-ͯ]/g, '');
    return k.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /** Convierte filas {name, detail} en participantes únicos. */
  function finalize(rows, existing) {
    var seen = {};
    (existing || []).forEach(function (p) { seen[key(p.name, p.detail)] = 1; });
    var out = [], dupes = 0, empty = 0;
    rows.forEach(function (r) {
      var name = clean(r.name), detail = clean(r.detail);
      if (!name) { empty++; return; }
      var k = key(name, detail);
      if (seen[k]) { dupes++; return; }
      seen[k] = 1;
      out.push({ id: Store.uid() + '-' + out.length, name: name, detail: detail });
    });
    return { list: out, dupes: dupes, empty: empty };
  }

  var HEADER_RE = /^(nombres?( y apellidos?| completo)?|participantes?|name|full ?name|asistentes?)$/i;

  /** Texto: una persona por línea; separadores opcionales TAB ; | */
  function parseText(text) {
    var lines = String(text || '').split(/\r?\n/);
    var rows = [];
    lines.forEach(function (line, i) {
      if (!line.trim()) return;
      var parts = line.split(/\t|;|\|/).map(clean).filter(Boolean);
      if (!parts.length) return;
      if (i === 0 && HEADER_RE.test(parts[0])) return; // encabezado pegado desde Excel
      rows.push({ name: parts[0], detail: parts.slice(1).join(' · ') });
    });
    return rows;
  }

  /** Lee un archivo y devuelve {sheets: {nombre: filas[][]}, order: [nombres]} */
  function readFile(file) {
    return new Promise(function (resolve, reject) {
      if (typeof XLSX === 'undefined') { reject(new Error('No se cargó la librería de hojas de cálculo.')); return; }
      var reader = new FileReader();
      reader.onerror = function () { reject(reader.error); };
      reader.onload = function () {
        try {
          var wb = XLSX.read(new Uint8Array(reader.result), { type: 'array', cellDates: true, codepage: 65001 });
          var sheets = {};
          wb.SheetNames.forEach(function (n) {
            var rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '', blankrows: false });
            sheets[n] = rows.filter(function (r) { return r.some(function (c) { return clean(c) !== ''; }); });
          });
          resolve({ sheets: sheets, order: wb.SheetNames.slice() });
        } catch (e) { reject(e); }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function columnLetter(i) {
    var s = '';
    i++;
    while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }

  /** Sugiere columnas a partir del encabezado. */
  function guessColumns(header) {
    var norm = header.map(function (h) {
      return clean(h).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    });
    function find(re) { for (var i = 0; i < norm.length; i++) if (re.test(norm[i])) return i; return -1; }
    var name = find(/^(nombres? y apellidos?|nombre completo|apellidos? y nombres?|full ?name|participante|asistente)/);
    var last = -1;
    if (name < 0) {
      name = find(/^(nombres?|name|first ?name)\b/);
      last = find(/^(apellidos?|last ?name|surname)/);
    }
    var detail = find(/(empresa|compan|organizacion|institucion|entidad|area|cargo|company|organization)/);
    if (name < 0) name = 0;
    return { name: name, last: last, detail: detail };
  }

  /** Filas de la hoja -> [{name, detail}] según columnas elegidas. */
  function rowsFromSheet(rows, opts) {
    var body = opts.hasHeader ? rows.slice(1) : rows;
    return body.map(function (r) {
      var name = clean(r[opts.name]);
      if (opts.last >= 0) name = clean(name + ' ' + clean(r[opts.last]));
      return { name: name, detail: opts.detail >= 0 ? clean(r[opts.detail]) : '' };
    });
  }

  /** Exporta ganadores a .xlsx (o CSV si no hay SheetJS). */
  function exportWinners(winners, absent) {
    var stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    var rows = winners.map(function (w, i) {
      return { '#': i + 1, 'Nombre': w.name, 'Empresa / detalle': w.detail, 'Premio': w.prize, 'Línea': w.line || w.lineId || '', 'Hora': new Date(w.at).toLocaleString('es-PE') };
    });
    if (typeof XLSX !== 'undefined') {
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Ganadores');
      if (absent && absent.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(absent.map(function (a) {
          return { 'Nombre': a.name, 'Empresa / detalle': a.detail, 'Hora': new Date(a.at).toLocaleString('es-PE') };
        })), 'Ausentes');
      }
      XLSX.writeFile(wb, 'ganadores-sorteo-' + stamp + '.xlsx');
      return;
    }
    var csv = ['#;Nombre;Empresa / detalle;Premio;Línea;Hora'].concat(rows.map(function (r) {
      return [r['#'], r.Nombre, r['Empresa / detalle'], r.Premio, r['Línea'], r.Hora].map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';');
    })).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = 'ganadores-sorteo-' + stamp + '.csv';
    a.click();
  }

  window.Importer = {
    parseText: parseText,
    readFile: readFile,
    guessColumns: guessColumns,
    rowsFromSheet: rowsFromSheet,
    finalize: finalize,
    columnLetter: columnLetter,
    exportWinners: exportWinners
  };
})();
