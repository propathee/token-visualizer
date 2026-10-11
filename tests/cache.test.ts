import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadFiles } from '../src/tokenizer/cache';
import { type ModelDefinition } from '../src/models';

const source = new TextEncoder().encode('{"test":true}');
const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', source)), (b) => b.toString(16).padStart(2, '0')).join('');
const model: ModelDefinition = {
  id: 'test', label: 'Test', repo: 'test/repo', revision: 'fixed-revision', engine: 'hf-byte-bpe',
  normalization: 'none', vocabSize: 0,
  files: [{ name: 'tokenizer.json', bytes: source.byteLength, sha256: hash }],
};
function setup(cached?: Uint8Array) {
  const cache = {
    match: vi.fn(async () => cached ? new Response(cached as BodyInit) : undefined),
    put: vi.fn(async () => undefined), delete: vi.fn(async () => true),
  };
  vi.stubGlobal('caches', { open: vi.fn(async () => cache) });
  const fetch = vi.fn(async () => new Response(source));
  vi.stubGlobal('fetch', fetch);
  return { cache, fetch };
}
afterEach(() => vi.unstubAllGlobals());
describe('lazy asset cache', () => {
  it('downloads, verifies, and caches pinned assets with progress', async () => {
    const { fetch, cache } = setup();
    const progress = vi.fn();
    const result = await loadFiles(model, progress);
    expect(result).toEqual({ data: { 'tokenizer.json': { test: true } }, persistent: true });
    expect(fetch.mock.calls[0][0]).toContain('/resolve/fixed-revision/tokenizer.json');
    expect(cache.put).toHaveBeenCalledOnce();
    expect(progress).toHaveBeenLastCalledWith(source.length, source.length, '初始化分词器');
  });
  it('works offline with a valid cache and makes no network request', async () => {
    const { fetch } = setup(source);
    await loadFiles(model, vi.fn());
    expect(fetch).not.toHaveBeenCalled();
  });
  it('replaces corrupted cached data', async () => {
    const { fetch, cache } = setup(new TextEncoder().encode('{"test":null}'));
    await loadFiles(model, vi.fn());
    expect(cache.delete).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
    expect(cache.put).toHaveBeenCalledOnce();
  });
  it('can operate when persistent storage is denied', async () => {
    setup();
    vi.stubGlobal('caches', { open: vi.fn(async () => { throw new Error('Denied'); }) });
    expect((await loadFiles(model, vi.fn())).persistent).toBe(false);
  });
  it('can operate when the cache quota is exhausted', async () => {
    const { cache } = setup();
    cache.put.mockRejectedValue(new Error('Quota exceeded'));
    expect((await loadFiles(model, vi.fn())).persistent).toBe(false);
  });
  it('rejects bad downloads without caching them', async () => {
    const { cache } = setup();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"test":null}')));
    await expect(loadFiles(model, vi.fn())).rejects.toThrow('完整性校验失败');
    expect(cache.put).not.toHaveBeenCalled();
  });
  it('reports network failure and allows a subsequent retry', async () => {
    const { fetch } = setup();
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(loadFiles(model, vi.fn())).rejects.toThrow('Failed to fetch');
    expect((await loadFiles(model, vi.fn())).data['tokenizer.json']).toEqual({ test: true });
  });
  it('rejects HTTP errors and oversized responses', async () => {
    setup();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Unavailable', { status: 503 })));
    await expect(loadFiles(model, vi.fn())).rejects.toThrow('HTTP 503');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x'.repeat(100))));
    await expect(loadFiles(model, vi.fn())).rejects.toThrow('超出预期大小');
  });
});
