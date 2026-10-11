import { describe, expect, it } from 'vitest';
import { pieceText, pieceSegments } from '../src/tokenizer/pieces';
import { splitResult } from './layout-fixture';

describe('token piece labels', () => {
  it('preserves layout inside a token containing both whitespace and invalid UTF-8', () => {
    const token = splitResult(' \n😊', [4, 2]).tokens[0];
    expect(pieceSegments(token, true)).toEqual([{ text: '·', hex: false }, { text: '↵\n', hex: false }, { text: '⟨F0 9F⟩', hex: true }]);
    expect(pieceText(token, false)).toBe(' \n⟨F0 9F⟩');
    expect(token.bytes).toEqual([32, 10, 240, 159]);
  });
  it('shows the original hex bytes for incomplete UTF-8, unaffected by whitespace options', () => {
    const { tokens } = splitResult('龘😊', [2, 1, 3, 1]);
    for (const whitespace of [true, false]) {
      expect(tokens.map((token) => pieceText(token, whitespace))).toEqual(['⟨E9 BE⟩', '⟨98⟩', '⟨F0 9F 98⟩', '⟨8A⟩']);
    }
  });
  it('retains readable text and distinguishes a real replacement character from a byte fragment', () => {
    const { tokens } = splitResult('你好�', [6, 3]);
    expect(tokens.map((token) => pieceText(token, true))).toEqual(['你好', '�']);
    expect(tokens.every((token) => !token.partial)).toBe(true);
  });
  it('distinguishes line feed, CR, tab, literal escapes, and leading spaces', () => {
    const text = '\n\r\t\\n\\u200d hello';
    const { tokens } = splitResult(text, [1, 1, 1, 2, 6, 6]);
    expect(tokens.map((token) => pieceText(token, true))).toEqual(['↵\n', '␍', '⇥\t', '\\n', '\\u200d', '·hello']);
    expect(tokens.map((token) => pieceText(token, false)).join('')).toBe(text);
    expect(pieceText(tokens.at(-1)!, false)).toBe(' hello');
  });
  it('preserves a full emoji token but makes standalone joining or combining tokens visible', () => {
    const whole = splitResult('👩🏽‍💻', [15]);
    expect(pieceText(whole.tokens[0], true)).toBe('👩🏽‍💻');
    const parts = splitResult('👩🏽‍💻', [4, 4, 3, 4]);
    expect(parts.tokens.map((token) => pieceText(token, true))).toEqual(['👩', '🏽', '\\u200d', '💻']);
    const combined = splitResult('e\u0301', [1, 2]);
    expect(combined.tokens.map((token) => pieceText(token, true))).toEqual(['e', '\\u0301']);
  });
});
