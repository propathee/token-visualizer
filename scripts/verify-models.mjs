// Download only tokenizer assets to an OS temporary directory, verify provenance,
// then exercise the actual app adapter against independent Rust-generated IDs.
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const models = JSON.parse(await readFile(new URL('../src/models.json', import.meta.url), 'utf8'));
const directory = await mkdtemp(join(tmpdir(), 'token-visualizer-verify-'));
try {
  for (const model of models) {
    for (const file of model.files) {
      const url = `https://huggingface.co/${model.repo}/resolve/${model.revision}/${file.name}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      const data = Buffer.from(await response.arrayBuffer());
      if (data.length !== file.bytes || createHash('sha256').update(data).digest('hex') !== file.sha256) {
        throw new Error(`${model.id}/${file.name}: size or SHA-256 mismatch`);
      }
      await writeFile(join(directory, `${model.id}-${file.name}`), data);
    }
    console.log(`${model.label}: official assets verified`);
  }
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(command, ['test', '--', 'tests/models.integration.test.ts'], {
    stdio: 'inherit', env: { ...process.env, TOKENIZER_TEST_DIR: directory },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { await rm(directory, { recursive: true, force: true }); }
