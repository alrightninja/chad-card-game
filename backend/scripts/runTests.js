const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const engineDir = path.join(root, "engine");
const files = fs
  .readdirSync(engineDir)
  .filter((f) => f.startsWith("test") && f.endsWith(".js"))
  .map((f) => path.join(engineDir, f));

let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, [file], { stdio: "inherit", cwd: root });
  if (result.status !== 0) failed += 1;
}

const nodeTest = spawnSync(
  process.execPath,
  ["--test", path.join("tests", "rulesAndMatch.test.js")],
  {
    stdio: "inherit",
    cwd: root
  }
);
if (nodeTest.status !== 0) failed += 1;

const smoke = spawnSync(process.execPath, ["engine/smokeMatch.js"], {
  stdio: "inherit",
  cwd: root
});
if (smoke.status !== 0) failed += 1;

if (failed) {
  console.error(`Test run failed (${failed} groups)`);
  process.exit(1);
}
console.log("All backend tests passed");
