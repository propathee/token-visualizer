import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ loadFiles: vi.fn(), createAdapter: vi.fn() }));
vi.mock('../src/tokenizer/cache', () => ({ loadFiles: mocks.loadFiles }));
vi.mock('../src/tokenizer/engine', () => ({ createAdapter: mocks.createAdapter }));
let worker: { onmessage: (event: { data: object }) => void; postMessage: ReturnType<typeof vi.fn> };
const result = { tokens: [], decoded: 'latest', changed: false, elapsedMs: 1 };
const assets = { data: { 'tokenizer.json': {}, 'tokenizer_config.json': {} }, persistent: true };
const send = (requestId: number, text: string) => worker.onmessage({ data: { type: 'encode', requestId, modelId: 'deepseek-v4', text } });
beforeEach(async () => {
  vi.resetModules();
  mocks.loadFiles.mockReset();
  mocks.createAdapter.mockReset();
  worker = { onmessage: () => {}, postMessage: vi.fn() };
  vi.stubGlobal('self', worker);
  await import('../src/tokenizer/worker');
});
afterEach(() => vi.unstubAllGlobals());

describe('worker request lifecycle', () => {
  it('coalesces input during loading and uses the latest request ID', async () => {
    let resolve!: (value: typeof assets) => void;
    mocks.loadFiles.mockReturnValue(new Promise((done) => { resolve = done; }));
    const encode = vi.fn(() => result);
    mocks.createAdapter.mockReturnValue({ encode });
    send(1, 'old');
    send(2, 'latest');
    resolve(assets);
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith({ type: 'result', requestId: 2, result, persistent: true }));
    expect(encode).toHaveBeenCalledExactlyOnceWith('latest');
    expect(mocks.loadFiles).toHaveBeenCalledOnce();
    send(3, 'next');
    expect(encode).toHaveBeenLastCalledWith('next');
    expect(mocks.loadFiles).toHaveBeenCalledOnce();
  });
  it('reports encoding failures with the correct ID instead of leaving the UI pending', async () => {
    mocks.loadFiles.mockResolvedValue(assets);
    mocks.createAdapter.mockReturnValue({ encode() { throw new Error('Unsupported text'); } });
    send(7, 'invalid');
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith({ type: 'error', requestId: 7, message: 'Unsupported text' }));
  });
  it('can retry a failed initialization', async () => {
    mocks.loadFiles.mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValue(assets);
    mocks.createAdapter.mockReturnValue({ encode: () => result });
    send(1, 'input');
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith({ type: 'error', requestId: 1, message: 'Network unavailable' }));
    send(2, 'input');
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith({ type: 'result', requestId: 2, result, persistent: true }));
  });
});
