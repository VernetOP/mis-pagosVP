/* MisPagosVP — app de cada persona */
(function () {
  'use strict';
  var API = window.MP_API;
  var $ = function (id) { return document.getElementById(id); };
  var DATA = null, ROL = 0, COMP = {}, SEC = 'ses';   // COMP: comprobante elegido por rol · SEC: pestaña visible
  var TITULO = { PAC: 'Psicoterapia', SUP: 'Supervisiones', ESA: 'Formación' }, ORDEN = { PAC: 0, SUP: 1, ESA: 2 };

  // ---------- enlace personal (token)
  var TOKEN = '';
  try {
    var q = new URLSearchParams(location.search).get('t');
    if (q) { localStorage.setItem('mp_token', q); history.replaceState(null, '', location.pathname); }
    TOKEN = q || localStorage.getItem('mp_token') || '';
  } catch (e) { TOKEN = new URLSearchParams(location.search).get('t') || ''; }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(v, mon) {
    v = Math.round(Number(v || 0) * 100) / 100;
    var s = Math.abs(v).toLocaleString('es-AR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
    return (v < 0 ? '-' : '') + (mon === 'USD' ? 'USD ' : mon === 'EUR' ? '€ ' : '$') + s;
  }
  function num(v) { var t = String(v || '').trim(); if (/,/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); return Number(t) || 0; }
  function hoyISO() { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function ddmm(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7); }
  function menosUnDia(iso) { var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - 1); return ddmm(d.toISOString().slice(0, 10)); }

  function llamar(params) {
    return fetch(API + '?' + new URLSearchParams(params).toString(), { method: 'GET' }).then(function (r) { return r.json(); });
  }
  function enviar(body) {
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }

  // ---------- carga
  function cargar() {
    if (!TOKEN) {
      $('vista').innerHTML = '<div class="card"><h2>Enlace personal</h2><p>Para ver tu cuenta, abre el enlace personal que te envió el Lic. Vernet por WhatsApp. Después de abrirlo una vez, puedes instalar la app y entrar directamente.</p></div>';
      return;
    }
    llamar({ a: 'estado', t: TOKEN }).then(function (d) {
      if (!d.ok) throw new Error(d.error);
      d.roles.sort(function (a, b) { return ORDEN[a.sistema] - ORDEN[b.sistema]; });
      DATA = d; $('saludo').textContent = 'Hola, ' + d.nombre.split(' ')[0];
      if (ROL >= d.roles.length) ROL = 0;
      pintarTabs(); pintar();
    }).catch(function (e) {
      $('vista').innerHTML = '<div class="aviso bad">' + esc(e.message || e) + '</div><button class="btn sec" id="reint">Reintentar</button>';
      $('reint').onclick = function () { $('vista').innerHTML = '<div class="vacio">Cargando…</div>'; cargar(); };
    });
  }
  function pintarTabs() {
    var t = $('tabs');
    if (DATA.roles.length < 2) { t.classList.add('oculto'); return; }
    t.classList.remove('oculto');
    t.innerHTML = DATA.roles.map(function (r, i) {
      var et = TITULO[r.sistema];
      return '<button data-i="' + i + '" class="' + (i === ROL ? 'on' : '') + '">' + et + '</button>';
    }).join('');
    t.querySelectorAll('button').forEach(function (b) { b.onclick = function () { ROL = +b.getAttribute('data-i'); SEC = 'ses'; pintarTabs(); pintar(); window.scrollTo(0, 0); }; });
  }
  function pintar() {
    var r = DATA.roles[ROL];
    $('titulo').textContent = TITULO[r.sistema];
    var esEsa = r.sistema === 'ESA';
    $('logo').classList.toggle('oculto', !esEsa);
    document.querySelectorAll('.school,.brand').forEach(function (x) { x.classList.toggle('oculto', esEsa); });
    $('vista').innerHTML = (r.sistema === 'ESA' ? vistaEsa(r) : vistaSes(r)) + '<div class="small muted" style="text-align:center;margin:18px 0 6px">VernetO · versión 14</div>';
    enlazarFormulario(r);
    enlazarSecciones(r);
  }

  // ---------- Pacientes y supervisados
  function chipSes(s, mon) {
    var c = s.estado === 'Pagada' ? 'c-ok' : s.estado === 'Sin cargo' ? 'c-grey' : (s.estado === 'Pago parcial' || s.estado === 'A pagar') ? 'c-warn' : 'c-bad';
    return '<span class="chip ' + c + '">' + esc(s.estado) + '</span>' + (s.enRevision > 0 ? '<br><span class="small muted">en revisión ' + esc(fmt(s.enRevision, mon)) + '</span>' : '');
  }
  function vistaSes(r) {
    var mon = r.moneda, sup = r.sistema === 'SUP', palabra = sup ? 'supervisión' : 'sesión';
    var proximas = r.proximas || (r.proxima ? [r.proxima] : []);
    // ---- Pestañas
    var h = '<div class="secs">' +
      '<button data-s="ses" class="s-ses' + (SEC === 'ses' ? ' on' : '') + '">' + (sup ? 'Supervisiones' : 'Sesiones') + '</button>' +
      '<button data-s="pag" class="s-pag' + (SEC === 'pag' ? ' on' : '') + '">Pagos' + (r.impagas ? ' <span class="punto"></span>' : '') + '</button>' +
      '<button data-s="acu" class="s-acu' + (SEC === 'acu' ? ' on' : '') + '">Acuerdos</button></div>';

    // ---- 1. Sesiones
    h += '<div class="panel p-ses' + (SEC === 'ses' ? '' : ' oculto') + '" id="p-ses">';
    var deudas = r.sesiones.filter(function (s) { return s.resta > 0.005; });
    if (deudas.length) {
      var totDeuda = deudas.reduce(function (a, s) { return a + s.resta; }, 0);
      h += '<div class="deuda"><h2>' + (sup ? 'Supervisiones' : 'Sesiones') + ' en deuda</h2>' + deudas.map(function (s) {
        return '<div class="dl"><span>' + esc(s.fechaTxt) + (s.disponible <= 0.005 ? ' <span class="small">(pago en revisión)</span>' : '') + '</span><span>' + esc(fmt(s.resta, mon)) + '</span></div>';
      }).join('') + '<div class="dl tot"><span>Total adeudado</span><span>' + esc(fmt(totDeuda, mon)) + '</span></div>' +
        '<button class="btn-deuda" id="ir-pagar">Ir a pagar</button></div>';
    }
    if (!proximas.length) h += '<div class="prox"><h2>Tu próxima ' + palabra + '</h2><div class="hora">Todavía no hay una próxima ' + palabra + ' confirmada.</div></div>';
    proximas.forEach(function (p, i) {
      var larga = p.larga || r.proximaLarga || '';
      var pagada = p.resta <= 0.005 || p.valor === 0, enRev = !pagada && p.disponible <= 0.005;
      h += '<div class="prox"><h2>' + (i === 0 ? 'Tu próxima ' + palabra : 'Siguiente ' + palabra) + '</h2>' +
        '<div class="dia">' + esc(larga.charAt(0).toUpperCase() + larga.slice(1)) + '</div>' +
        '<div class="hora">' + esc(p.hora) + ' h <span style="font-weight:400;font-size:15px">(hora de Buenos Aires)</span></div>' +
        '<div class="dur">Duración: ' + (r.duracion || 50) + ' minutos</div>' +
        '<div class="det">' + (p.valor === 0 ? 'Sin cargo' : pagada ? 'Ya está paga. ¡Gracias!' : 'Valor ' + esc(p.valorTxt) + ' · abonar antes del ' + esc(menosUnDia(p.fecha)) + ' (24 horas antes)' +
          (p.pagado > 0 ? ' · falta ' + esc(p.restaTxt) : '')) + (enRev ? ' · pago en revisión' : '') + '</div>' +
        '<div class="lugar">' + (r.direccion ? 'Si vienes presencial, te espero en ' + esc(r.direccion) + '.<br>' : '') +
        'Recuerda confirmar si nos conectamos por Meet o Zoom.</div>';
      if (p.enlaces && p.enlaces.length) h += '<div class="enl">' + p.enlaces.map(function (e) {
        return '<a class="btn-enl" href="' + esc(e.url) + '" target="_blank" rel="noopener">Entrar por ' + esc(e.tipo) + '</a>';
      }).join('') + '</div>';
      h += pagada || enRev ? '<button class="btn-prox" disabled>' + (enRev ? 'Pago en revisión' : p.valor === 0 ? 'Sin cargo' : 'Ya está paga') + '</button>'
        : '<button class="btn-prox" data-pagar="' + esc(p.clave) + '">Pagar esta ' + palabra + '</button>';
      h += '</div>';
    });
    h += tarjetaAvisos(r) + '</div>';

    // ---- 2. Pagos
    h += '<div class="panel p-pag' + (SEC === 'pag' ? '' : ' oculto') + '" id="p-pag">';
    if (r.impagas) {
      h += '<div class="aviso bad"><b>Tienes ' + r.impagas + (r.impagas > 1 ? ' sesiones impagas' : ' sesión impaga') + '.</b>' +
        (r.sinRegistrar && r.sinRegistrar < r.impagas ? ' ' + r.sinRegistrar + ' sin pago registrado.' : (r.sinRegistrar ? ' Aún no registraste el pago.' : ' Ya registraste el pago: está en revisión.')) + '</div>';
    }
    if (r.enRevision > 0) h += '<div class="aviso warn">Pagos en revisión: <b>' + esc(r.enRevisionTxt) + '</b>. Se descuentan cuando el Lic. Vernet los confirma.</div>';
    h += '<div class="card"><h2>Estado de cuenta</h2><div class="big ' + (r.saldo > 0 ? 'bad' : 'ok') + '">' +
      (r.saldo > 0 ? 'Debes ' + esc(r.saldoTxt) : r.saldo < 0 ? 'A favor ' + esc(r.saldoTxt) : 'Al día') + '</div>' +
      (r.valorSesionTxt ? '<div class="muted" style="margin-top:6px">Valor de tu ' + palabra + ': <b>' + esc(r.valorSesionTxt) + '</b></div>' : '') +
      (r.credito > 0 ? '<div class="aviso ok" style="margin:10px 0 0">Tienes <b>' + esc(r.creditoTxt) + '</b> a favor. Puedes usarlo para pagar una ' + palabra + ': elige "Saldo a favor" como medio de pago.</div>' : '') + '</div>';
    h += '<div class="card"><h2>Últimas ' + (sup ? 'supervisiones' : 'sesiones') + '</h2>';
    if (!r.sesiones.length) h += '<div class="vacio">Todavía no hay ' + (sup ? 'supervisiones' : 'sesiones') + ' registradas.</div>';
    r.sesiones.slice().reverse().forEach(function (s) {
      h += '<div class="row"><div class="l"><b>' + esc(s.fechaTxt) + '</b><br><span class="small muted">' + esc(s.asistencia) + '</span>' +
        (s.estado === 'Pago parcial' ? '<br><span class="small">Pagaste ' + esc(s.pagadoTxt) + ' · falta ' + esc(s.restaTxt) + '</span>' : '') +
        '</div><div class="r">' + (s.valor ? esc(s.valorTxt) : '—') + '<br>' + chipSes(s, mon) + '</div></div>';
    });
    h += '</div>';
    h += datosPago(r);
    var pagables = r.sesiones.filter(function (s) { return s.disponible > 0.005; }), vistas = {};
    pagables.forEach(function (s) { vistas[s.clave] = 1; });
    proximas.forEach(function (s) { if (s.disponible > 0.005 && !vistas[s.clave]) { s.futura = true; pagables.push(s); vistas[s.clave] = 1; } });
    h += '<div class="card" id="form"><h2>Registrar un pago</h2>';
    h += '<div class="small muted">' + (pagables.length ? 'Marca la ' + palabra + ' o las que pagas. Si pagas solo una parte, cambia el monto. Si pagas de más, la diferencia queda a tu favor.' :
      'No tienes ' + (sup ? 'supervisiones' : 'sesiones') + ' pendientes de pago.') + ' También puedes hacer un <b>pago a cuenta</b> (adelanto o abono): queda como saldo a favor y se descuenta de tus próximas ' + (sup ? 'supervisiones' : 'sesiones') + '.</div><div style="margin-top:6px">';
    pagables.forEach(function (s, i) {
      h += '<div class="pick"><input type="checkbox" id="ck-' + i + '" data-clave="' + esc(s.clave) + '" data-max="' + s.disponible + '"' + (s.futura ? '' : ' checked') + '>' +
        '<label class="d" for="ck-' + i + '" style="margin:0;color:var(--ink);font-weight:500"><b>' + esc(ddmm(s.fecha)) + '</b>' + (s.futura ? ' (próxima)' : '') + '<br><span class="small muted">' +
        (s.enRevision > 0 || s.pagado > 0 ? 'Pendiente ' + esc(fmt(s.disponible, mon)) : esc(s.valorTxt)) + '</span></label>' +
        '<div class="m"><input id="mt-' + i + '" inputmode="decimal" aria-label="Monto para el ' + esc(ddmm(s.fecha)) + '" value="' + String(s.disponible).replace('.', ',') + '"></div></div>';
    });
    h += '<div class="pick"><input type="checkbox" id="ck-cta"' + (pagables.length ? '' : ' checked') + '>' +
      '<label class="d" for="ck-cta" style="margin:0;color:var(--ink);font-weight:500"><b>Pago a cuenta</b><br><span class="small muted">Adelanto o abono · queda a tu favor</span></label>' +
      '<div class="m"><input id="mt-cta" inputmode="decimal" aria-label="Monto del pago a cuenta" placeholder="Monto"></div></div>';
    h += '</div><div class="total"><span>Total</span><span id="total"></span></div>' + camposComunes(r);
    h += '</div>' + revisiones(r) + '</div>';

    // ---- 3. Acuerdos
    h += '<div class="panel p-acu' + (SEC === 'acu' ? '' : ' oculto') + '" id="p-acu">' + terminosAbiertos(r) + '</div>';
    return h;
  }
  function terminosAbiertos(r) {
    if (!r.terminos) return '<div class="card"><div class="vacio">Sin acuerdos cargados.</div></div>';
    var t = r.terminos.split(/\n+/).map(function (p) { return p.replace(/^\s*[-•]\s*/, '').trim(); }).filter(Boolean)
      .map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('');
    return '<div class="card"><h2>Términos y condiciones (encuadre)</h2><ul class="vinetas">' + t + '</ul></div>';
  }
  function mostrarSeccion(sec) {
    SEC = sec;
    document.querySelectorAll('.secs button, .btn-avisos').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-s') === sec); });
    if (sec === 'avi' && DATA) { var rr = DATA.roles[ROL]; if (rr.contenidos) marcarLeidos(rr.contenidos.avisos || []); }
    ['ses', 'pag', 'acu', 'cur', 'cro', 'avi'].forEach(function (k) { var p = $('p-' + k); if (p) p.classList.toggle('oculto', k !== sec); });
  }
  function enlazarSecciones(r) {
    document.querySelectorAll('.secs button, .btn-avisos').forEach(function (b) { b.onclick = function () { mostrarSeccion(b.getAttribute('data-s')); window.scrollTo(0, 0); }; });
    if ($('ir-pagar')) $('ir-pagar').onclick = function () { mostrarSeccion('pag'); $('form').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    document.querySelectorAll('[data-irpagar]').forEach(function (b) { b.onclick = function () { mostrarSeccion('pag'); $('form').scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
    document.querySelectorAll('[data-pagar]').forEach(function (b) {
      b.onclick = function () {
        var cl = b.getAttribute('data-pagar');
        mostrarSeccion('pag');
        document.querySelectorAll('.pick input[type=checkbox]').forEach(function (c) { c.checked = c.getAttribute('data-clave') === cl; });
        var c0 = document.querySelector('.pick input[type=checkbox]'); if (c0) c0.dispatchEvent(new Event('change'));
        $('form').scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    });
  }

  // ---------- Estudiantes ESA.VP
  function vistaEsa(r) {
    var cn = r.contenidos || {}, tiene = (cn.estudiante && cn.estudiante !== 'No') || (cn.avanzado && cn.avanzado !== 'No');
    if (!tiene) return pagosEsa(r, true);
    var avisos = cn.avisos || [], leidos = avisosLeidos(), nuevos = avisos.filter(function (a) { return leidos.indexOf(a.id) < 0; }).length;
    if (!PRIMERA_ESA) { PRIMERA_ESA = true; if (nuevos) SEC = 'avi'; }
    if (['cur', 'cro', 'pag', 'avi'].indexOf(SEC) < 0 || (SEC === 'avi' && !avisos.length)) SEC = 'cur';
    var deuda = r.deudas.length || r.matricula > 0 || r.saldoAnterior > 0;
    var h = '';
    if (avisos.length) h += '<button data-s="avi" class="btn-avisos' + (SEC === 'avi' ? ' on' : '') + '">Avisos' +
      (nuevos ? ' <span class="nuevos" id="avi-n">' + nuevos + (nuevos > 1 ? ' nuevos' : ' nuevo') + '</span>' : '') + '</button>';
    h += '<div class="secs">' +
      '<button data-s="cur" class="s-ses' + (SEC === 'cur' ? ' on' : '') + '">Curso</button>' +
      '<button data-s="cro" class="s-acu' + (SEC === 'cro' ? ' on' : '') + '">Cronograma</button>' +
      '<button data-s="pag" class="s-pag' + (SEC === 'pag' ? ' on' : '') + '">Pagos' + (deuda ? ' <span class="punto"></span>' : '') + '</button></div>';
    h += '<div class="panel p-ses' + (SEC === 'cur' ? '' : ' oculto') + '" id="p-cur">' +
      (cn.curso.length ? cn.curso.map(recuadro).join('') : '<div class="card"><div class="vacio">Pronto encontrarás aquí la información de tu curso.</div></div>') + tarjetaAvisos(r) + '</div>';
    h += '<div class="panel p-acu' + (SEC === 'cro' ? '' : ' oculto') + '" id="p-cro">' +
      (cn.cronograma.length ? cn.cronograma.map(function (c) { return c.clases || c.error ? cronograma(c) : recuadro(c); }).join('') : '<div class="card"><div class="vacio">El cronograma estará disponible pronto.</div></div>') + '</div>';
    if (avisos.length) h += '<div class="panel p-avi' + (SEC === 'avi' ? '' : ' oculto') + '" id="p-avi">' + avisos.map(function (a) {
      return '<div class="card aviso-c">' + '<div class="small muted">' + esc(a.fechaTxt) + '</div><h3>' + esc(a.titulo) + '</h3>' +
        (a.imagen ? '<img src="' + esc(a.imagen) + '" alt="" loading="lazy" onerror="this.remove()">' : '') +
        (a.texto ? '<div class="terms">' + a.texto.split(/\n+/).map(function (p) { return '<p>' + enlazar(p) + '</p>'; }).join('') + '</div>' : '') + '</div>';
    }).join('') + '</div>';
    if (SEC === 'avi') marcarLeidos(avisos);
    h += '<div class="panel p-pag' + (SEC === 'pag' ? '' : ' oculto') + '" id="p-pag">' + pagosEsa(r, false) + '</div>';
    return h;
  }
  function recuadro(c) {
    var h = '<div class="card">' + (c.titulo ? '<h2>' + esc(c.titulo) + '</h2>' : '');
    if (c.texto) h += '<div class="terms">' + c.texto.split(/\n+/).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>';
    if (c.copiar) h += c.copiar.split(/\s*·\s*/).map(function (parte) {
      var i = parte.indexOf(':'), et = i > 0 ? parte.slice(0, i).trim() : '', val = i > 0 ? parte.slice(i + 1).trim() : parte.trim();
      return '<div class="cuenta"><div style="min-width:0">' + (et ? '<span class="small muted">' + esc(et) + '</span><br>' : '') + '<span class="num">' + esc(val) + '</span></div>' +
        '<button class="copiar" data-copiar="' + esc(val) + '">Copiar</button></div>';
    }).join('');
    if (/^#pagar/.test(c.enlace || '')) h += '<button class="btn" data-irpagar="1" style="display:block;width:100%">' + esc(c.boton || 'Registrar un pago') + '</button>';
    else if (c.enlace) h += '<a class="btn" style="display:block;text-align:center;text-decoration:none" href="' + esc(c.enlace) + '" target="_blank" rel="noopener">' + esc(c.boton || 'Abrir') + '</a>';
    else if (c.boton) h += '<div class="small muted" style="margin-top:10px">' + esc(c.boton) + ': enlace disponible pronto.</div>';
    return h + '</div>';
  }
  var PRIMERA_ESA = false;
  function avisosLeidos() { try { return JSON.parse(localStorage.getItem('mp_leidos_' + TOKEN) || '[]'); } catch (e) { return []; } }
  function marcarLeidos(avisos) {
    try { localStorage.setItem('mp_leidos_' + TOKEN, JSON.stringify(avisos.map(function (a) { return a.id; }))); } catch (e) { }
    setTimeout(function () { var n = $('avi-n'); if (n) n.remove(); }, 1500);
  }
  function enlazar(t) { return esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }
  var DIAS_C = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  function fechaCorta(c) {
    if (!c.fecha) return esc(c.fechaTxt);
    var d = new Date(c.fecha + 'T12:00:00'); return DIAS_C[d.getDay()] + ' ' + c.fecha.slice(8, 10) + '/' + c.fecha.slice(5, 7);
  }
  function detalleClase(c) {
    var g = function (tit, l) { return l && l.length ? '<div class="cl-g"><span class="small muted">' + tit + '</span><div>' + l.map(function (x) { return '<a class="lnk" href="' + esc(x.u) + '" target="_blank" rel="noopener">' + esc(x.t || tit) + '</a>'; }).join('') + '</div></div>' : ''; };
    var h = '<div class="cl-mat">' + esc(c.materia || '') + '</div>' + (c.datos || []).map(function (d) { return '<div class="small"><span class="muted">' + esc(d.k) + ':</span> ' + esc(d.v) + '</div>'; }).join('') + g('Lecturas', c.lecturas) + g('Material', c.material) + g('Crónica', c.cronica) + g('Video', c.video) + g('Docentes', c.plan);
    if (!(c.lecturas.length || c.material.length || c.cronica.length || c.video.length || (c.plan || []).length) && !c.feriado) h += '<div class="small muted">Todavía no hay materiales cargados para esta clase.</div>';
    return h;
  }
  function cronograma(card) {
    var h = '<div class="card"><h2>' + esc(card.titulo || 'Cronograma') + '</h2>';
    if (card.texto) h += '<div class="terms">' + card.texto.split(/\n+/).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>';
    if (card.error || !card.clases) return h + '<div class="aviso warn">' + esc(card.error || 'No se pudo leer el cronograma.') + '</div></div>';
    var cl = card.clases.clases || [], hoy = hoyISO(), dadas = cl.filter(function (c) { return c.fecha && c.fecha < hoy && !c.feriado; });
    var ult = dadas[dadas.length - 1], prox = cl.filter(function (c) { return c.fecha && c.fecha >= hoy && !c.feriado; })[0];
    h += '</div>';
    var destacado = function (tit, c, cls) { return c ? '<div class="card cl-dest ' + cls + '"><h2>' + tit + ' · ' + fechaCorta(c) + (c.fecha === hoy ? ' · hoy' : '') + '</h2>' + detalleClase(c) + '</div>' : ''; };
    h += destacado('Próxima clase', prox, 'cl-prox') + destacado('Última clase', ult, 'cl-ult');
    h += '<div class="card cl-lista"><h2>Cronograma completo</h2>' + cl.map(function (c, i) {
      var past = c.fecha && c.fecha < hoy, est = c.feriado ? ' cl-fer' : (c === prox ? ' cl-sig' : (past ? ' cl-pas' : ''));
      return '<div class="cl-item' + (i % 2 ? ' cl-alt' : '') + est + '"><button class="cl-row" data-cl="' + i + '"><span class="cl-f">' + fechaCorta(c) + '</span><span class="cl-t">' +
        esc(c.feriado && !c.materia ? 'Feriado' : (c.materia || '')) + '</span><span class="cl-x">▾</span></button><div class="cl-det oculto" id="cl-' + i + '">' + detalleClase(c) + '</div></div>';
    }).join('') + ((card.clases.notas || []).length ? '<div class="small muted" style="margin-top:10px">' + card.clases.notas.map(esc).join('<br>') + '</div>' : '') + '</div>';
    if (card.enlace && card.boton) h += '<a class="btn" href="' + esc(card.enlace) + '" target="_blank" rel="noopener">' + esc(card.boton) + '</a>';
    return h;
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.cl-row'); if (!b) return;
    var d = $('cl-' + b.getAttribute('data-cl')); if (d) { d.classList.toggle('oculto'); b.classList.toggle('abierto'); }
  });
  function pagosEsa(r, conAvisos) {
    var h = conAvisos ? tarjetaAvisos(r) : '', c = r.mesActual, mon = r.moneda;
    if (r.deudas.length || r.matricula > 0 || r.saldoAnterior > 0) h += '<div class="aviso bad"><b>Tienes cuotas o cargos adeudados.</b> Revisa el detalle abajo.</div>';
    if (r.enRevision > 0) h += '<div class="aviso warn">Pagos en revisión: <b>' + esc(r.enRevisionTxt) + '</b>. Se descuentan cuando la escuela los confirma.</div>';
    if (c) {
      var cl = c.estado === 'PAGADO' ? 'c-ok' : c.estado === 'PENDIENTE' ? 'c-warn' : c.estado === 'SIN CUOTA' ? 'c-grey' : 'c-bad';
      h += '<div class="card"><h2>Mes en curso · ' + esc(c.mes) + '</h2><div class="row"><div class="l"><div class="big">' + esc(c.valorHoyTxt) + '</div>' +
        '<div class="small muted">Valor del mes a la fecha de hoy</div></div><div class="r"><span class="chip ' + cl + '">' + esc(c.estado) + '</span></div></div>';
      if (c.pagado > 0 && c.estado !== 'PAGADO') h += '<div class="small">Pagaste ' + esc(c.pagadoTxt) + ' · falta ' + esc(c.restaTxt) + '</div>';
      if (c.beneficio !== c.lista && c.estado !== 'SIN CUOTA') {
        h += c.enPlazo
          ? '<div class="promo">Valor con beneficio hasta el ' + esc(c.limiteTxt) + '. Desde el día siguiente: ' + esc(c.listaTxt) + '.</div>'
          : '<div class="promo">Valor promocional <s>' + esc(c.beneficioTxt) + '</s> válido hasta el ' + esc(c.limiteTxt) + ' (ya concluyó). Si tu transferencia fue hasta esa fecha, se toma ese valor.</div>';
      }
      h += '</div>';
    }
    h += '<div class="card"><h2>Meses en deuda</h2>';
    if (!r.deudas.length && !(r.matricula > 0) && !(r.saldoAnterior > 0)) h += '<div class="vacio" style="padding:14px">No tienes meses adeudados.</div>';
    r.deudas.forEach(function (x) {
      h += '<div class="row"><div class="l"><b>' + esc(x.mes) + '</b><br><span class="small muted">' + (x.fraccion ? 'Fracción pendiente (pagaste ' + esc(x.pagadoTxt) + ' de ' + esc(x.valorTxt) + ')' : 'Cuota completa') + '</span>' +
        (x.enRevision > 0 ? '<br><span class="small">En revisión ' + esc(fmt(x.enRevision, mon)) + '</span>' : '') + '</div><div class="r"><b>' + esc(x.restaTxt) + '</b></div></div>';
    });
    if (r.matricula > 0) h += '<div class="row"><div class="l"><b>Matrícula</b></div><div class="r"><b>' + esc(r.matriculaTxt) + '</b></div></div>';
    if (r.saldoAnterior > 0) h += '<div class="row"><div class="l"><b>Saldo anterior</b></div><div class="r"><b>' + esc(r.saldoAnteriorTxt) + '</b></div></div>';
    h += '<div class="total"><span>Monto a pagar hoy</span><span' + (r.montoAPagar > 0 ? ' style="color:var(--bad)"' : '') + '>' + esc(r.montoAPagarTxt) + '</span></div></div>';
    h += datosPago(r);
    h += '<div class="card" id="form"><h2>Registrar un pago</h2>';
    if (!r.opciones.length) h += '<div class="vacio">No tienes cuotas pendientes de pago.</div>';
    else {
      h += '<label for="f-mes">Mes que pagas</label><select id="f-mes">' + r.opciones.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('') + '</select>' +
        '<label for="f-monto">Monto (' + esc(mon) + ')</label><input id="f-monto" inputmode="decimal">' +
        '<div class="small muted" style="margin-top:6px">El valor se calcula con la fecha de la transferencia, no con la fecha en que registras el pago.</div>' + camposComunes(r);
    }
    h += '</div>' + terminos(r) + revisiones(r);
    return h;
  }

  // ---------- datos para pagar
  function datosPago(r) {
    if (!r.datosPago || !r.datosPago.length) return '';
    return '<div class="card"><h2>Datos para pagar</h2>' + r.datosPago.map(function (d, i) {
      return '<div class="cuenta"><div style="min-width:0"><b>' + esc(d.medio || d.banco) + '</b>' + (d.moneda && !/^todas$/i.test(d.moneda) ? ' <span class="small muted">' + esc(d.moneda) + '</span>' : '') +
        (d.titular ? '<br><span class="small muted">Titular: ' + esc(d.titular) + '</span>' : '') + (d.banco && d.medio ? '<br><span class="small muted">' + esc(d.banco) + '</span>' : '') +
        (d.cuenta ? '<br><span class="num">' + esc(d.cuenta) + '</span>' : '') + (d.nota ? '<br><span class="small muted">' + esc(d.nota) + '</span>' : '') + '</div>' +
        (d.cuenta ? '<button class="copiar" data-copiar="' + esc(d.cuenta) + '">Copiar</button>' : '') + '</div>';
    }).join('') + '</div>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-copiar]'); if (!b) return;
    var t = b.getAttribute('data-copiar');
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { b.textContent = 'Copiado'; setTimeout(function () { b.textContent = 'Copiar'; }, 1500); })
      .catch(function () { window.prompt('Copia el dato:', t); });
  });

  // ---------- recordatorios (Firebase Cloud Messaging)
  var esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  var instalada = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function avisosActivos() { try { return localStorage.getItem('mp_avisos') === TOKEN && Notification.permission === 'granted'; } catch (e) { return false; } }
  function tarjetaAvisos(r) {
    if (avisosActivos()) return '<div class="small muted" id="avisos" style="margin:4px 0 14px">Recordatorios activados en este celular. <a href="#" id="probar">Enviar un aviso de prueba</a><div id="avisos-msj"></div></div>';
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      if (esIOS && !instalada) return '<div class="aviso warn">Para recibir recordatorios en iPhone, primero instala la app: toca <b>Compartir</b> y luego <b>Agregar a inicio</b>. Después ábrela desde el ícono.</div>';
      return '';
    }
    if (Notification.permission === 'denied') return '<div class="aviso warn">Los recordatorios están bloqueados en este celular. Puedes habilitarlos en los ajustes de notificaciones del navegador o de la app.</div>';
    return '<div class="card" id="avisos"><h2>Recordatorios</h2><div class="small muted">' + (r.sistema === 'ESA' ? 'Recibe un aviso el día 1 de cada mes y el último día del beneficio por pago puntual' : 'Recibe un aviso el día anterior a cada sesión') + ', aunque la app esté cerrada.</div>' +
      '<button class="btn" id="activar">Activar recordatorios</button><div id="avisos-msj"></div></div>';
  }
  function cargarScript(src) { return new Promise(function (ok, mal) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { mal(new Error('No se pudo cargar ' + src)); }; document.head.appendChild(s); }); }
  // Con la app abierta, Firebase no muestra el aviso solo: lo mostramos nosotros.
  var ESCUCHA = false;
  function prepararMensajeria() {
    return cargarScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
      .then(function () { return cargarScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js'); })
      .then(function () { return navigator.serviceWorker.register('sw.js'); })
      .then(function () { return navigator.serviceWorker.ready; })
      .then(function (reg) {
        if (!firebase.apps.length) firebase.initializeApp(window.MP_FB);
        var m = firebase.messaging();
        if (!ESCUCHA) {
          ESCUCHA = true;
          m.onMessage(function (p) {
            var n = (p && p.notification) || {};
            reg.showNotification(n.title || 'VernetO', { body: n.body || '', icon: 'icon-192.png', badge: 'icon-192.png' });
          });
        }
        return { reg: reg, m: m };
      });
  }
  function escucharSiActivos() { if (avisosActivos()) prepararMensajeria().catch(function () { }); }
  function probarAviso(e) {
    if (e) e.preventDefault();
    var msj = function (t, c) { $('avisos-msj').innerHTML = '<div class="aviso ' + (c || 'warn') + '" style="margin-top:8px">' + t + '</div>'; };
    msj('Enviando…');
    prepararMensajeria().then(function () { return llamar({ a: 'probar', t: TOKEN }); }).then(function (d) {
      if (!d.ok) throw new Error(d.error);
      msj(esc(d.mensaje) + (d.enviados ? ' Si en unos segundos no aparece, revisa en los ajustes del celular que las notificaciones de VernetO (o de Chrome) estén permitidas.' : ''), d.enviados ? 'ok' : 'warn');
    }).catch(function (er) { msj(esc(er.message || er), 'bad'); });
  }
  function activarAvisos() {
    var caja = $('avisos'), msj = function (t, c) { $('avisos-msj').innerHTML = '<div class="aviso ' + (c || 'warn') + '" style="margin-top:12px">' + t + '</div>'; };
    caja.classList.add('cargando'); msj('Activando…');
    Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') throw new Error('No se aceptaron las notificaciones. Si cambias de idea, vuelve a tocar el botón.');
      return prepararMensajeria().then(function (x) {
        return x.m.getToken({ vapidKey: window.MP_VAPID, serviceWorkerRegistration: x.reg });
      });
    }).then(function (fcm) {
      if (!fcm) throw new Error('El celular no entregó el permiso. Inténtalo de nuevo.');
      return enviar({ a: 'suscribir', t: TOKEN, fcm: fcm, plataforma: (esIOS ? 'iPhone' : /android/i.test(navigator.userAgent) ? 'Android' : 'Computadora') + (instalada ? ' (app instalada)' : '') });
    }).then(function (d) {
      caja.classList.remove('cargando');
      if (!d.ok) throw new Error(d.error);
      try { localStorage.setItem('mp_avisos', TOKEN); } catch (e) { }
      caja.innerHTML = '<div class="aviso ok" style="margin:0"><b>Recordatorios activados.</b> ' + (d.prueba ? 'Te enviamos un aviso de prueba.' : esc(d.mensaje)) + '</div>';
    }).catch(function (e) { caja.classList.remove('cargando'); msj(esc(e.message || e), 'bad'); });
  }

  // ---------- partes comunes
  function camposComunes(r) {
    return '<div class="two"><div><label for="f-fecha">Fecha de la transferencia</label><input type="date" id="f-fecha" max="' + hoyISO() + '" value="' + hoyISO() + '"></div>' +
      '<div><label for="f-medio">Medio de pago</label><select id="f-medio">' + r.medios.filter(function (m) { return !/saldo a favor/i.test(m); }).concat(r.medios.filter(function (m) { return /saldo a favor/i.test(m); })).map(function (m) { return '<option>' + esc(m) + '</option>'; }).join('') + '</select></div></div>' +
      '<label for="f-oper">N.º de operación</label><input id="f-oper" autocomplete="off" placeholder="Figura en el comprobante">' +
      '<label for="f-comp">Comprobante (foto o PDF)</label><input type="file" id="f-comp" accept="image/*,application/pdf">' +
      '<div class="small muted" id="f-comp-ayuda" style="margin-top:6px">Con el número de operación el comprobante es opcional, pero ayuda a confirmar más rápido. Sin número, es obligatorio.</div>' +
      '<label for="f-tit">Titular de la cuenta (solo si no eres tú)</label><input id="f-tit" autocomplete="off">' +
      '<label for="f-com">Comentario (opcional)</label><input id="f-com" autocomplete="off">' +
      '<button class="btn" id="f-enviar">Registrar pago</button><div id="f-msj"></div>';
  }
  function terminos(r) {
    if (!r.terminos) return '';
    var t = esc(r.terminos).split(/\n+/).map(function (p) { return '<p>' + p + '</p>'; }).join('');
    return '<div class="card"><details><summary>' + (r.sistema === 'ESA' ? 'Condiciones de pago' : 'Términos y condiciones (encuadre)') + '</summary><div class="terms">' + t + '</div></details></div>';
  }
  function revisiones(r) {
    if (!r.revisiones.length) return '';
    return '<div class="card"><h2>Pagos en revisión</h2>' + r.revisiones.map(function (x) {
      return '<div class="row"><div class="l">' + esc(x.detalle) + '<br><span class="small muted">Transferencia del ' + esc(x.fecha) + '</span></div><div class="r">' + esc(x.montoTxt) + '<br><span class="chip c-warn">En revisión</span></div></div>';
    }).join('') + '</div>';
  }
  function aviso(txt, tipo) { $('f-msj').innerHTML = txt ? '<div class="aviso ' + (tipo || 'ok') + '" style="margin-top:12px">' + txt + '</div>' : ''; }

  function enlazarFormulario(r) {
    if ($('activar')) $('activar').onclick = activarAvisos;
    if ($('probar')) $('probar').onclick = probarAviso;
    escucharSiActivos();
    if (!$('f-enviar')) return;
    var sistema = r.sistema;
    if (sistema === 'ESA') {
      var poner = function () { var v = r.sugerido[$('f-mes').value]; $('f-monto').value = v ? String(v).replace('.', ',') : ''; };
      $('f-mes').onchange = poner; poner();
    } else {
      var sumar = function () {
        var t = 0;
        document.querySelectorAll('.pick input[type=checkbox]').forEach(function (c) { if (c.checked) t += num($(c.id.replace('ck-', 'mt-')).value); });
        $('total').textContent = fmt(t, r.moneda);
      };
      document.querySelectorAll('.pick input').forEach(function (x) { x.oninput = sumar; x.onchange = sumar; });
      $('mt-cta').oninput = function () { $('ck-cta').checked = num(this.value) > 0; sumar(); };
      sumar();
    }
    $('f-comp').onchange = function () {
      var f = this.files[0]; COMP[ROL] = null;
      if (!f) return;
      prepararArchivo(f).then(function (c) { COMP[ROL] = c; }).catch(function (e) { $('f-comp').value = ''; aviso(esc(e.message), 'bad'); });
    };
    $('f-enviar').onclick = function () { registrar(r, false); };
  }

  function prepararArchivo(f) {
    return new Promise(function (ok, mal) {
      if (f.type === 'application/pdf') {
        if (f.size > 8 * 1024 * 1024) return mal(new Error('El PDF es muy pesado (máximo 8 MB).'));
        var fr = new FileReader(); fr.onload = function () { ok({ tipo: f.type, datos: String(fr.result).split(',')[1] }); }; fr.onerror = function () { mal(new Error('No se pudo leer el archivo.')); };
        return fr.readAsDataURL(f);
      }
      if (!/^image\//.test(f.type)) return mal(new Error('El comprobante debe ser una foto o un PDF.'));
      var img = new Image(), url = URL.createObjectURL(f);
      img.onload = function () {
        var max = 1600, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
        ok({ tipo: 'image/jpeg', datos: cv.toDataURL('image/jpeg', 0.82).split(',')[1] });
      };
      img.onerror = function () { URL.revokeObjectURL(url); mal(new Error('No se pudo abrir la imagen. Prueba con una captura de pantalla o un PDF.')); };
      img.src = url;
    });
  }

  function registrar(r, aceptarIncompleto) {
    var o = { a: 'declarar', t: TOKEN, sistema: r.sistema, fecha: $('f-fecha').value, medio: $('f-medio').value, oper: $('f-oper').value.trim(),
      titular: $('f-tit').value.trim(), comentario: $('f-com').value.trim(), comprobante: COMP[ROL] || null, aceptarIncompleto: aceptarIncompleto };
    if (!o.fecha) return aviso('Indica la fecha de la transferencia.', 'bad');
    if (o.fecha > hoyISO()) return aviso('La fecha de la transferencia no puede ser posterior a hoy.', 'bad');
    if (!/efectivo|saldo a favor/i.test(o.medio) && !o.oper && !o.comprobante) return aviso('Indica el número de operación o adjunta el comprobante.', 'bad');
    if ($('f-comp').files.length && !o.comprobante) return aviso('El comprobante todavía se está preparando. Espera un segundo y vuelve a tocar el botón.', 'warn');
    if (r.sistema === 'ESA') {
      o.mes = $('f-mes').value; o.monto = num($('f-monto').value);
      if (!(o.monto > 0)) return aviso('Indica el monto.', 'bad');
    } else {
      o.items = [];
      var err = '';
      var cta = $('ck-cta');
      if (cta && cta.checked) {
        o.aCuenta = num($('mt-cta').value);
        if (!(o.aCuenta > 0)) return aviso('Indica el monto del pago a cuenta.', 'bad');
        if (/saldo a favor/i.test(o.medio)) return aviso('El saldo a favor se usa para pagar sesiones, no para un pago a cuenta.', 'bad');
      }
      document.querySelectorAll('.pick input[type=checkbox]').forEach(function (c) {
        if (!c.checked || c.id === 'ck-cta') return;
        var m = num($(c.id.replace('ck-', 'mt-')).value), max = Number(c.getAttribute('data-max'));
        if (!(m > 0)) err = 'Indica el monto de cada sesión marcada.';
        else if (/saldo a favor/i.test(o.medio) && m > max + 0.01) err = 'Con saldo a favor solo puedes cubrir lo pendiente de cada sesión (' + fmt(max, r.moneda) + ').';
        o.items.push({ clave: c.getAttribute('data-clave'), monto: m });
      });
      if (!o.items.length && !(o.aCuenta > 0)) return aviso('Marca la sesión o las sesiones que pagas, o indica un pago a cuenta.', 'bad');
      if (err) return aviso(esc(err), 'bad');
    }
    var form = $('form'); form.classList.add('cargando'); aviso('Enviando…', 'warn');
    enviar(o).then(function (d) {
      form.classList.remove('cargando');
      if (!d.ok) throw new Error(d.error);
      if (d.incompleto) {
        aviso('<b>' + esc(d.mensaje) + '</b><button class="btn warn" id="f-igual">Registrar igual (quedará incompleto)</button><button class="btn sec" id="f-corr">Corregir el monto</button>', 'warn');
        $('f-igual').onclick = function () { registrar(r, true); };
        $('f-corr').onclick = function () { $('f-monto').value = String(Math.round((o.monto + d.faltante) * 100) / 100).replace('.', ','); aviso(''); $('f-monto').focus(); };
        return;
      }
      COMP[ROL] = null;
      var msg = d.mensaje;
      cargarTrasRegistro(msg);
    }).catch(function (e) { form.classList.remove('cargando'); aviso(esc(e.message || 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.'), 'bad'); });
  }
  function cargarTrasRegistro(msg) {
    llamar({ a: 'estado', t: TOKEN }).then(function (d) {
      if (d.ok) { DATA = d; pintar(); }
      var v = $('vista'); v.insertAdjacentHTML('afterbegin', '<div class="aviso ok"><b>Listo.</b> ' + esc(msg) + '</div>'); window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ---------- instalar
  var evInst = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); evInst = e; if (TOKEN) $('instalar').classList.remove('oculto'); });
  $('instalar').onclick = function () { if (!evInst) return; evInst.prompt(); evInst.userChoice.then(function () { evInst = null; $('instalar').classList.add('oculto'); }); };
  window.addEventListener('appinstalled', function () { $('instalar').classList.add('oculto'); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () { });

  cargar();
})();
