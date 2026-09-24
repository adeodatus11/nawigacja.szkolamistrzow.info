import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, "assets"), { recursive: true });

for (const file of ["index.html", "styles.css", "bundle.js", "robots.txt"]) {
  await cp(path.join(root, file), path.join(dist, file));
}

for (const file of ["leaflet.css", "logo-zsz5.png"]) {
  await cp(path.join(root, "assets", file), path.join(dist, "assets", file));
}

await cp(path.join(root, "assets", "images"), path.join(dist, "assets", "images"), {
  recursive: true,
});
await cp(path.join(root, "assets", "branding"), path.join(dist, "assets", "branding"), { recursive: true });
await cp(path.join(root, "assets", "fonts"), path.join(dist, "assets", "fonts"), { recursive: true });
await writeFile(path.join(dist, ".nojekyll"), "", "utf8");

console.log(`Gotowy artefakt GitHub Pages: ${dist}`);
