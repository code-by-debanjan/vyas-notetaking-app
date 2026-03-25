// Syncs the version from package.json into README.md badge
import { readFileSync, writeFileSync } from "fs";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
const version = pkg.version;

let readme = readFileSync("README.md", "utf-8");
readme = readme.replace(
  /version-[\d.]+(-[a-zA-Z0-9.]+)?-7c3aed/g,
  `version-${version}-7c3aed`
);
writeFileSync("README.md", readme);
console.log(`README.md synced to version ${version}`);
