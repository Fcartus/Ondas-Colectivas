/* ondas-comun.js · lo que comparten la pantalla (pantalla.html) y el teléfono (index.html).
 *
 * Temas MQTT (JSON), todos bajo tacto/<sala>/<dev>/:
 *   status   retained  {online, name, app:'ondas'}            con "último testamento" (online:false si se cae)
 *   estado             {on, sonido, modo, p:{tono, forma, …}}  teléfono → pantalla, ~15 por segundo mientras cambia
 *   pulso              {}                                     teléfono → pantalla: tocar la cuerda (acento)
 *   linea              {b:[8 bandas 0–99], n:nivel 0–99}      pantalla → teléfono, ~12 por segundo: cómo suena tu loop
 *
 * Cada persona es un PAR DE LÍNEAS: la señal y su eco (la misma cuerda un instante antes, como el modo ÓRBITA de
 * "Ondas visibles"). La forma de la cuerda sale del espectro real de su sonido: los graves la mecen entera,
 * los agudos le ponen ondulaciones finas. El color va de verde (quieta) a blanco, rosado y rojo (intensa).
 */
(function (g) {
  'use strict';
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const pct = v => Math.round(v * 100) + '%';
  const hz = v => (v >= 1000 ? (v / 1000).toFixed(1) + ' kHz' : Math.round(v) + ' Hz');

  // ---------- parámetros del sonido de cada persona ----------
  const PARAMS = {
    tono: { nombre: 'tono', min: -12, max: 12, def: 0, fmt: v => (v > 0 ? '+' : '') + v.toFixed(1) + ' st' },
    forma: { nombre: 'forma', min: 0, max: 1, def: 0, fmt: pct },
    corte: { nombre: 'filtro', min: 0, max: 1, def: 0.85, fmt: v => hz(80 * Math.pow(225, v)) },
    reso: { nombre: 'resonancia', min: 0, max: 1, def: 0.1, fmt: pct },
    drive: { nombre: 'saturación', min: 0, max: 1, def: 0.05, fmt: pct },
    bits: { nombre: 'bits', min: 0, max: 1, def: 0, fmt: v => (v < 0.02 ? 'limpio' : Math.round(16 - v * 13) + ' bits') },
    rev: { nombre: 'reverb', min: 0, max: 1, def: 0.2, fmt: pct },
    eco: { nombre: 'eco', min: 0, max: 1, def: 0.1, fmt: pct },
    pan: { nombre: 'paneo', min: -1, max: 1, def: 0, fmt: v => (Math.abs(v) < 0.05 ? 'centro' : (v < 0 ? 'izq ' : 'der ') + Math.round(Math.abs(v) * 100)) },
  };
  const defaults = () => Object.fromEntries(Object.entries(PARAMS).map(([k, m]) => [k, m.def]));
  const limpiar = p => { const o = defaults(); for (const k in o) if (p && typeof p[k] === 'number' && isFinite(p[k])) o[k] = clamp(p[k], PARAMS[k].min, PARAMS[k].max); return o; };

  // ---------- modos: qué controla cada giro del teléfono ----------
  // ejes: b = inclinar adelante/atrás · g = inclinar a los lados · a = girar sobre la mesa (como una perilla)
  // cada eje mueve una lista de [parámetro, peso]; 45° (90° al girar sobre la mesa) recorren todo el rango
  const MODOS = [
    { id: 'fusion', nombre: 'Fusión', ejes: { b: [['corte', 1], ['drive', 0.6], ['reso', 0.3]], g: [['tono', 1], ['forma', 0.5]], a: [['rev', 1], ['eco', 0.8]] },
      ayuda: 'adelante/atrás: energía (filtro y saturación) · a los lados: tono y forma · girar sobre la mesa: espacio' },
    { id: 'tono', nombre: 'Tono y forma', ejes: { b: [['tono', 1]], g: [['forma', 1]] }, ayuda: 'adelante/atrás: tono · a los lados: forma de la onda' },
    { id: 'filtro', nombre: 'Filtro', ejes: { b: [['corte', 1]], g: [['reso', 1]] }, ayuda: 'adelante/atrás: filtro (oscuro ↔ brillante) · a los lados: resonancia' },
    { id: 'textura', nombre: 'Textura', ejes: { b: [['drive', 1]], g: [['bits', 1]] }, ayuda: 'adelante/atrás: saturación · a los lados: bits (sonido digital)' },
    { id: 'espacio', nombre: 'Espacio', ejes: { b: [['rev', 1], ['eco', 0.8]], g: [['pan', 1]] }, ayuda: 'adelante/atrás: reverb y eco · a los lados: izquierda ↔ derecha' },
  ];
  const modo = id => MODOS.find(m => m.id === id) || MODOS[0];
  const parametrosDe = m => [...new Set(Object.values(m.ejes).flat().map(([k]) => k))];

  // Giro relativo: desde la posición en que entraste al modo (origen) y los valores que tenías (base)
  function aplicarGiro(P, base, m, d) {
    for (const eje of ['b', 'g', 'a']) for (const [k, w] of m.ejes[eje] || []) {
      const p = PARAMS[k], rango = p.max - p.min, grados = eje === 'a' ? 90 : 45;
      P[k] = clamp(base[k] + ((d[eje] || 0) / grados) * rango * w, p.min, p.max);
    }
  }
  const envolver = a => ((((a + 180) % 360) + 360) % 360) - 180; // −180…180

  // ---------- dibujo de las cuerdas ----------
  const ARMONICOS = [1, 2, 3, 4, 6, 8, 11, 15]; // banda grave → mece la cuerda entera; banda aguda → ondulación fina
  function cuerdaX(y, b, t, semilla) {
    let x = 0;
    for (let k = 0; k < 8; k++) {
      const a = b[k]; if (!(a > 0.004)) continue;
      const n = ARMONICOS[k];
      x += (a * Math.sin(n * Math.PI * y * 0.9 + t * (0.6 + 0.42 * n) + semilla * (k + 1) * 1.7)) / (1 + 0.22 * n);
    }
    return x;
  }
  const PALETA = [[0, [61, 220, 132]], [0.3, [226, 220, 214]], [0.62, [255, 96, 140]], [1, [255, 38, 58]]];
  function color(n, alpha = 1) {
    n = clamp(n);
    for (let i = 1; i < PALETA.length; i++) if (n <= PALETA[i][0]) {
      const [a0, c0] = PALETA[i - 1], [a1, c1] = PALETA[i], u = (n - a0) / (a1 - a0);
      return `rgba(${Math.round(c0[0] + (c1[0] - c0[0]) * u)},${Math.round(c0[1] + (c1[1] - c0[1]) * u)},${Math.round(c0[2] + (c1[2] - c0[2]) * u)},${alpha})`;
    }
    return `rgba(255,38,58,${alpha})`;
  }
  const semillaDe = id => { let h = 7; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 9973; return (h / 9973) * 10; };

  // Estado visual de una persona: bandas suavizadas + historia (para dibujar el eco)
  class Cuerda {
    constructor(id) { this.semilla = semillaDe(id); this.obj = new Float32Array(8); this.vis = new Float32Array(8); this.nivel = 0; this.nObj = 0; this.hist = []; }
    recibir(b, n) { for (let k = 0; k < 8; k++) this.obj[k] = clamp(b[k] || 0); this.nObj = clamp(n || 0); }
    callar() { this.obj.fill(0); this.nObj = 0; }
    paso() { // una vez por cuadro
      for (let k = 0; k < 8; k++) this.vis[k] += (this.obj[k] - this.vis[k]) * (this.obj[k] > this.vis[k] ? 0.35 : 0.12);
      this.nivel += (this.nObj - this.nivel) * 0.2;
      this.hist.push({ b: Float32Array.from(this.vis), n: this.nivel }); if (this.hist.length > 90) this.hist.shift();
    }
    eco(eco) { const lag = Math.round(6 + eco * 40); return this.hist[Math.max(0, this.hist.length - 1 - lag)] || { b: this.vis, n: this.nivel }; } // el eco: la cuerda de hace un instante (más eco = más atrás)
    dibujar(c, x0, top, alto, amp, t, eco, grosor = 1.4, conEco = true) {
      const seg = 48;
      if (conEco) { // eco: más tenue, un poco corrido
        const e = this.eco(eco);
        c.strokeStyle = color(e.n, 0.55); c.lineWidth = grosor * 0.8; c.beginPath();
        for (let i = 0; i <= seg; i++) { const y = i / seg, x = x0 + amp * 0.35 * (0.3 + eco) + cuerdaX(y, e.b, t - 0.15 - eco * 0.5, this.semilla + 0.6) * amp; i ? c.lineTo(x, top + y * alto) : c.moveTo(x, top + y * alto); }
        c.stroke();
      }
      c.strokeStyle = color(this.nivel); c.lineWidth = grosor; c.beginPath();
      for (let i = 0; i <= seg; i++) { const y = i / seg, x = x0 + cuerdaX(y, this.vis, t, this.semilla) * amp; i ? c.lineTo(x, top + y * alto) : c.moveTo(x, top + y * alto); }
      c.stroke();
    }
  }

  const temas = sala => ({ todo: `tacto/${sala}/#`, dev: (id, k) => `tacto/${sala}/${id}/${k}` });

  // ---------- conexión al broker (en línea o local) ----------
  // Usa el broker que corresponda (ver config.js). Si el broker en línea rechaza el usuario o la contraseña,
  // se pasa solo al broker de respaldo; preparar(client, broker, respaldo) engancha los eventos cada vez.
  const esAuth = e => !!e && (e.code === 4 || e.code === 5 || e.code === 134 || e.code === 135 || /authori|password/i.test(e.message || ''));
  async function conectar(opts, preparar) {
    const CFG = g.TACTO_CONFIG || {};
    const abrir = async forzado => {
      const o = await Tacto.open({ ...opts, preferLocal: true, broker: forzado || undefined });
      preparar(o.client, o.broker, !!forzado);
      o.client.on('error', e => {
        if (esAuth(e) && !forzado && CFG.respaldo && o.broker !== CFG.respaldo) {
          console.warn('El broker rechazó el usuario; se usa el respaldo', CFG.respaldo);
          o.client.end(true); abrir(CFG.respaldo);
        }
      });
      return o;
    };
    return abrir(null);
  }
  // ¿El broker es el del propio servidor (red local) o uno en línea?
  const esLocal = broker => { try { return new URL(String(broker).replace(/^ws/, 'http')).host === location.host; } catch { return false; } };
  const nombreBroker = broker => { try { return new URL(String(broker).replace(/^ws/, 'http')).hostname; } catch { return String(broker); } };

  g.Ondas = { PARAMS, MODOS, modo, parametrosDe, defaults, limpiar, aplicarGiro, envolver, cuerdaX, color, Cuerda, temas, clamp, conectar, esLocal, nombreBroker };
})(window);
