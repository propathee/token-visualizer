import { fileUrl, type ModelDefinition, type ModelFile } from '../models';
export const CACHE_NAME = 'token-visualizer-assets-v1';
export type Progress = (loaded: number, total: number, phase: string) => void;

async function verify(data: ArrayBuffer, file: ModelFile) {
  if (data.byteLength !== file.bytes) throw new Error(`${file.name} 文件大小不匹配，请重试。`);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)),
    (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== file.sha256) throw new Error(`${file.name} 完整性校验失败，请重试。`);
}

export async function loadFiles(model: ModelDefinition, progress: Progress) {
  let cache: Cache | undefined;
  let persistent = true;
  try { cache = await caches.open(CACHE_NAME); } catch { persistent = false; }
  const total = model.files.reduce((sum, file) => sum + file.bytes, 0);
  let loaded = 0;
  const data: Record<string, object> = {};
  for (const file of model.files) {
    const url = fileUrl(model, file);
    let buffer: ArrayBuffer | undefined;
    try {
      const cached = await cache?.match(url);
      if (cached) {
        const candidate = await cached.arrayBuffer();
        await verify(candidate, file);
        buffer = candidate;
      }
    } catch {
      // A corrupt or evicted cache must never turn into an incorrect result.
      await cache?.delete(url).catch(() => undefined);
    }
    if (buffer) {
      loaded += buffer.byteLength;
      progress(loaded, total, '读取本地缓存');
    } else {
      progress(loaded, total, '下载分词器');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`下载失败（HTTP ${response.status}）`);
        const reader = response.body?.getReader();
        if (!reader) throw new Error('浏览器不支持流式下载。');
        const chunks: Uint8Array[] = [];
        let length = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > file.bytes) {
            await reader.cancel();
            throw new Error('下载文件超出预期大小。');
          }
          chunks.push(value);
          progress(loaded + length, total, '下载分词器');
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        buffer = bytes.buffer;
        await verify(buffer, file);
        loaded += length;
        try {
          if (cache) await cache.put(url, new Response(buffer, { headers: { 'Content-Type': 'application/json' } }));
        } catch { persistent = false; }
      } finally { clearTimeout(timeout); }
    }
    data[file.name] = JSON.parse(new TextDecoder().decode(buffer));
  }
  progress(total, total, '初始化分词器');
  return { data, persistent };
}
