// Post-build: create dist/pwascript/index.html with Script Vault manifest
// iOS Safari reads the manifest link from raw HTML before any JS runs,
// so we need a separate HTML file with the correct manifest already set.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '..', 'dist');
const srcHtml = resolve(distDir, 'index.html');

if (!existsSync(srcHtml)) {
  console.log('⚠ dist/index.html not found, skipping Script Vault HTML');
  process.exit(0);
}

let html = readFileSync(srcHtml, 'utf-8');

// Swap VCA manifest for Script Vault manifest
html = html.replace('href="/manifest.webmanifest"', 'href="/sv-manifest.json"');

// Fix meta tags for Script Vault
html = html.replace('content="#3b82f6"', 'content="#0A0A0B"');
html = html.replace('content="VCA"', 'content="Script Vault"');
html = html.replace(
  '<title>VCA - Viral Content Analyzer</title>',
  '<title>Script Vault</title>'
);

const outDir = resolve(distDir, 'pwascript');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'index.html'), html);
console.log('✓ Script Vault: created dist/pwascript/index.html');
