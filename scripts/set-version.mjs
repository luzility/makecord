import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version ?? "")) {
  console.error("Usage: pnpm set-version <x.y.z>");
  process.exit(1);
}

const manifests = [
  "apps/desktop/package.json",
  "apps/web/package.json",
  "packages/spec/package.json",
  "packages/plugin-sdk/package.json",
  "packages/runtime/package.json",
  "packages/templates/package.json",
  "plugins/core/package.json",
];

for (const file of manifests) {
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  pkg.version = version;
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
}

const replace = (file, pattern, next) => {
  const text = readFileSync(file, "utf8");
  if (!pattern.test(text)) throw new Error(`Couldn't find the version in ${file}`);
  writeFileSync(file, text.replace(pattern, next));
};

replace("packages/runtime/src/version.ts", /"[^"]+"/, `"${version}"`);
replace("plugins/core/src/index.ts", /version: "[^"]+"/, `version: "${version}"`);
const starter = "packages/templates/starter/package.json";
const project = JSON.parse(readFileSync(starter, "utf8"));
project.dependencies["@makecord/runtime"] = `^${version}`;
writeFileSync(starter, `${JSON.stringify(project, null, 2)}\n`);

console.log(`Set version ${version} in ${manifests.length + 3} files`);
