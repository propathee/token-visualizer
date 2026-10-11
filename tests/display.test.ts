import { afterEach, describe, expect, it } from 'vitest';
import { textMetrics } from '../src/text-metrics';
import { fragmentContext } from '../src/tokenizer/fragment';
import { decodeBytes } from '../src/tokenizer/bytes';
import { diagnostic, getLanguage, setLanguage, t } from '../src/i18n';
import type { TokenizationResult } from '../src/tokenizer/types';

function resultFor(chunks: number[][]): TokenizationResult {
  let offset = 0;
  const tokens = chunks.map((bytes, id) => {
    const token = { id, piece: '', bytes, ...decodeBytes(bytes), byteStart: offset, byteEnd: offset + bytes.length, special: false };
    offset += bytes.length;
    return token;
  });
  return { tokens, decoded: new TextDecoder().decode(new Uint8Array(chunks.flat())), elapsedMs: 0, changed: false };
}
describe('character counts', () => {
  it.each([
    ['汉', 1, 1, 3], ['𠮷', 1, 1, 4], ['é', 1, 1, 2], ['e\u0301', 1, 2, 3],
    ['😊', 1, 1, 4], ['👩🏽‍💻', 1, 4, 15], ['A\nB', 3, 3, 3], ['', 0, 0, 0],
  ])('%s: distinguishes graphemes, code points, and UTF-8 bytes', (text, characters, codePoints, bytes) => {
    expect(textMetrics(text as string)).toEqual({ characters, codePoints, bytes });
  });
});
describe('split Unicode character context', () => {
  it('explains a Han character split into two tokens', () => {
    const result = resultFor([[0xe9, 0xbe], [0x98]]);
    for (const i of [0, 1]) expect(fragmentContext(result, i)).toEqual({ text: '龘', first: 0, last: 1 });
  });
  it('explains a supplementary Han character split into four tokens', () => {
    const result = resultFor([[0xf0], [0xa0], [0xae], [0xb7]]);
    for (const i of [0, 1, 2, 3]) expect(fragmentContext(result, i)).toEqual({ text: '𠮷', first: 0, last: 3 });
  });
  it('handles a fragment containing a full character and part of the next', () => {
    const result = resultFor([[65, 0xf0, 0x9f], [0x98, 0x8a], [66]]);
    expect(fragmentContext(result, 0)).toEqual({ text: 'A😊', first: 0, last: 1 });
    expect(fragmentContext(result, 1)).toEqual({ text: '😊', first: 0, last: 1 });
    expect(fragmentContext(result, 2)).toBeUndefined();
  });
});
describe('language selection', () => {
  afterEach(() => setLanguage('en'));
  it('defaults to English and translates live labels and progress', () => {
    expect(getLanguage()).toBe('en');
    expect(t('input')).toBe('Input text');
    expect(diagnostic('读取本地缓存')).toBe('Reading local cache');
    expect(diagnostic('tokenizer.json 完整性校验失败，请重试。')).toBe('tokenizer.json Integrity check failed. Retry.');
    setLanguage('zh');
    expect(t('input')).toBe('输入文本');
    expect(diagnostic('读取本地缓存')).toBe('读取本地缓存');
    expect(t('tokenAria', { index: 2, id: 100, text: 'test' })).toBe('第 2 个 token，ID 100，test');
  });
});
