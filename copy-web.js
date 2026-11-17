// Պատճենում է վեբ ֆայլերը www/ թղթապանակ (Capacitor-ի webDir)
const fs = require('fs'), path = require('path');
const out = path.join(__dirname, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
const items = ['index.html','app.js','style.css','firebase-config.js','manifest.json','sw.js','assets'];
const skip = new Set(['icon-1024.png']);   // միայն աղբյուր է, APK-ի մեջ պետք չէ
for (const it of items) {
  const src = path.join(__dirname, it);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, it), { recursive: true, filter: (s) => !skip.has(path.basename(s)) });
}
console.log('www ready');
