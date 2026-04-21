#!/usr/bin/env node
// Thin wrapper that runs `next <args>` with two local-env fixes:
//   1. Strip OPENSSL_CONF — some Windows setups inherit a stale
//      PostgreSQL ODBC path that makes OpenSSL emit startup errors.
//   2. If the invoking Node is < 20 (Next 16 minimum), look up an
//      installed Node ≥ 20 via fnm and run Next under that binary
//      instead. On Linux CI / Docker with Node 20+, this is a no-op.
//
// Any failure falls through to a clear error so the developer knows
// to install/activate a supported Node version.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_MAJOR = 20;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const nextCli = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

function findFnmNodeBinary() {
  const fnmDir =
    process.env.FNM_DIR ||
    (process.env.APPDATA && path.join(process.env.APPDATA, "fnm"));
  if (!fnmDir) return null;
  const versionsDir = path.join(fnmDir, "node-versions");
  if (!fs.existsSync(versionsDir)) return null;

  const candidates = fs
    .readdirSync(versionsDir)
    .filter((v) => /^v\d+\./.test(v))
    .map((v) => ({
      name: v,
      major: parseInt(v.slice(1).split(".")[0], 10),
    }))
    .filter((v) => v.major >= REQUIRED_MAJOR)
    .sort((a, b) => b.major - a.major);

  for (const c of candidates) {
    const winBin = path.join(versionsDir, c.name, "installation", "node.exe");
    const unixBin = path.join(versionsDir, c.name, "installation", "bin", "node");
    if (fs.existsSync(winBin)) return winBin;
    if (fs.existsSync(unixBin)) return unixBin;
  }
  return null;
}

function pickNodeBinary() {
  const currentMajor = parseInt(process.versions.node.split(".")[0], 10);
  if (currentMajor >= REQUIRED_MAJOR) return process.execPath;

  const fnmNode = findFnmNodeBinary();
  if (fnmNode) {
    console.error(
      `[next-cli] Node ${process.versions.node} is too old for Next; ` +
        `using ${fnmNode} (>= ${REQUIRED_MAJOR})`,
    );
    return fnmNode;
  }

  console.error(
    `Node ${REQUIRED_MAJOR}+ required, found ${process.versions.node}. ` +
      `Install Node ${REQUIRED_MAJOR} (e.g. via fnm/nvm) or upgrade the system Node.`,
  );
  process.exit(1);
}

const env = { ...process.env };
delete env.OPENSSL_CONF;

const nodeBin = pickNodeBinary();
const args = [nextCli, ...process.argv.slice(2)];

const child = spawn(nodeBin, args, {
  stdio: "inherit",
  env,
  cwd: projectRoot,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
