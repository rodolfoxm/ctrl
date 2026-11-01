// Renders the brand assets from scripts/brand/*.html with headless Microsoft Edge:
//   build/icon.png (512), build/icon.ico (16-256), build/installerSidebar.bmp (164x314),
//   build/installerHeader.bmp (150x57) and docs/social.png (1280x640, GitHub preview).
// Usage: node scripts/make-brand.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brand = path.join(root, 'scripts', 'brand');
const build = path.join(root, 'build');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctrl-brand-'));
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
if (!EDGE) throw new Error('Microsoft Edge não encontrado.');

function shot(page, w, h, out, { transparent = false, scale = 1 } = {}) {
  execFileSync(EDGE, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', `--force-device-scale-factor=${scale}`,
    `--window-size=${w},${h}`, `--screenshot=${out}`, '--virtual-time-budget=2000',
    ...(transparent ? ['--default-background-color=00000000'] : []),
    `--user-data-dir=${path.join(tmp, 'profile')}`,
    pathToFileURL(path.join(brand, page)).href,
  ], { stdio: 'ignore' });
  if (!fs.existsSync(out)) throw new Error(`Falha ao renderizar ${page}`);
}

/** Resizes/converts with System.Drawing (PNG sizes for the .ico, 24-bit BMP for NSIS). */
function ps(script) {
  execFileSync('powershell.exe', ['-NoProfile', '-Command', `Add-Type -AssemblyName System.Drawing; ${script}`], { stdio: 'inherit' });
}

const icon512 = path.join(build, 'icon.png');
shot('icon.html', 512, 512, icon512, { transparent: true });

const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = sizes.map((s) => path.join(tmp, `icon-${s}.png`));
ps(sizes.map((s, i) => `$src = [System.Drawing.Image]::FromFile('${icon512}'); $b = New-Object System.Drawing.Bitmap ${s}, ${s}; $g = [System.Drawing.Graphics]::FromImage($b); $g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'; $g.DrawImage($src, 0, 0, ${s}, ${s}); $b.Save('${pngs[i]}', [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $b.Dispose(); $src.Dispose()`).join('; '));

// ICO container with PNG-compressed entries (supported since Windows Vista).
const images = pngs.map((p) => fs.readFileSync(p));
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((img, i) => {
  const e = 6 + 16 * i;
  const s = sizes[i] >= 256 ? 0 : sizes[i];
  header.writeUInt8(s, e);
  header.writeUInt8(s, e + 1);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(img.length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += img.length;
});
fs.writeFileSync(path.join(build, 'icon.ico'), Buffer.concat([header, ...images]));

for (const [page, w, h, name] of [['sidebar.html', 164, 314, 'installerSidebar'], ['header.html', 150, 57, 'installerHeader']]) {
  const png = path.join(tmp, `${name}.png`);
  // Chromium has a minimum window width, so the page is laid out at its own size and cropped.
  shot(page, 600, 400, png);
  ps(`$src = [System.Drawing.Image]::FromFile('${png}'); $b = New-Object System.Drawing.Bitmap ${w}, ${h}, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb); $g = [System.Drawing.Graphics]::FromImage($b); $r = New-Object System.Drawing.Rectangle 0, 0, ${w}, ${h}; $g.DrawImage($src, $r, $r, [System.Drawing.GraphicsUnit]::Pixel); $b.Save('${path.join(build, `${name}.bmp`)}', [System.Drawing.Imaging.ImageFormat]::Bmp); $g.Dispose(); $b.Dispose(); $src.Dispose()`);
}

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
shot('social.html', 1280, 640, path.join(root, 'docs', 'social.png'));

fs.rmSync(tmp, { recursive: true, force: true });
console.log('Marca gerada: build/icon.png, build/icon.ico, build/installerSidebar.bmp, build/installerHeader.bmp, docs/social.png');
