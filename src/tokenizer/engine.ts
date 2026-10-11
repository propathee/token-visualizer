import { Tokenizer } from '@huggingface/tokenizers';
import { decodeBytes, tokenBytes } from './bytes';
import type { TokenDetail, TokenizationResult } from './types';

export interface TokenizerAdapter {
  encode(text: string): TokenizationResult;
}
interface TokenizerJSON {
  model?: { type?: string };
  decoder?: { type?: string };
  added_tokens?: { id: number; content: string; special: boolean }[];
}
export function createAdapter(engine: string, json: TokenizerJSON, config: object): TokenizerAdapter {
  if (engine !== 'hf-byte-bpe' || json.model?.type !== 'BPE' || json.decoder?.type !== 'ByteLevel') {
    throw new Error('不支持此 tokenizer 格式，请为它添加独立的 adapter。');
  }
  const tokenizer = new Tokenizer(json, config);
  const added = new Map(json.added_tokens?.map((token) => [token.id, token]));
  return {
    encode(text) {
      const start = performance.now();
      const encoded = tokenizer.encode(text, { add_special_tokens: false });
      let byteOffset = 0;
      const tokens: TokenDetail[] = encoded.ids.map((id, index) => {
        const piece = encoded.tokens[index];
        const bytes = tokenBytes(piece, added.has(id));
        const decoded = decodeBytes(bytes);
        const token = {
          id, piece, ...decoded, bytes, byteStart: byteOffset,
          byteEnd: byteOffset + bytes.length, special: added.get(id)?.special ?? false,
        };
        byteOffset += bytes.length;
        return token;
      });
      const decoded = encoded.ids.length ? tokenizer.decode(encoded.ids, {
        skip_special_tokens: false,
        clean_up_tokenization_spaces: false,
      }) : '';
      return { tokens, decoded, changed: decoded !== text, elapsedMs: performance.now() - start };
    },
  };
}
