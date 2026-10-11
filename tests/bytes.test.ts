import { describe, expect, it } from 'vitest';
import { decodeBytes, hexBytes, tokenBytes, visibleText } from '../src/tokenizer/bytes';

describe('lossless byte inspection', () => {
  it('inverts byte-level whitespace and non-ASCII tokens', () => {
    expect(tokenBytes('ĠhelloĉĊ', false)).toEqual([32, 104, 101, 108, 108, 111, 9, 10]);
    expect(decodeBytes(tokenBytes('ä½łå¥½', false))).toEqual({ text: '你好', partial: false });
  });
  it('preserves split UTF-8 bytes rather than re-encoding U+FFFD', () => {
    expect(decodeBytes([0xf0, 0x9f])).toEqual({ text: '⟨F0 9F⟩', partial: true });
    expect(decodeBytes([0x91, 0xa9])).toEqual({ text: '⟨91 A9⟩', partial: true });
    expect(decodeBytes([0xf0, 0x9f, 0x91, 0xa9])).toEqual({ text: '👩', partial: false });
    expect(decodeBytes([0xef, 0xbf, 0xbd])).toEqual({ text: '�', partial: false });
  });
  it('does not silently remove a BOM', () => {
    expect(decodeBytes([0xef, 0xbb, 0xbf]).text).toBe('\ufeff');
  });
  it('uses literal UTF-8 spelling for added tokens', () => {
    expect(tokenBytes('<｜image｜>', true)).toEqual(Array.from(new TextEncoder().encode('<｜image｜>')));
    expect(hexBytes([0, 9, 15, 255])).toBe('00 09 0F FF');
  });
  it('makes whitespace visible without deleting line breaks', () => {
    expect(visibleText('a b\t\n\r', true)).toBe('a·b⇥\t↵\n␍');
    expect(visibleText('a b\t\n\r', false)).toBe('a b\t\n\r');
    expect(visibleText('\u200d\x00', false)).toBe('\\u200d\\u0000');
  });
});
