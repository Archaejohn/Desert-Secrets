// Upscale generated sheets 8x for the visual gate.
import { PNG } from "pngjs";
import { readFileSync, writeFileSync } from "node:fs";
const S = 8;
for (const name of process.argv.slice(2)) {
  const src = PNG.sync.read(readFileSync(`src/assets/generated/${name}.png`));
  const out = new PNG({ width: src.width * S, height: src.height * S });
  for (let y = 0; y < out.height; y++)
    for (let x = 0; x < out.width; x++) {
      const si = ((y / S | 0) * src.width + (x / S | 0)) * 4;
      const di = (y * out.width + x) * 4;
      for (let k = 0; k < 4; k++) out.data[di + k] = src.data[si + k];
    }
  writeFileSync(`preview/${name}@8x.png`, PNG.sync.write(out));
  console.log(`preview/${name}@8x.png`);
}
