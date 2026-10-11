import { getModel } from '../models';
import { loadFiles } from './cache';
import type { TokenizerAdapter } from './engine';
import type { WorkerRequest, WorkerResponse } from './types';

// Each visible result owns a worker. Switching models terminates the old worker
// (including any in-flight download), bounding memory and preventing stale output.
let current: { adapter: TokenizerAdapter; persistent: boolean } | undefined;
let loading: Promise<void> | undefined;
let latest: WorkerRequest | undefined;
function post(message: WorkerResponse) { self.postMessage(message); }
async function processLatest() {
  if (!latest) return;
  let activeRequestId = latest.requestId;
  try {
    if (!current) {
      if (!loading) {
        const model = getModel(latest.modelId);
        loading = (async () => {
          const [{ createAdapter }, { data, persistent }] = await Promise.all([
            import('./engine'),
            loadFiles(model, (loaded, total, phase) => {
              if (latest) post({ type: 'progress', requestId: latest.requestId, loaded, total, phase });
            }),
          ]);
          current = { adapter: createAdapter(model.engine, data['tokenizer.json'], data['tokenizer_config.json']), persistent };
        })();
      } else return;
      await loading;
    }
    if (!latest) return;
    const request = latest;
    activeRequestId = request.requestId;
    latest = undefined;
    const result = current!.adapter.encode(request.text);
    post({ type: 'result', requestId: request.requestId, result, persistent: current!.persistent });
  } catch (error) {
    post({ type: 'error', requestId: latest?.requestId ?? activeRequestId,
      message: error instanceof Error ? error.message : '分词失败，请重试。' });
    latest = undefined;
    loading = undefined;
  }
}
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  latest = event.data;
  void processLatest();
};
