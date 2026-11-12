// Lista los loops de public/sonidos/. La usan el servidor (/sonidos.json, en vivo) y la publicación en
// GitHub Pages, donde no hay servidor: ahí se ejecuta `node lista-sonidos.js` y queda public/sonidos.json.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, 'public', 'sonidos');

function listar() {
  let files = [];
  try { files = fs.readdirSync(DIR).filter(f => /\.(wav|mp3|ogg|m4a|aac|flac|webm)$/i.test(f)).sort((a, b) => a.localeCompare(b, 'es')); } catch {}
  return files.map(f => ({ id: f, nombre: f.replace(/\.[^.]+$/, '').replace(/^\d+[\s._-]*/, '').replace(/[_-]+/g, ' ').trim() }));
}
module.exports = listar;

if (require.main === module) {
  const lista = listar();
  fs.writeFileSync(path.join(__dirname, 'public', 'sonidos.json'), JSON.stringify(lista, null, 1));
  console.log(`public/sonidos.json: ${lista.length} sonidos`);
}
