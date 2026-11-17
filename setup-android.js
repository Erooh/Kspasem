// Ավտոմատ ավելացնում է ծանուցումների թույլտվությունները և ծանուցման փոքր պատկերակը (Android)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, 'android/app/src/main');
const f = path.join(root, 'AndroidManifest.xml');
if (!fs.existsSync(f)) { console.error('Նախ գործարկիր՝ npx cap add android'); process.exit(1); }
let x = fs.readFileSync(f, 'utf8');
const perms = ['POST_NOTIFICATIONS','SCHEDULE_EXACT_ALARM','USE_EXACT_ALARM','RECEIVE_BOOT_COMPLETED','VIBRATE','WAKE_LOCK'];
let add = '';
for (const p of perms) if (!x.includes('android.permission.' + p)) add += '    <uses-permission android:name="android.permission.' + p + '"/>\n';
if (add) x = x.replace('</manifest>', add + '</manifest>');
fs.writeFileSync(f, x);

// Ծանուցման փոքր պատկերակ (սպիտակ սիրտ). capacitor.config.json-ում smallIcon = ic_stat_icon
const dir = path.join(root, 'res/drawable');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'ic_stat_icon.xml'),
`<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#FFFFFFFF" android:pathData="M12,21.35l-1.45,-1.32C5.4,15.36 2,12.28 2,8.5 2,5.42 4.42,3 7.5,3c1.74,0 3.41,0.81 4.5,2.09C13.09,3.81 14.76,3 16.5,3 19.58,3 22,5.42 22,8.5c0,3.78 -3.4,6.86 -8.55,11.54L12,21.35z"/>
</vector>
`);
console.log('Թույլտվությունները և ծանուցման պատկերակը ավելացված են');
