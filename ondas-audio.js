/* ondas-audio.js · el sonido de todos (Web Audio, corre en la pantalla).
 *
 * Una VOZ por persona:  loop → forma/saturación/bits (WaveShaper) → filtro → paneo → volumen ─┬→ salida
 *                                                                                              ├→ reverb (compartida)
 *                                                                                              └→ eco (compartido)
 * Reverb y eco son uno solo para todos (cada voz decide cuánto les manda): así aguanta 20–30 personas.
 *
 *   OndasAudio.init()                      crea el audio (debe venir de un clic o una tecla)
 *   OndasAudio.cargar(lista)               carga los loops [{id, nombre}] de /sonidos.json
 *   OndasAudio.actualizar(id, {on, sonido, p})   enciende/apaga, cambia de loop y aplica parámetros
 *   OndasAudio.pulso(id)                   acento al tocar la cuerda
 *   OndasAudio.analizar(id)                {b: 8 bandas 0–1, n: nivel 0–1} para dibujar
 *   OndasAudio.quitar(id)                  la persona se fue
 */
(function (g) {
  'use strict';
  const A = { ctx: null, buf: {}, voces: {}, vol: 0.9 };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function impulso(c, seg) { const n = c.sampleRate * seg, b = c.createBuffer(2, n, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2); } return b; }

  function init() {
    if (A.ctx) { A.ctx.resume(); return; }
    // iPhone: sin esto, el interruptor de silencio apaga el audio de la página
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    const c = (A.ctx = new (g.AudioContext || g.webkitAudioContext)({ latencyHint: 'interactive' }));
    A.comp = c.createDynamicsCompressor(); A.comp.threshold.value = -10; A.comp.knee.value = 6; A.comp.ratio.value = 8; A.comp.attack.value = 0.004; A.comp.release.value = 0.2;
    A.master = c.createGain(); A.master.gain.value = A.vol; A.master.connect(A.comp); A.comp.connect(c.destination);
    A.revIn = c.createGain(); A.rev = c.createConvolver(); A.rev.buffer = impulso(c, 3.2); A.revIn.connect(A.rev); A.rev.connect(A.master);
    A.ecoIn = c.createGain(); A.eco = c.createDelay(2); A.eco.delayTime.value = 0.36; A.fb = c.createGain(); A.fb.gain.value = 0.45;
    A.ecoTono = c.createBiquadFilter(); A.ecoTono.type = 'lowpass'; A.ecoTono.frequency.value = 3200;
    A.ecoIn.connect(A.eco); A.eco.connect(A.ecoTono); A.ecoTono.connect(A.fb); A.fb.connect(A.eco); A.ecoTono.connect(A.master);
  }
  async function cargar(lista) {
    init();
    await Promise.all(lista.map(async s => {
      if (A.buf[s.id]) return;
      try { A.buf[s.id] = await A.ctx.decodeAudioData(await (await fetch('sonidos/' + encodeURIComponent(s.id))).arrayBuffer()); }
      catch (e) { console.warn('No pude cargar', s.id, e); }
    }));
    for (const id in A.voces) if (A.voces[id].deseado) actualizar(id, A.voces[id].deseado);
  }

  // forma (pliegue de onda), saturación y bits en una sola curva
  function curva(forma, drive, bits) {
    const n = 1024, c = new Float32Array(n), k = 1 + drive * 30, nk = Math.tanh(k), niveles = bits > 0.02 ? Math.pow(2, 16 - bits * 13) / 2 : 0;
    for (let i = 0; i < n; i++) {
      let x = (i / (n - 1)) * 2 - 1;
      x = Math.tanh(k * x) / nk;
      if (forma > 0.01) x = (1 - forma) * x + forma * Math.sin(x * (1 + forma * 4) * Math.PI / 2);
      if (niveles) x = Math.round(x * niveles) / niveles;
      c[i] = x;
    }
    return c;
  }

  function voz(id) {
    if (A.voces[id] && A.voces[id].in) return A.voces[id];
    const v = (A.voces[id] ||= {});
    if (!A.ctx) return v;
    const c = A.ctx;
    v.in = c.createGain(); v.sh = c.createWaveShaper(); v.sh.oversample = '2x'; v.filt = c.createBiquadFilter(); v.filt.type = 'lowpass';
    v.pan = c.createStereoPanner(); v.gan = c.createGain(); v.gan.gain.value = 0; v.sRev = c.createGain(); v.sEco = c.createGain();
    v.an = c.createAnalyser(); v.an.fftSize = 1024; v.an.smoothingTimeConstant = 0.55;
    v.in.connect(v.sh); v.sh.connect(v.filt); v.filt.connect(v.pan); v.pan.connect(v.gan);
    v.gan.connect(A.master); v.gan.connect(v.sRev); v.sRev.connect(A.revIn); v.gan.connect(v.sEco); v.sEco.connect(A.ecoIn); v.gan.connect(v.an);
    v.freq = new Uint8Array(v.an.frequencyBinCount); v.td = new Float32Array(v.an.fftSize); v.curva = '';
    return v;
  }

  function actualizar(id, d) {
    const v = voz(id); v.deseado = d;
    if (!A.ctx || !v.in) return;
    const c = A.ctx, t = c.currentTime, p = d.p || {};
    // loop: cambia con un fundido corto
    const buf = A.buf[d.sonido];
    if (d.on && buf && (!v.src || v.srcId !== d.sonido)) {
      const vieja = v.src, vg = v.srcG;
      const src = c.createBufferSource(), sg = c.createGain(); src.buffer = buf; src.loop = true;
      sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(1, t + 0.08); src.connect(sg); sg.connect(v.in);
      src.start(t); v.src = src; v.srcG = sg; v.srcId = d.sonido;
      if (vieja) { vg.gain.setTargetAtTime(0, t, 0.04); vieja.stop(t + 0.3); }
    }
    v.gan.gain.setTargetAtTime(d.on ? 0.8 : 0, t, d.on ? 0.03 : 0.12);
    if (!d.on && v.src) { const s = v.src; s.stop(t + 0.8); v.src = null; v.srcId = null; }
    if (v.src) v.src.detune.setTargetAtTime((p.tono || 0) * 100, t, 0.03);
    const clave = [p.forma, p.drive, p.bits].map(x => Math.round((x || 0) * 50)).join(',');
    if (clave !== v.curva) { v.curva = clave; v.sh.curve = curva(p.forma || 0, p.drive || 0, p.bits || 0); }
    v.filt.frequency.setTargetAtTime(80 * Math.pow(225, clamp(p.corte ?? 0.85, 0, 1)), t, 0.03);
    v.filt.Q.setTargetAtTime(0.5 * Math.pow(36, clamp(p.reso ?? 0.1, 0, 1)), t, 0.03);
    v.pan.pan.setTargetAtTime(clamp(p.pan || 0, -1, 1), t, 0.03);
    v.sRev.gain.setTargetAtTime(clamp(p.rev ?? 0.2, 0, 1) * 0.9, t, 0.05);
    v.sEco.gain.setTargetAtTime(clamp(p.eco ?? 0.1, 0, 1) * 0.7, t, 0.05);
    reequilibrar();
  }
  function reequilibrar() { // con muchas personas sonando, baja un poco cada una para no saturar
    if (!A.ctx) return;
    const n = Object.values(A.voces).filter(v => v.deseado && v.deseado.on).length;
    A.master.gain.setTargetAtTime(A.vol / Math.sqrt(Math.max(1, n * 0.6)), A.ctx.currentTime, 0.2);
  }
  function pulso(id) {
    const v = A.voces[id]; if (!A.ctx || !v || !v.in || !(v.deseado && v.deseado.on)) return;
    const t = A.ctx.currentTime, f = v.filt.frequency;
    v.gan.gain.cancelScheduledValues(t); v.gan.gain.setValueAtTime(v.gan.gain.value, t); v.gan.gain.linearRampToValueAtTime(1.4, t + 0.01); v.gan.gain.setTargetAtTime(0.8, t + 0.02, 0.18);
    f.cancelScheduledValues(t); f.setValueAtTime(f.value, t); f.linearRampToValueAtTime(Math.min(18000, f.value * 4), t + 0.01);
    f.setTargetAtTime(80 * Math.pow(225, clamp(v.deseado.p.corte ?? 0.85, 0, 1)), t + 0.02, 0.25);
  }
  // 8 bandas logarítmicas (60 Hz – 12 kHz) y nivel: lo que se dibuja en la cuerda
  const BORDES = [60, 120, 250, 500, 1000, 2000, 4000, 8000, 14000];
  function analizar(id) {
    const v = A.voces[id]; if (!A.ctx || !v || !v.an) return null;
    v.an.getByteFrequencyData(v.freq); v.an.getFloatTimeDomainData(v.td);
    const hzBin = A.ctx.sampleRate / v.an.fftSize, b = new Array(8);
    for (let k = 0; k < 8; k++) {
      const i0 = Math.max(1, Math.floor(BORDES[k] / hzBin)), i1 = Math.max(i0 + 1, Math.ceil(BORDES[k + 1] / hzBin));
      let m = 0; for (let i = i0; i < i1 && i < v.freq.length; i++) m = Math.max(m, v.freq[i]);
      b[k] = clamp((m - 95) / 150, 0, 1) ** 1.3;
    }
    let s = 0; for (const x of v.td) s += x * x;
    return { b, n: clamp(Math.sqrt(s / v.td.length) * 1.8, 0, 1) };
  }
  function quitar(id) {
    const v = A.voces[id]; if (!v) return;
    if (A.ctx && v.gan) { const t = A.ctx.currentTime; v.gan.gain.setTargetAtTime(0, t, 0.1); if (v.src) v.src.stop(t + 0.6); setTimeout(() => { try { v.gan.disconnect(); } catch {} }, 900); }
    delete A.voces[id]; reequilibrar();
  }
  // la pantalla puede callar todo su audio (los teléfonos siguen sonando) y volver a encenderlo
  function suspender() { if (A.ctx) A.ctx.suspend(); }
  function reanudar() { init(); A.ctx.resume(); for (const id in A.voces) if (A.voces[id].deseado) actualizar(id, A.voces[id].deseado); }
  g.OndasAudio = {
    init, cargar, actualizar, pulso, analizar, quitar, suspender, reanudar,
    get iniciado() { return !!A.ctx; },
    get activo() { return !!(A.ctx && A.ctx.state === 'running'); },
    set volumen(v) { A.vol = clamp(v, 0, 1.5); reequilibrar(); }, get volumen() { return A.vol; },
  };
})(window);
