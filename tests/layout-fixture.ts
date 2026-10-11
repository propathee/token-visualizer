import { decodeBytes } from '../src/tokenizer/bytes';
import type { TokenizationResult } from '../src/tokenizer/types';

export function splitResult(text: string, lengths: number[]): TokenizationResult {
  const all = new TextEncoder().encode(text);
  let offset = 0;
  const tokens = lengths.map((length, id) => {
    const bytes = Array.from(all.slice(offset, offset + length));
    const token = { id, piece: '', bytes, byteStart: offset, byteEnd: offset + length, special: false, ...decodeBytes(bytes) };
    offset += length;
    return token;
  });
  if (offset !== all.length) throw new Error('Invalid fixture lengths');
  return { tokens, decoded: text, changed: false, elapsedMs: 0 };
}
