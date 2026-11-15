// Dossierkennis: de telefoon met de voorbeeldmail, rechts in de opening van een gemeentepagina.
// Alleen de telefoon: geen kader, geen koppen, geen eindbeeld (dat is het filmpje voor pers en sociale media,
// lancering/filmpje/stage.js). De mail in de telefoon is de echte voorbeeldmail van de pagina: een iframe van
// <figure class="mailtelefoon" data-mail="voorbeeld/...html">. De maat staat vast in de stijl van de pagina
// (GEMEENTE_CSS in maak_pagina.py), dus de pagina verspringt niet als dit script laadt.
// Lagen, in de maten van een telefoonscherm van 390 x 844 en in zijn geheel geschaald:
//   romp   (canvas, één keer getekend): de telefoon zelf met zijn schaduw
//   onder  (canvas): postvak, kop van de mail, balken
//   midden (iframe): de mail zelf
//   boven  (canvas): wegzakken van de rest van de mail, blauwe lijn in de kantlijn, scherm aan en uit
(function () {
  'use strict';
  var figs = document.querySelectorAll('figure.mailtelefoon[data-mail]');
  if (!figs.length || !window.HTMLCanvasElement) return;
  Array.prototype.forEach.call(figs, telefoon);

  function telefoon(fig) {
    var SYS = '-apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif';
    var APP = '#0F6CBD', INK = '#141414', GREY = '#6B6B6B', LINE = '#E6E6E6', BRAND = '#0008B8';
    var SW = 390, SH = 844, BEZ = 10.3, PR = 57, TOP = 91, BOT = 764;
    var BW = SW + 2 * BEZ, BH = SH + 2 * BEZ;          // de romp
    var PADX = 90, PADT = 50, PADB = 20;                // ruimte voor de schaduw rond de romp
    var AIR = 16, GHOST = 0.82, FADE = 0.5;
    // Tijden in seconden. Het scherm gaat aan, de klok springt, de mail komt binnen en gaat open.
    var T = { wake: 0.7, arrive: 1.5, tap: 2.9, open: 3.1, openDur: 0.6, beat0: 5.4, end: 0, sleep: 0, total: 0 };
    var HOLD = [2.6, 2.8, 2.4, 2.8];                    // hoe lang elk rustpunt stilstaat
    var ROOM = 540, VISB = BOT;
    // Staat het volgende rustpunt ver weg (de vooruitblik onderaan een lange mail), dan scrolt de mail niet in
    // een paar tellen duizenden pixels voorbij: hij scrolt rustig door, vloeit over in wit en komt aan bij het doel.
    var VER = 2600, STUK = 1300;

    var clamp = function (x, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return Math.max(a, Math.min(b, x)); };
    var lerp = function (a, b, t) { return a + (b - a) * t; };
    var prog = function (t, a, d) { return clamp((t - a) / d); };
    function bezier(x1, y1, x2, y2) {
      var f = function (a, b, u) { return 3 * a * u * (1 - u) * (1 - u) + 3 * b * u * u * (1 - u) + u * u * u; };
      return function (x) { if (x <= 0) return 0; if (x >= 1) return 1; var lo = 0, hi = 1, u = x;
        for (var i = 0; i < 30; i++) { var v = f(x1, x2, u); if (Math.abs(v - x) < 1e-5) break; if (v < x) lo = u; else hi = u; u = (lo + hi) / 2; }
        return f(y1, y2, u); };
    }
    var eOut = bezier(0.2, 0, 0, 1), eIO = bezier(0.6, 0, 0.3, 1), eSoft = bezier(0.33, 0, 0.67, 1);

    // ---- opbouw ----
    function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
    var toestel = fig.querySelector('.mt-toestel') || fig.appendChild(el('div', 'mt-toestel'));
    toestel.innerHTML = '';
    var lift = el('div', 'mt-lift'), stage = el('div', 'mt-stage');
    var cR = el('canvas', 'mt-romp'), scherm = el('div', 'mt-scherm');
    var cA = el('canvas'), cB = el('canvas'), mailvak = el('div', 'mt-mail'), frame_ = el('iframe');
    frame_.setAttribute('aria-hidden', 'true'); frame_.setAttribute('tabindex', '-1'); frame_.setAttribute('scrolling', 'no');
    frame_.setAttribute('title', 'Voorbeeldmail'); frame_.inert = true;
    mailvak.appendChild(frame_); scherm.appendChild(cA); scherm.appendChild(mailvak); scherm.appendChild(cB);
    stage.appendChild(cR); stage.appendChild(scherm); lift.appendChild(stage); toestel.appendChild(lift);
    var knop = el('button', 'mt-knop'); knop.type = 'button'; fig.appendChild(knop);
    fig.setAttribute('role', 'group');
    fig.setAttribute('aria-label', 'Een telefoon waarop de mail van Dossierkennis binnenkomt en opengaat. Je ziet de hoofdpunten, wat een besluit betekent, de bron en wat eraan komt.');
    var gA = cA.getContext('2d'), gB = cB.getContext('2d'), gR = cR.getContext('2d'), g = gA;

    // ---- maat: alles zo groot als het op het scherm staat, maal de pixeldichtheid ----
    var S = 1, PX = 1, tNu = 0, doc = null;
    function maat() {
      var w = toestel.clientWidth || 320; S = w / BW;
      stage.style.transform = 'scale(' + S + ')';
      PX = S * Math.min(window.devicePixelRatio || 1, 3);
      [cA, cB].forEach(function (c) { var pw = Math.round(SW * PX), ph = Math.round(SH * PX); if (c.width !== pw) { c.width = pw; c.height = ph; } });
      var rw = Math.round((BW + 2 * PADX) * PX), rh = Math.round((BH + PADT + PADB) * PX);
      if (cR.width !== rw) { cR.width = rw; cR.height = rh; }
      romp();
      // tot waar het scherm te zien is: de onderkant van het vak is de rand van het grijze vlak
      var visb = Math.min(BOT, (fig.clientHeight || 600) / S - BEZ), room = visb - TOP - 2 * AIR;
      if (Math.abs(room - ROOM) > 1) { VISB = visb; ROOM = room; if (doc) { lees(doc); if (stil && !loopt) tNu = stilbeeld(); } }
      keyA = keyB = ''; teken(tNu);
    }

    // ---- de mail: onderwerp, ankers en slordige rijen, gemeten in de iframe ----
    var SUBJECT = 'Dossierkennis', WHEN = '', PRE = '', HEAD = 158, MAILH = 0, STOPS = [], FLAWS = [], klaar = false;
    function lees(d) {
      var R = function (e) { var r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; };
      var bot = function (r) { return r[1] + r[3]; };
      var delen = (d.title || '').split('·').map(function (s) { return s.trim(); });
      if (delen.length > 2) { SUBJECT = 'Dossierkennis ' + delen[1] + ' · ' + delen[delen.length - 1];
        var dm = delen[delen.length - 1].split(' '); WHEN = 'ma ' + dm[0] + ' ' + (dm[1] || '').slice(0, 3) + ' 07:00'; }
      var kern = d.querySelectorAll('p.dk-kern');
      PRE = kern.length ? kern[0].textContent.replace(/\s+/g, ' ').trim() : '';
      MAILH = Math.min(16000, d.documentElement.scrollHeight);
      var stops = [];
      // 1. een punt uit "In één oogopslag" (het tweede, zoals in het filmpje)
      var kp = kern[1] || kern[0];
      if (kp) { var tr = kp.closest('tr') || kp, a = R(tr), b = R(kp); stops.push({ i: 0, full: [a[1] + 2, bot(a) - 2], mark: [b[1] + 4, bot(b) - 2] }); }
      // 2 en 3. het eerste bericht met "Wat betekent dit?" en een bron vlak eronder dat in beeld past
      var heads = d.querySelectorAll('h2, h4');
      var vaks = Array.prototype.map.call(d.querySelectorAll('.dk-vak'), R);
      var links = Array.prototype.filter.call(d.querySelectorAll('a'), function (x) { return /↗/.test(x.textContent); }).map(R);
      // Eerst een bericht dat in zijn geheel in beeld past (kop, tekst, "Wat betekent dit?", bron vlak eronder).
      // Is elk bericht daarvoor te lang (in veel grote steden), dan alleen het vak "Wat betekent dit?" en daarna,
      // een stuk verder, de bron van hetzelfde bericht.
      var berichten = [];
      for (var i = 0; i < heads.length; i++) {
        if (!heads[i].classList.contains('dk-h4')) continue;
        var nh = R(heads[i]), end = heads[i + 1] ? R(heads[i + 1])[1] : 1e9;
        var nb = vaks.find(function (v) { return v[1] > nh[1] && v[1] < end; }); if (!nb) continue;
        var na = links.find(function (l) { return l[1] > bot(nb) && l[1] < end; }); if (!na) continue;
        var nz = na; links.forEach(function (l) { if (l[1] >= na[1] && l[1] < end && l[1] - bot(nz) < 30) nz = l; });   // de hele bronrij
        berichten.push({ nh: nh, nb: nb, na: na, nz: nz });
      }
      var heel = berichten.find(function (b) { return bot(b.nb) + 8 - (b.nh[1] - 8) <= ROOM && b.na[1] - bot(b.nb) <= 200; });
      if (heel) {
        stops.push({ i: 1, full: [heel.nh[1] - 8, bot(heel.nb) + 8], mark: [heel.nb[1], bot(heel.nb)] });
        stops.push({ i: 2, full: [heel.nh[1] - 8, bot(heel.na) + 10], mark: [heel.na[1] - 1, bot(heel.na) + 2], low: true, linked: true });
      } else {
        var vak = berichten.find(function (b) { return b.nb[3] + 16 <= ROOM && bot(b.nz) - b.na[1] + 20 <= ROOM; });
        if (vak) {
          stops.push({ i: 1, full: [vak.nb[1] - 8, bot(vak.nb) + 8], mark: [vak.nb[1], bot(vak.nb)] });
          if (bot(vak.na) + 10 - (vak.nb[1] - 8) <= ROOM && vak.na[1] - bot(vak.nb) <= 200)
            stops.push({ i: 2, full: [vak.nb[1] - 8, bot(vak.na) + 10], mark: [vak.na[1] - 1, bot(vak.na) + 2], low: true, linked: true });
          else stops.push({ i: 2, full: [vak.na[1] - 10, bot(vak.nz) + 10], mark: [vak.na[1] - 1, bot(vak.nz) + 2] });
        }
      }
      // 4. de vooruitblik: de kop en het eerste punt op de agenda, tot en met de eerste bron;
      //    past dat niet, dan het eerste punt zonder de kop (datum, punt en bron)
      var vh = Array.prototype.find.call(d.querySelectorAll('h2'), function (h) { return /vooruitblik/i.test(h.textContent); });
      if (vh) { var v = R(vh), dd = d.querySelector('.dk-agd-d'), l = links.find(function (x) { return x[1] > v[1]; });
        if (dd && l && bot(l) + 8 - (v[1] - 36) <= ROOM) stops.push({ i: 3, full: [v[1] - 36, bot(l) + 8], mark: [R(dd)[1], bot(l)] });
        else if (dd && l && bot(l) + 8 - (R(dd)[1] - 8) <= ROOM) stops.push({ i: 3, full: [R(dd)[1] - 8, bot(l) + 8], mark: [R(dd)[1], bot(l)] });
        else if (dd) {   // ook dat te lang (kleine telefoon): de datum en zo veel van het punt als er heel in past
          var d0 = R(dd)[1], tot = 0;
          Array.prototype.forEach.call(d.querySelectorAll('.dk-agd-t p'), function (p) { var r = R(p); if (r[1] >= d0 && bot(r) + 8 - (d0 - 8) <= ROOM && (!tot || r[1] - tot < 12)) tot = Math.max(tot, bot(r)); });
          if (tot) stops.push({ i: 3, full: [d0 - 8, tot + 8], mark: [d0, tot] }); } }
      // bronrijen waar het sjabloon slordig is (twee keer hetzelfde label, of een los puntje aan het eind van een regel)
      var rows = [];
      Array.prototype.forEach.call(d.querySelectorAll('a'), function (x) { if (!/↗/.test(x.textContent)) return; var c = x.parentElement && x.parentElement.parentElement; if (c && c.tagName === 'SPAN' && rows.indexOf(c) < 0) rows.push(c); });
      FLAWS = [];
      rows.forEach(function (c) {
        var labs = Array.prototype.map.call(c.querySelectorAll('a'), function (x) { return x.textContent.trim(); });
        var bad = new Set(labs).size < labs.length;
        Array.prototype.forEach.call(c.children, function (k) { if (k.textContent.trim() !== '·') return; var n = k.nextElementSibling; if (!n) { bad = true; return; } if (n.getBoundingClientRect().top > k.getBoundingClientRect().top + 6) bad = true; });
        if (bad) { var lo = 1e9, hi = 0; Array.prototype.forEach.call(c.getClientRects(), function (r) { lo = Math.min(lo, r.top); hi = Math.max(hi, r.bottom); }); FLAWS.push([Math.floor(lo) - 1, Math.ceil(hi) + 1]); }
      });
      // tijdlijn: naar elk rustpunt scrollen (langer bij een grotere afstand), dan zakt de rest weg
      g = gA; HEAD = 24 + wrap(SUBJECT, 350, 21, 700, SYS).length * 27 + 96;
      var vt = TOP, vb = VISB, t = T.beat0, vorigeSy = 0;
      stops.forEach(function (s, n) {
        var a = s.full[0], b = s.full[1], h = b - a, top;
        if (h <= ROOM) top = vt + AIR + (ROOM - h) * (s.i === 0 ? 0.12 : 0.4); else top = s.low ? vb - AIR - h : vt + AIR;
        if (s.low && h <= ROOM) top = vb - AIR - h - (ROOM - h) * 0.25;
        s.sy = Math.max(0, Math.round(TOP + HEAD + a - top));
        s.linked = !!s.linked && n > 0 && stops[n - 1].i === 1;
        var afstand = Math.abs(s.sy - vorigeSy); vorigeSy = s.sy;
        if (s.linked) { s.s0 = t; s.s1 = t + 1.1; s.f0 = t; }                       // zelfde bericht: de lijn schuift door naar de bron
        else if (afstand > VER) { s.sprong = true; s.s0 = t; s.s1 = t + 3.0; s.f0 = s.s1 - 0.2; }   // ver weg: overvloeien
        else { s.s0 = t; s.s1 = t + clamp(1.3 + afstand / 1100, 1.5, 3.4); s.f0 = s.s1 - 0.2; }
        s.f1 = s.f0 + FADE + HOLD[s.i];
        var volgende = stops[n + 1];
        t = (volgende && volgende.linked && s.i === 1) ? s.f1 : s.f1 + FADE * 0.7;
      });
      STOPS = stops; T.end = stops.length ? stops[stops.length - 1].f1 + FADE : T.beat0 + 2;
      T.sleep = T.end + 0.5; T.total = T.sleep + 1.0;
      frame_.style.height = MAILH + 'px';
      klaar = true;
    }
    T.end = T.beat0; T.sleep = T.end + 0.5; T.total = T.sleep + 1.0;

    function wrap(s, max, size, weight, font) { g.font = weight + ' ' + size + 'px ' + font; var ws = s.split(' '), out = [], l = '';
      ws.forEach(function (x) { var t = l ? l + ' ' + x : x; if (g.measureText(t).width > max && l) { out.push(l); l = x; } else l = t; }); if (l) out.push(l); return out; }

    function scrollstand(t) {
      var sy = 0, prev = 0;
      for (var i = 0; i < STOPS.length; i++) { var s = STOPS[i];
        if (t >= s.s1) { sy = s.sy; prev = s.sy; }
        else if (t >= s.s0) { var e = eIO(prog(t, s.s0, s.s1 - s.s0));
          if (s.sprong) { var v = e * STUK; sy = v < STUK / 2 ? prev + v : s.sy - (STUK - v); } else sy = lerp(prev, s.sy, e);
          break; }
        else break; }
      return sy;
    }
    function sluier(t) { var a = 0; STOPS.forEach(function (s) { if (!s.sprong || t <= s.s0 || t >= s.s1) return;
      var e = eIO(prog(t, s.s0, s.s1 - s.s0)); a = Math.max(a, eSoft(clamp((0.5 - Math.abs(e - 0.5)) / 0.36))); }); return a; }
    function stopAlpha(s, t) { return eSoft(prog(t, s.f0, FADE)) * (1 - eSoft(prog(t, s.f1, FADE))); }
    // het scherm gaat aan bij het begin en uit aan het eind: het laatste beeld is gelijk aan het eerste
    function donker(t) { return Math.max(1 - eSoft(prog(t, 0.1, T.wake - 0.1)), eSoft(prog(t, T.sleep, 0.6))); }
    function slide(t) { return eOut(clamp((t - T.open) / T.openDur)); }

    function rr(x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
    function txt(s, x, y, size, color, weight, font, align) { g.font = (weight || 400) + ' ' + size + 'px ' + (font || SYS); g.fillStyle = color; g.textAlign = align || 'left'; g.fillText(s, x, y); }
    function ellipsis(s, max, size, weight) { g.font = (weight || 400) + ' ' + size + 'px ' + SYS; if (g.measureText(s).width <= max) return s; while (s.length && g.measureText(s + '…').width > max) s = s.slice(0, -1); return s + '…'; }
    function statusBar(t) {
      var p = eOut(prog(t, T.arrive - 0.3, 0.35));
      g.save(); g.beginPath(); g.rect(30, 14, 80, 26); g.clip();
      if (p < 1) txt('6:59', 46, 32 - 20 * p, 16, INK, 600); if (p > 0) txt('7:00', 46, 32 + 20 * (1 - p), 16, INK, 600); g.restore();
      for (var i = 0; i < 4; i++) { g.fillStyle = INK; rr(298 + i * 5, 28 - (i + 1) * 3, 3.2, (i + 1) * 3, 1); g.fill(); }
      g.strokeStyle = INK; g.lineWidth = 2; g.lineCap = 'round';
      for (i = 0; i < 3; i++) { g.beginPath(); g.arc(328, 31, 3 + i * 4, -Math.PI * 0.75, -Math.PI * 0.25); g.stroke(); }
      g.lineWidth = 1; g.strokeStyle = '#999'; rr(342, 20, 25, 12, 3.5); g.stroke(); g.fillStyle = INK; rr(344, 22, 19, 8, 2); g.fill(); rr(368, 24, 2, 4, 1); g.fillStyle = '#999'; g.fill();
    }
    var MARK = window.Path2D ? new Path2D('M3 0H9C15 0 15 10 21 10H29A3 3 0 0 1 32 13V17A3 3 0 0 1 29 20H21C15 20 15 10 9 10H3A3 3 0 0 1 0 7V3A3 3 0 0 1 3 0Z M25 1H29.5A2.5 2.5 0 0 1 29.5 6H25A2.5 2.5 0 0 1 25 1Z') : null;
    function logoAvatar(x, y, r) { g.fillStyle = BRAND; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      if (!MARK) return; var s = r * 1.22 / 32; g.save(); g.translate(x - 16 * s, y - 10 * s); g.scale(s, s); g.fillStyle = '#fff'; g.fill(MARK); g.restore(); }
    function avatar(x, y, r, bg, label) { if (label === 'DK') return logoAvatar(x, y, r); g.fillStyle = bg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); txt(label, x, y + r * 0.36, r * 0.95, '#fff', 600, SYS, 'center'); }
    // De andere mails zijn verzonnen en algemeen: geen namen van personen, niets van één gemeente.
    var ROWS = [
      { who: 'Dossierkennis', ini: 'DK', time: '07:00', unread: true },
      { who: 'Team', ini: 'TM', bg: '#2E7D5B', time: 'vr', sub: 'Planning komende weken', pre: 'Hierbij de bijgewerkte planning voor de komende weken.' },
      { who: 'Agenda', ini: 'AG', bg: '#8A4FBF', time: 'vr', sub: 'Uitnodiging: afstemming met de wethouder', pre: 'Dinsdag 10:00–11:00 · kamer 4.12' },
      { who: 'Griffie', ini: 'GR', bg: '#C2571A', time: 'do', sub: 'Stukken commissie', pre: 'De stukken voor de commissie van volgende week staan klaar.' },
      { who: 'Intranet', ini: 'IN', bg: '#5B6770', time: 'do', sub: 'Nieuw: werkplekreservering vanaf december', pre: 'Vanaf 1 december reserveer je een werkplek via de app.' },
      { who: 'Facilitair', ini: 'FA', bg: '#9A7B1C', time: 'wo', sub: 'Storing printer 3e verdieping verholpen', pre: 'De printer bij de lift werkt weer.' },
      { who: 'Team', ini: 'TM', bg: '#2E7D5B', time: 'di', sub: 'Notulen overleg 3 november', pre: 'In de bijlage de notulen. Actiepunten staan onderaan.' },
      { who: 'Agenda', ini: 'AG', bg: '#8A4FBF', time: 'di', sub: 'Herinnering: teamoverleg', pre: 'Woensdag 09:30 · kamer 2.08' }
    ];
    function inbox(t) {
      g.fillStyle = '#fff'; g.fillRect(0, 0, SW, SH);
      statusBar(t);
      avatar(34, 82, 17, '#D9D9D9', ''); g.fillStyle = '#8a8a8a'; g.beginPath(); g.arc(34, 77, 6, 0, 7); g.fill(); g.beginPath(); g.arc(34, 93, 10, Math.PI, 0); g.fill();
      txt('Postvak IN', 64, 90, 22, INK, 700);
      g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.arc(352, 80, 8, 0, 7); g.stroke(); g.beginPath(); g.moveTo(358, 86); g.lineTo(364, 92); g.stroke();
      rr(18, 112, 92, 32, 16); g.fillStyle = APP; g.fill(); txt('Gefocust', 64, 133, 14, '#fff', 600, SYS, 'center');
      txt('Overig', 146, 133, 14, GREY, 500, SYS, 'center');
      var RH = 84, a = eOut(prog(t, T.arrive, 0.7));
      g.save(); g.beginPath(); g.rect(0, 152, SW, BOT - 152); g.clip();
      ROWS.forEach(function (r, i) {
        var y = 160 + i * RH - (1 - a) * RH, al = i === 0 ? clamp(a * 1.4 - 0.4) : 1;
        if (y > BOT || al <= 0) return;
        var sub = i === 0 ? SUBJECT : r.sub, pre = i === 0 ? PRE : r.pre;
        g.save(); g.globalAlpha = al;
        if (i === 0 && t > T.tap) { var p = clamp((t - T.tap) / 0.12); g.fillStyle = 'rgba(15,108,189,' + (0.10 * p) + ')'; g.fillRect(0, y - 6, SW, RH); }
        if (r.unread) { g.fillStyle = APP; g.beginPath(); g.arc(9, y + 22, 4, 0, 7); g.fill(); }
        avatar(40, y + 24, 20, r.bg, r.ini);
        txt(ellipsis(r.who, 220, 16, r.unread ? 700 : 500), 72, y + 20, 16, INK, r.unread ? 700 : 500);
        txt(r.time, 372, y + 20, 13, r.unread ? APP : GREY, r.unread ? 600 : 400, SYS, 'right');
        txt(ellipsis(sub, 296, 15, r.unread ? 600 : 400), 72, y + 42, 15, INK, r.unread ? 600 : 400);
        txt(ellipsis(pre, 296, 14), 72, y + 63, 14, GREY);
        g.fillStyle = LINE; g.fillRect(72, y + RH - 6, 318, 1);
        g.restore();
      });
      g.restore();
      tabbar();
    }
    function tabbar() {
      g.fillStyle = '#FAFAFA'; g.fillRect(0, 764, SW, 80); g.fillStyle = LINE; g.fillRect(0, 764, SW, 1);
      [['Mail', 65, true], ['Agenda', 195, false], ['Zoeken', 325, false]].forEach(function (it) {
        var n = it[0], x = it[1], on = it[2], col = on ? APP : '#8A8A8A';
        g.strokeStyle = col; g.lineWidth = 1.8;
        if (n === 'Mail') { rr(x - 12, 778, 24, 17, 3); g.stroke(); g.beginPath(); g.moveTo(x - 12, 780); g.lineTo(x, 789); g.lineTo(x + 12, 780); g.stroke(); }
        if (n === 'Agenda') { rr(x - 11, 777, 22, 20, 3); g.stroke(); g.fillStyle = col; g.fillRect(x - 11, 782, 22, 2); }
        if (n === 'Zoeken') { g.beginPath(); g.arc(x - 2, 786, 7, 0, 7); g.stroke(); g.beginPath(); g.moveTo(x + 3, 791); g.lineTo(x + 9, 797); g.stroke(); }
        txt(n, x, 814, 11, col, on ? 600 : 500, SYS, 'center');
      });
      g.fillStyle = INK; rr(128, 830, 134, 5, 3); g.fill();
    }
    // (onderste laag) de mail zonder inhoud: onderwerp, afzender en de balken; de inhoud is de iframe
    function mailview(t, sy) {
      g.fillStyle = '#fff'; g.fillRect(0, 0, SW, SH);
      g.save(); g.beginPath(); g.rect(0, TOP, SW, BOT - TOP); g.clip();
      var y0 = TOP - sy;
      wrap(SUBJECT, 350, 21, 700, SYS).forEach(function (l, i) { txt(l, 20, y0 + 38 + i * 27, 21, INK, 700); });
      var ay = y0 + HEAD - 46;
      avatar(40, ay, 20, BRAND, 'DK');
      txt('Dossierkennis', 72, ay - 5, 16, INK, 700); txt('Aan: jou' + (WHEN ? ' · ' + WHEN : ''), 72, ay + 15, 13, GREY);
      g.fillStyle = LINE; g.fillRect(0, y0 + HEAD - 6, SW, 1);
      g.restore();
      g.fillStyle = '#fff'; g.fillRect(0, 0, SW, TOP); g.fillStyle = LINE; g.fillRect(0, TOP - 1, SW, 1);
      statusBar(t);
      g.strokeStyle = APP; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(26, 60); g.lineTo(17, 69); g.lineTo(26, 78); g.stroke();
      g.lineWidth = 1.8; g.strokeStyle = INK;
      rr(268, 61, 20, 16, 2); g.stroke(); g.beginPath(); g.moveTo(266, 61); g.lineTo(290, 61); g.stroke(); g.beginPath(); g.moveTo(274, 68); g.lineTo(282, 68); g.stroke();
      g.beginPath(); g.moveTo(306, 62); g.lineTo(326, 62); g.moveTo(313, 58); g.lineTo(319, 58); g.moveTo(308, 62); g.lineTo(310, 79); g.lineTo(322, 79); g.lineTo(324, 62); g.stroke();
      for (var i = 0; i < 3; i++) { g.fillStyle = INK; g.beginPath(); g.arc(352 + i * 7, 69, 2, 0, 7); g.fill(); }
      g.fillStyle = '#FAFAFA'; g.fillRect(0, BOT, SW, SH - BOT); g.fillStyle = LINE; g.fillRect(0, BOT, SW, 1);
      rr(20, 778, 226, 40, 20); g.strokeStyle = '#C9C9C9'; g.lineWidth = 1.2; g.stroke();
      g.strokeStyle = APP; g.lineWidth = 2; g.beginPath(); g.moveTo(52, 792); g.lineTo(44, 798); g.lineTo(52, 804); g.moveTo(44, 798); g.quadraticCurveTo(60, 794, 66, 806); g.stroke();
      txt('Beantwoorden', 80, 804, 15, APP, 600);
      g.beginPath(); g.arc(300, 798, 15, 0, 7); g.strokeStyle = '#C9C9C9'; g.stroke(); g.beginPath(); g.arc(352, 798, 15, 0, 7); g.stroke();
      g.strokeStyle = INK; g.lineWidth = 1.8; g.beginPath(); g.moveTo(293, 798); g.lineTo(307, 798); g.moveTo(301, 792); g.lineTo(307, 798); g.lineTo(301, 804); g.stroke();
      for (i = 0; i < 3; i++) { g.fillStyle = INK; g.beginPath(); g.arc(345 + i * 7, 798, 1.8, 0, 7); g.fill(); }
      g.fillStyle = INK; rr(128, 830, 134, 5, 3); g.fill();
    }
    function schermOnder(t, sy) {
      var p = clamp((t - T.open) / T.openDur), e = eOut(p);
      if (p < 1) { g.save(); g.translate(-90 * e, 0); inbox(t); g.fillStyle = 'rgba(0,0,0,' + (0.12 * e) + ')'; g.fillRect(0, 0, SW, SH); g.restore(); }
      if (p > 0) {
        g.save(); g.translate(SW * (1 - e), 0);
        if (p < 1) { g.save(); g.shadowColor = 'rgba(0,0,0,.15)'; g.shadowBlur = 20 * PX; g.fillStyle = '#fff'; g.fillRect(0, 0, SW, SH); g.restore(); }
        mailview(t, sy); g.restore();
      }
    }
    // de romp: één keer tekenen (en opnieuw als de maat verandert), want schaduwen zijn duur
    function romp() {
      g = gR; g.setTransform(PX, 0, 0, PX, 0, 0); g.clearRect(0, 0, BW + 2 * PADX, BH + PADT + PADB);
      g.save(); g.translate(PADX + BEZ, PADT + BEZ);
      [[64, 30, 0.11], [22, 10, 0.09], [5, 2, 0.10]].forEach(function (s) { g.save(); g.shadowColor = 'rgba(16,20,40,' + s[2] + ')'; g.shadowBlur = s[0] * PX; g.shadowOffsetY = s[1] * PX; rr(-BEZ, -BEZ, BW, BH, PR); g.fillStyle = '#1A1A1C'; g.fill(); g.restore(); });
      g.fillStyle = '#2C2C2E'; rr(-BEZ - 1.8, 130, 3, 34, 1.5); g.fill(); rr(-BEZ - 1.8, 182, 3, 59, 1.5); g.fill(); rr(-BEZ - 1.8, 251, 3, 59, 1.5); g.fill(); rr(SW + BEZ - 1.2, 210, 3, 88, 1.5); g.fill();
      var grd = g.createLinearGradient(-BEZ, 0, SW + BEZ, 0); grd.addColorStop(0, '#6A6A6E'); grd.addColorStop(0.035, '#2E2E31'); grd.addColorStop(0.5, '#1F1F22'); grd.addColorStop(0.965, '#2E2E31'); grd.addColorStop(1, '#6A6A6E');
      rr(-BEZ, -BEZ, BW, BH, PR); g.fillStyle = grd; g.fill();
      g.save(); g.strokeStyle = 'rgba(255,255,255,0.20)'; g.lineWidth = 0.7; rr(-BEZ + 0.6, -BEZ + 0.6, BW - 1.2, BH - 1.2, PR - 0.6); g.stroke(); g.restore();
      rr(-BEZ + 2.6, -BEZ + 2.6, BW - 5.2, BH - 5.2, PR - 2.6); g.fillStyle = '#070708'; g.fill();
      g.restore(); g = gA;
    }
    // (bovenste laag) de rest van de mail zakt weg, slordige bronrijen weg, de blauwe lijn, het scherm aan en uit
    function schermBoven(t, sy) {
      var px = function (y) { return Math.round(y * PX) / PX; };
      var p = clamp((t - T.open) / T.openDur);
      if (p > 0) {
        g.save(); g.translate(SW * (1 - slide(t)), 0);
        g.beginPath(); g.rect(0, TOP, SW, BOT - TOP); g.clip();
        var base = TOP - sy + HEAD, vt = TOP, vb = BOT;
        var white = function (a, b, al) { a = Math.max(a, vt); b = Math.min(b, vb); if (b > a && al > 0) { g.fillStyle = 'rgba(255,255,255,' + al + ')'; g.fillRect(0, a, SW, b - a); } };
        FLAWS.forEach(function (f) { white(base + f[0], base + f[1], 1); });
        white(vt, vb, sluier(t));
        var act = [], ys = [vt, vb];
        STOPS.forEach(function (s) { var al = stopAlpha(s, t); if (al > 0) { act.push([s, al]); ys.push(px(base + s.full[0]), px(base + s.full[1])); } });
        if (act.length) {
          ys = ys.map(function (y) { return clamp(y, vt, vb); }).sort(function (x, y) { return x - y; });
          for (var i = 0; i + 1 < ys.length; i++) { var m = (ys[i] + ys[i + 1]) / 2 - base, w = 0;
            act.forEach(function (x) { if (m < x[0].full[0] || m > x[0].full[1]) w += x[1]; });
            white(ys[i], ys[i + 1], Math.min(1, w) * GHOST); }
          // de blauwe lijn in de kantlijn; bij het bericht schuift hij van "Wat betekent dit?" door naar de bron
          STOPS.forEach(function (s, n) {
            if (s.linked) return;
            var al = stopAlpha(s, t), m0 = s.mark[0], m1 = s.mark[1], nx = STOPS[n + 1];
            if (nx && nx.linked) { var e = eIO(prog(t, nx.f0, 1.0)); al = Math.min(1, al + stopAlpha(nx, t)); m0 = lerp(m0, nx.mark[0], e); m1 = lerp(m1, nx.mark[1], e); }
            if (al <= 0) return;
            g.save(); g.globalAlpha = al; g.fillStyle = BRAND; rr(6.2, base + m0, 3.4, m1 - m0, 1.7); g.fill(); g.restore();
          });
        }
        g.restore();
      }
      var d = donker(t);
      if (d > 0) { g.fillStyle = 'rgba(5,5,6,' + d + ')'; g.fillRect(0, 0, SW, SH); }
      g.fillStyle = '#000'; rr(140, 11, 110, 33, 17); g.fill();
      if (gepauzeerd && !stil) { g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.moveTo(191, 21); g.lineTo(201, 27.5); g.lineTo(191, 34); g.closePath(); g.fill(); }
    }

    // ---- één beeld. Een laag wordt alleen opnieuw getekend als er iets aan verandert (bij stilstand dus niet). ----
    var keyA = '', keyB = '';
    function teken(t) {
      var sy = scrollstand(t), p = clamp((t - T.open) / T.openDur), sl = slide(t);
      var kA = [prog(t, T.arrive - 0.3, 0.35), prog(t, T.arrive, 0.7), prog(t, T.tap, 0.12), p, Math.min(sy, HEAD + 4), klaar].join();
      if (kA !== keyA) { keyA = kA; g = gA; g.setTransform(PX, 0, 0, PX, 0, 0); schermOnder(t, sy); }
      mailvak.style.transform = 'translate3d(' + (SW * (1 - sl)) + 'px,0,0)';
      mailvak.style.visibility = (p > 0 && klaar) ? 'visible' : 'hidden';
      frame_.style.transform = 'translate3d(0,' + (HEAD - sy) + 'px,0)';
      var kB = [p, sy, donker(t), gepauzeerd, STOPS.map(function (s) { return stopAlpha(s, t); }).join('/'), t >= T.beat0 ? prog(t, (STOPS[2] || {}).f0 || 0, 1.0) : 0].join();
      if (kB !== keyB) { keyB = kB; g = gB; g.setTransform(PX, 0, 0, PX, 0, 0); g.clearRect(0, 0, SW, SH); schermBoven(t, sy); }
      g = gA;
    }

    // ---- afspelen: alleen als het in beeld is; stil bij "minder beweging"; tik op de telefoon zet hem stil ----
    var stil = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var loopt = false, zichtbaar = false, gepauzeerd = stil, vorige = 0, geladen = false;
    function stilbeeld() {   // stil op "Wat betekent dit?"; heeft de mail dat niet, dan op het eerste rustpunt
      var s = STOPS.find(function (x) { return x.i === 1; }) || STOPS[0];
      return s ? s.f0 + FADE + 0.5 : T.beat0 - 0.5; }
    function stap(nu) {
      if (!loopt) return;
      var dt = Math.min(0.05, (nu - vorige) / 1000); vorige = nu;
      tNu += dt; if (tNu >= T.total) tNu -= T.total;
      teken(tNu); requestAnimationFrame(stap);
    }
    function bijwerken() {
      var moet = zichtbaar && !gepauzeerd && !document.hidden && klaar;
      knop.setAttribute('aria-label', gepauzeerd ? 'Speel de animatie van de telefoon af' : 'Zet de animatie van de telefoon stil');
      knop.setAttribute('aria-pressed', gepauzeerd ? 'true' : 'false');
      if (moet && !loopt) { loopt = true; vorige = performance.now(); requestAnimationFrame(stap); }
      if (!moet) loopt = false;
      teken(tNu);
    }
    knop.addEventListener('click', function () { gepauzeerd = !gepauzeerd; stil = false; bijwerken(); });
    document.addEventListener('visibilitychange', bijwerken);
    var mails = [fig.getAttribute('data-mail')].concat((fig.getAttribute('data-mails') || '').split('|').filter(Boolean)),
        nr = 0, beste = null, gekozen = mails.length < 2;
    function laad() {
      if (geladen) return; geladen = true;
      frame_.addEventListener('load', function () {
        var d; try { d = frame_.contentDocument; } catch (e) { d = null; }
        if (!d || !d.body) { tNu = T.wake + 0.1; teken(tNu); return; }
        var fonts = d.fonts ? d.fonts.ready : Promise.resolve();
        fonts.then(function () { doc = d; lees(d);
          // Mist deze mail een rustpunt (geen vooruitblik, of alles te lang), probeer dan de mail van een ander
          // dossier van dezelfde gemeente (data-mails). Lukt geen enkele, dan de mail met de meeste rustpunten.
          if (!gekozen && STOPS.length < 4) {
            if (!beste || STOPS.length > beste.n) beste = { nr: nr, n: STOPS.length };
            var volgende = nr + 1 < mails.length ? nr + 1 : (beste.nr !== nr ? beste.nr : -1);
            if (volgende === beste.nr) gekozen = true;
            if (volgende >= 0) { klaar = false; nr = volgende; frame_.src = mails[nr]; return; }
          }
          gekozen = true;
          if (stil) tNu = stilbeeld();
          keyA = keyB = ''; teken(tNu); bijwerken(); });
      });
      frame_.src = mails[0];
    }
    maat();
    var wachtMaat = 0;
    window.addEventListener('resize', function () { clearTimeout(wachtMaat); wachtMaat = setTimeout(maat, 120); });
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) laad(); }); }, { rootMargin: '600px 0px' }).observe(fig);
      new IntersectionObserver(function (es) { es.forEach(function (e) { zichtbaar = e.isIntersecting; }); bijwerken(); }, { threshold: 0.2 }).observe(fig);
    } else { zichtbaar = true; laad(); }
    // lichte beweging bij het scrollen van de pagina: de telefoon komt iets verder uit het grijze vlak omhoog
    if (!stil) {
      var wachtScroll = false;
      var til = function () { wachtScroll = false; lift.style.transform = 'translate3d(0,' + (-clamp(window.scrollY * 0.05, 0, 18)).toFixed(1) + 'px,0)'; };
      window.addEventListener('scroll', function () { if (!wachtScroll) { wachtScroll = true; requestAnimationFrame(til); } }, { passive: true });
      til();
    }
    // om na te kijken: window.mailtelefoon.zet(8.5) toont het beeld op 8,5 seconde
    window.mailtelefoon = { zet: function (t) { gepauzeerd = true; loopt = false; tNu = t; keyA = keyB = ''; teken(t);
      return { stops: STOPS.map(function (s) { return { i: s.i, sy: s.sy, scroll: [+s.s0.toFixed(2), +s.s1.toFixed(2)], rust: [+s.f0.toFixed(2), +s.f1.toFixed(2)] }; }), totaal: +T.total.toFixed(2), room: Math.round(ROOM), schaal: +S.toFixed(3), px: +PX.toFixed(3) }; } };
  }
})();
