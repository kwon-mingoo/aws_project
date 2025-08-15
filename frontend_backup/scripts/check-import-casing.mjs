import { promises as fs } from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "src");
const EXTS = [".tsx", ".ts", ".jsx", ".js", ".css", ".scss", ".module.css", ".module.scss"];

async function getRealPathCasing(p) {
  const parts = path.resolve(p).split(path.sep);
  let cur = parts[0] === "" ? path.sep : parts[0];
  for (let i = 1; i < parts.length; i++) {
    const parent = cur;
    const name = parts[i];
    try {
      const entries = await fs.readdir(parent, { withFileTypes: true });
      const match = entries.find(e => e.name.toLowerCase() === name.toLowerCase());
      if (!match) return null;
      cur = path.join(parent, match.name);
    } catch {
      return null;
    }
  }
  return cur;
}

async function resolveImport(fromFile, importPath) {
  const base = path.dirname(fromFile);
  const abs = path.resolve(base, importPath);
  for (const ext of EXTS) {
    const f = abs.endsWith(ext) ? abs : abs + ext;
    try { const s = await fs.stat(f); if (s.isFile()) return f; } catch {}
  }
  try {
    const s = await fs.stat(abs);
    if (s.isDirectory()) {
      for (const ext of EXTS) {
        const idx = path.join(abs, "index" + ext);
        try { const s2 = await fs.stat(idx); if (s2.isFile()) return idx; } catch {}
      }
    }
  } catch {}
  return null;
}

async function walk(dir, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, files);
    else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) files.push(p);
  }
  return files;
}

function findImports(code) {
  const out = [];
  const re = /\b(?:import|require|export)\b[^'"]*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(code))) out.push(m[1]);
  return out;
}

const FIX = process.argv.includes("--fix");
const files = await walk(ROOT);
let problems = [];

for (const file of files) {
  const code = await fs.readFile(file, "utf8");
  const rels = findImports(code).filter(p => p.startsWith("./") || p.startsWith("../"));
  for (const imp of rels) {
    const target = await resolveImport(file, imp);
    if (!target) { problems.push({ type:"not-found", file, imp }); continue; }
    const real = await getRealPathCasing(target);
    if (!real) { problems.push({ type:"not-found", file, imp }); continue; }

    const curAbs = path.normalize(path.resolve(path.dirname(file), imp));
    const realAbs = path.normalize(real);
    const caseMismatch = curAbs.toLowerCase() === realAbs.toLowerCase() && curAbs !== realAbs;

    if (caseMismatch) {
      let correctRel = path.relative(path.dirname(file), real).replaceAll("\\","/");
      if (!correctRel.startsWith(".")) correctRel = "./" + correctRel;
      problems.push({ type:"case-mismatch", file, imp, fix: correctRel });

      if (FIX) {
        const safe = imp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const reImp = new RegExp(`(['"])${safe}\\1`, "g");
        const newCode = code.replace(reImp, `'${correctRel}'`);
        await fs.writeFile(file, newCode, "utf8");
      }
    }
  }
}

if (!problems.length) { console.log("✅ No import path problems detected."); process.exit(0); }

const byType = problems.reduce((a,p)=>((a[p.type] ||= []).push(p),a),{});
if (byType["not-found"]?.length) {
  console.log("\n❌ Not found:");
  byType["not-found"].forEach(p => console.log(`- ${p.file}: ${p.imp}`));
}
if (byType["case-mismatch"]?.length) {
  console.log("\n⚠️ Case mismatch:");
  byType["case-mismatch"].forEach(p => console.log(`- ${p.file}: ${p.imp}  →  ${p.fix}`));
  console.log(FIX ? "\n🛠  Applied fixes." : "\nRun again with --fix to auto-correct.");
}
process.exit(byType["not-found"]?.length ? 2 : 0);
