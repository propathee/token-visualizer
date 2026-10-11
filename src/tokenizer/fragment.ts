import type { TokenizationResult } from './types';

const encoder = new TextEncoder();

// Expand a fragment's byte range to whole Unicode code points. This is an
// explanation of shared character bytes, not a new token or a guessed decode.
export function fragmentContext(result: TokenizationResult, index: number) {
  const token = result.tokens[index];
  if (!token?.partial) return undefined;
  let offset = 0;
  let start = token.byteStart;
  let end = token.byteEnd;
  let text = '';
  for (const char of result.decoded) {
    const next = offset + encoder.encode(char).length;
    if (offset < token.byteEnd && next > token.byteStart) {
      start = Math.min(start, offset);
      end = Math.max(end, next);
      text += char;
    }
    offset = next;
    if (offset >= token.byteEnd) break;
  }
  const first = result.tokens.findIndex((part) => part.byteEnd > start);
  let last = first;
  while (last + 1 < result.tokens.length && result.tokens[last + 1].byteStart < end) last++;
  return { text, first, last };
}
