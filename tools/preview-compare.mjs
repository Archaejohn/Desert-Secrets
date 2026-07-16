import { PNG } from "pngjs";
import { readFileSync, writeFileSync } from "node:fs";
const S = 8;
const [oldPath, newPath, outPath] = process.argv.slice(2);
const a = PNG.sync.read(readFileSync(oldPath));
const b = PNG.sync.read(readFileSync(newPath));
const gap = 2; // source pixels between the two
const out = new PNG({ width: (a.width + gap + b.width) * S, height: Math.max(a.height, b.height) * S });
function blit(src, ox) {
  for (let y = 0; y < src.height * S; y++)
    for (let x = 0; x < src.width * S; x++) {
      const si = ((y / S | 0) * src.width + (x / S | 0)) * 4;
      const di = (y * out.width + (x + ox * S)) * 4;
      for (let k = 0; k < 4; k++) out.data[di + k] = src.data[si + k];
    }
}
blit(a, 0);
blit(b, a.width + gap);
writeFileSync(outPath, PNG.sync.write(out));
console.log(outPath);
