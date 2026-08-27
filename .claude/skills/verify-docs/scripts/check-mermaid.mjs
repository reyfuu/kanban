/**
 * Validasi sintaks seluruh blok Mermaid di docs/.
 *
 * Mermaid membutuhkan DOM untuk melakukan sanitasi saat mem-parse flowchart
 * dan stateDiagram, sehingga jsdom disediakan sebagai lingkungan.
 *
 * Pakai:
 *   npm i -D mermaid jsdom
 *   node .claude/skills/verify-docs/scripts/check-mermaid.mjs [docs_dir]
 */
import fs from 'node:fs';
import path from 'node:path';

const docsDir = process.argv[2] ?? 'docs';

// ---------------------------------------------------------------- ekstraksi

function extractBlocks(dir) {
  const blocks = [];
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const text = fs.readFileSync(path.join(dir, name), 'utf8');
    const re = /^```mermaid\n([\s\S]*?)^```/gm;
    let m;
    while ((m = re.exec(text)) !== null) {
      blocks.push({
        file: name,
        line: text.slice(0, m.index).split('\n').length,
        code: m[1],
      });
    }
  }
  return blocks;
}

// ------------------------------------------------------------------- setup

async function setupDom() {
  let JSDOM;
  try {
    ({ JSDOM } = await import('jsdom'));
  } catch {
    console.error('jsdom tidak terpasang. Jalankan: npm i -D mermaid jsdom');
    process.exit(2);
  }
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    pretendToBeVisual: true,
  });
  const w = dom.window;
  for (const key of [
    'window', 'document', 'Element', 'HTMLElement', 'SVGElement',
    'DOMParser', 'Node', 'NodeFilter', 'getComputedStyle', 'MutationObserver',
  ]) {
    globalThis[key] = key === 'window' ? w : w[key];
  }
  // navigator hanya punya getter di Node modern
  Object.defineProperty(globalThis, 'navigator', {
    value: w.navigator,
    configurable: true,
  });
}

// -------------------------------------------------------------------- main

async function main() {
  if (!fs.existsSync(docsDir)) {
    console.error(`Direktori tidak ditemukan: ${docsDir}`);
    process.exit(2);
  }

  const blocks = extractBlocks(docsDir);
  if (blocks.length === 0) {
    console.log('Tidak ada blok mermaid.');
    return;
  }

  await setupDom();

  let mermaid;
  try {
    mermaid = (await import('mermaid')).default;
  } catch {
    console.error('mermaid tidak terpasang. Jalankan: npm i -D mermaid jsdom');
    process.exit(2);
  }
  mermaid.initialize({ startOnLoad: false });

  const failures = [];
  for (const b of blocks) {
    try {
      await mermaid.parse(b.code);
    } catch (e) {
      failures.push({ ...b, message: String(e.message).split('\n').slice(0, 3).join(' | ') });
    }
  }

  for (const f of failures) {
    console.log(`GAGAL ${f.file}:${f.line}\n      ${f.message}`);
  }

  if (failures.length === 0) {
    console.log(`Mermaid: ${blocks.length}/${blocks.length} diagram valid`);
  } else {
    console.log(`\nMermaid: ${failures.length} dari ${blocks.length} diagram GAGAL`);
    process.exit(1);
  }
}

main();
