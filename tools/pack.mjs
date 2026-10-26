// Compress Blender-exported packs with meshopt + quantization, merge catalogs.
//   node tools/pack.mjs
// in:  build/raw/L*.glb, build/catalog/L*.json
// out: assets/packs/L*.glb, assets/catalog.json
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { quantize, meshopt, dedup, prune } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RAW = path.join(ROOT, 'build', 'raw');
const OUT = path.join(ROOT, 'assets', 'packs');
fs.mkdirSync(OUT, { recursive: true });

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
});

let total = 0;
for (const f of fs.readdirSync(RAW).filter((f) => f.endsWith('.glb')).sort()) {
  const doc = await io.read(path.join(RAW, f));
  await doc.transform(
    dedup(),
    prune(),
    // colours carry palette indices (k/255): 8-bit normalized keeps them exact
    quantize({ quantizePosition: 14, quantizeNormal: 8, quantizeColor: 8, quantizationVolume: 'mesh' }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  const bytes = await io.writeBinary(doc);
  fs.writeFileSync(path.join(OUT, f), bytes);
  const rawSize = fs.statSync(path.join(RAW, f)).size;
  total += bytes.byteLength;
  console.log(`${f}: ${(rawSize / 1024).toFixed(0)} KB -> ${(bytes.byteLength / 1024).toFixed(0)} KB`);
}

const catalog = [];
const catDir = path.join(ROOT, 'build', 'catalog');
for (const f of fs.readdirSync(catDir).filter((f) => f.endsWith('.json')).sort()) {
  catalog.push(...JSON.parse(fs.readFileSync(path.join(catDir, f), 'utf8')));
}
catalog.sort((a, b) => a.level - b.level || a.size - b.size);
fs.writeFileSync(path.join(ROOT, 'assets', 'catalog.json'), JSON.stringify(catalog));
console.log(`packs total ${(total / 1024).toFixed(0)} KB, catalog ${catalog.length} types`);
