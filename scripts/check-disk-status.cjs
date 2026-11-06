// Checks the disk health rules with fixed readings, including real SMART data from four drives. Touches no disk.
const assert = require('assert');
const { summarize } = require('../electron/tools/disk-status.cjs');

const attr = (id, cur, thr = 0, raw = 0) => ({ id, cur, worst: cur, thr, raw });
const sata = (over) => ({ name: 'Disk', media: 'HDD', bus: 'SATA', windows: 'Healthy', thresholdsRead: true, predictFailure: false, ...over });
const nvme = (over) => ({ name: 'NVMe', media: 'SSD', bus: 'NVMe', windows: 'Healthy', nvme: { crit: 0, temp: 40, spare: 100, spareThr: 10, used: 8, unitsRead: 0, unitsWritten: 0, hostReads: 0, hostWrites: 0, busy: 0, cycles: 2, hours: 3, unsafe: 0, media: 0, errLog: 8273, ...over } });
const hddOk = [attr(5, 100, 10), attr(0xc5, 100), attr(0xc6, 100)];

// NVMe
assert.equal(summarize(nvme()).health, 'Healthy');
assert.equal(summarize(nvme()).wear, 8);
assert.equal(summarize(nvme({ crit: 1 })).health, 'Unhealthy');
assert.equal(summarize(nvme({ spare: 5 })).health, 'Unhealthy');
assert.equal(summarize(nvme({ spare: 10 })).health, 'Warning');
assert.equal(summarize(nvme({ used: 90 })).health, 'Warning');
assert.equal(summarize(nvme({ spare: 0, spareThr: 0 })).health, 'Healthy'); // drive without a spare report
assert.equal(summarize({ ...nvme(), name: 'VMware Virtual NVMe' }).health, 'Healthy'); // no verdict: keeps Windows'

assert.equal(summarize({ ...nvme(), ata: [null] }).attributes.length, 0); // what PowerShell sends for a disk without SMART

// HDD
assert.equal(summarize(sata({ ata: hddOk })).health, 'Healthy');
assert.equal(summarize(sata({ ata: hddOk })).wear, null);
assert.equal(summarize(sata({ ata: [attr(5, 100, 10, 1), attr(0xc5, 100), attr(0xc6, 100)] })).health, 'Warning');
assert.equal(summarize(sata({ ata: [attr(5, 100, 10, 0xffffffff), attr(0xc5, 100), attr(0xc6, 100)] })).health, 'Healthy');
assert.equal(summarize(sata({ ata: [...hddOk, attr(1, 5, 6)] })).health, 'Unhealthy');
assert.equal(summarize(sata({ ata: [...hddOk, attr(0xc2, 5, 45)] })).health, 'Healthy'); // temperature limit is ignored
assert.equal(summarize(sata({ ata: [...hddOk, attr(0xf1, 5, 45)] })).health, 'Healthy'); // not a critical id on HDDs
assert.equal(summarize(sata({ ata: hddOk, thresholdsRead: false })).health, 'Healthy'); // unknown: keeps Windows'
assert.equal(summarize(sata({ ata: hddOk, predictFailure: true })).health, 'Unhealthy');
assert.equal(summarize(sata({ ata: hddOk, windows: 'Warning' })).health, 'Warning');

// SATA SSD
const ssd = (name, ata) => sata({ name, media: 'SSD', ata });
assert.equal(summarize(ssd('Generic', [attr(0xa9, 100)])).wear, 0);
assert.equal(summarize(ssd('Generic', [attr(0xa9, 8)])).health, 'Warning');
assert.equal(summarize(ssd('Generic', [attr(0xa9, 0)])).health, 'Unhealthy');
assert.equal(summarize(ssd('Generic', [attr(0xf1, 5, 45)])).health, 'Unhealthy'); // SSDs fail on any attribute
assert.equal(summarize(ssd('Generic', [attr(5, 100, 0, 3)])).health, 'Healthy'); // no life and no limits: keeps Windows'
assert.equal(summarize(ssd('SAMSUNG 870 EVO', [attr(0xe7, 50), attr(0xb1, 93)])).wear, 7);
assert.equal(summarize(ssd('KINGSTON SA400S37', [attr(0xe7, 100, 0, 76)])).wear, 24);
assert.equal(summarize(ssd('SanDisk SSD PLUS', [attr(0xe6, 100, 0, 0x0900)])).wear, 9);
assert.equal(summarize(ssd('Generic', [attr(0xe9, 200)])).wear, null); // normalized above 100 isn't a percentage

// Real readings (no thresholds on the WD): life from attribute A9, cycles from 0C, errors from 05/C5/C6.
const wd = summarize(ssd('WDS1TB2G0A-00JH30', [attr(1, 100), attr(5, 100), attr(9, 100, 0, 5574), attr(12, 100, 0, 1389), attr(0xa9, 100, 0, 100), attr(0xc2, 100, 0, 38), attr(0xc5, 100), attr(0xc6, 100)]));
assert.deepEqual([wd.wear, wd.startStop, wd.mediaErrors, wd.temperature], [0, 1389, 0, 38]);

// Packed raw values show as hex, plain counts as numbers.
const seagate = summarize(sata({ ata: [...hddOk, attr(0xc2, 41, 0, 85899345961), attr(0xc1, 1, 0, 533324)] }));
assert.equal(seagate.attributes.find((a) => a.id === 'C2').raw.slice(0, 2), '0x');
assert.equal(seagate.attributes.find((a) => a.id === 'C1').raw, (533324).toLocaleString('pt-BR'));
assert.equal(seagate.health, 'Healthy');

console.log('disk status ok');
