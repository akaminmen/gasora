import { appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runIngest } from './run-ingest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const inCi = process.env['GITHUB_ACTIONS'] === 'true';

const lines: string[] = [];
const log = (message: string) => {
  lines.push(message);
  console.log(message);
};
const warn = (message: string) => {
  lines.push(`AVISO: ${message}`);
  console.warn(inCi ? `::warning::${message}` : `AVISO: ${message}`);
};

function writeSummary() {
  const file = process.env['GITHUB_STEP_SUMMARY'];
  if (file) appendFileSync(file, `## Ingesta de datos\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`);
}

runIngest({
  root,
  outDir: resolve(root, outIndex >= 0 ? (args[outIndex + 1] ?? 'public/data') : 'public/data'),
  useFixtures: args.includes('--fixtures'),
  previousUrl: process.env['GASORA_PREVIOUS_URL'],
  log,
  warn,
})
  .then((code) => {
    writeSummary();
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error);
    writeSummary();
    process.exitCode = 1;
  });
