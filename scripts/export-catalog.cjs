// Writes the public catalog (no scripts) to src/lib/catalog.snapshot.json so the
// browser-only mock backend shows the real tweak list. Run after editing the catalog.
const fs = require('fs');
const path = require('path');
const catalog = require('../electron/catalog/index.cjs');

const machine = { win11: true, gpuVendors: ['nvidia'], laptop: false, wifi: false, ramGb: 32, hybrid: false, defender: true };
const out = {
  modules: catalog.MODULES,
  tweaks: catalog.TWEAKS.map((t) => catalog.publicTweak(t, machine)),
  actions: catalog.ACTIONS.map(({ run, ...meta }) => meta),
  profiles: catalog.PROFILES,
  quickWins: catalog.QUICK_WINS,
};
const file = path.join(__dirname, '..', 'src', 'lib', 'catalog.snapshot.json');
fs.writeFileSync(file, JSON.stringify(out), 'utf8');
console.log(`${out.tweaks.length} tweaks -> ${path.relative(process.cwd(), file)}`);
