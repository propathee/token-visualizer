import { describe, expect, it } from 'vitest';
import { buildTextLayout, buildTokenPages, displayText, partPosition, unitGradient } from '../src/tokenizer/layout';
import { splitResult } from './layout-fixture';

const cases = ['龘', '𠮷', '😊', '👩🏽‍💻', '👨‍👩‍👧‍👦', '🏳️‍🌈', '🇨🇳', '1️⃣', '❤️', '🧑‍🦯‍➡️', 'e\u0301', 'क्‍ष', '가', 'العربية'];

describe('grapheme and byte mapping', () => {
  it.each(cases)('retains %s through every possible two-token byte split', (text) => {
    const bytes = new TextEncoder().encode(text);
    for (let split = 1; split < bytes.length; split++) {
      const result = splitResult(text, [split, bytes.length - split]);
      const units = buildTextLayout(result);
      expect(units.map((unit) => unit.text).join('')).toBe(text);
      let offset = 0;
      for (const unit of units) {
        for (const part of unit.parts) {
          expect(part.byteStart).toBe(offset);
          expect(part.byteEnd).toBeGreaterThan(part.byteStart);
          expect(part.byteStart).toBeGreaterThanOrEqual(result.tokens[part.index].byteStart);
          expect(part.byteEnd).toBeLessThanOrEqual(result.tokens[part.index].byteEnd);
          offset = part.byteEnd;
        }
      }
      expect(offset).toBe(bytes.length);
    }
  });
  it('splits a shared Han character equally while retaining the unequal byte ranges', () => {
    const result = splitResult('龘', [2, 1]);
    const snapshot = JSON.stringify(result);
    const [unit] = buildTextLayout(result);
    expect(unit.text).toBe('龘');
    expect(partPosition(unit, 0)).toEqual({ left: 0, width: 50 });
    expect(partPosition(unit, 1)).toEqual({ left: 50, width: 50 });
    expect(unit.parts.map(({ byteStart, byteEnd }) => [byteStart, byteEnd])).toEqual([[0, 2], [2, 3]]);
    expect(unitGradient(unit)).toBe('linear-gradient(to right, #dceddf 0% 50%, #e4e7f6 50% 100%)');
    expect(unitGradient(unit, true)).toBe('linear-gradient(to right, #75a685 0% 50%, #949ccd 50% 100%)');
    expect(JSON.stringify(result)).toBe(snapshot);
  });
  it('gives all seven emoji fragments equal widths with continuous coverage', () => {
    const [unit] = buildTextLayout(splitResult('👩🏽‍💻', [3, 1, 3, 1, 3, 3, 1]));
    const positions = unit.parts.map((_, index) => partPosition(unit, index));
    for (let index = 0; index < positions.length; index++) {
      expect(positions[index].width).toBeCloseTo(100 / 7);
      expect(positions[index].left).toBeCloseTo(index * 100 / 7);
      if (index) expect(positions[index - 1].left + positions[index - 1].width).toBe(positions[index].left);
    }
    expect(positions.at(-1)!.left + positions.at(-1)!.width).toBe(100);
    expect(unit.parts.map((part) => part.byteEnd - part.byteStart)).toEqual([3, 1, 3, 1, 3, 3, 1]);
  });
  it('uses local slice positions but original token colors after preceding tokens', () => {
    const units = buildTextLayout(splitResult('A龘', [1, 2, 1]));
    expect(partPosition(units[0], 0)).toEqual({ left: 0, width: 100 });
    expect(units[1].parts.map((part) => part.index)).toEqual([1, 2]);
    expect(unitGradient(units[1])).toBe('linear-gradient(to right, #e4e7f6 0% 50%, #f4e1cd 50% 100%)');
  });
  it('keeps a ZWJ emoji intact even when each component is a complete UTF-8 token', () => {
    const result = splitResult('👩🏽‍💻', [4, 4, 3, 4]);
    expect(result.tokens.every((token) => !token.partial)).toBe(true);
    const units = buildTextLayout(result);
    expect(units).toHaveLength(1);
    expect(units[0].parts).toHaveLength(4);
    expect(units[0].emoji).toBe(true);
    expect(displayText(units[0].text, true)).toBe('👩🏽‍💻');
  });
  it('handles tokens spanning the tail of one character and head of the next', () => {
    const units = buildTextLayout(splitResult('龘😊A', [2, 3, 3]));
    expect(units.map((unit) => unit.text)).toEqual(['龘', '😊', 'A']);
    expect(units.map((unit) => unit.parts.map((part) => part.index))).toEqual([[0, 1], [1, 2], [2]]);
  });
  it('coalesces ordinary token text without changing its boundaries', () => {
    const units = buildTextLayout(splitResult('Hello world', [5, 6]));
    expect(units.map((unit) => unit.text)).toEqual(['Hello', ' world']);
  });
  it('preserves empty text and rejects inconsistent byte offsets', () => {
    expect(buildTextLayout(splitResult('', []))).toEqual([]);
    const broken = splitResult('龘', [2, 1]);
    broken.tokens[1].byteStart++;
    expect(() => buildTextLayout(broken)).toThrow('byte offsets');
  });
  it('escapes standalone controls but preserves joining inside graphemes', () => {
    expect(displayText('👩🏽‍💻 क्‍ष e\u0301', false)).toBe('👩🏽‍💻 क्‍ष e\u0301');
    expect(displayText('\u200d\n\u202e', true)).toBe('\\u200d↵\n\\u202e');
    expect(displayText('a\r\nb\t', true)).toBe('a␍↵\nb⇥\t');
    expect(displayText('\u200d\u200d', false)).toBe('\\u200d\\u200d');
    expect(displayText('\ufe0f', false)).toBe('\\ufe0f');
  });
});

describe('pagination at safe token and grapheme boundaries', () => {
  it('extends a page rather than splitting or duplicating a shared character', () => {
    const units = buildTextLayout(splitResult('A𠮷B', [1, 1, 1, 1, 1, 1]));
    expect(buildTokenPages(units, 3)).toEqual([
      { unitStart: 0, unitEnd: 2, tokenStart: 0, tokenEnd: 5 },
      { unitStart: 2, unitEnd: 3, tokenStart: 5, tokenEnd: 6 },
    ]);
  });
  it('never duplicates a token shared by multiple display units', () => {
    const units = buildTextLayout(splitResult('龘😊A', [2, 3, 3]));
    expect(buildTokenPages(units, 1)).toEqual([{ unitStart: 0, unitEnd: 3, tokenStart: 0, tokenEnd: 3 }]);
  });
  it('retains every byte and character across a mixed long corpus', () => {
    const text = cases.join('\n').repeat(40);
    const result = splitResult(text, Array(new TextEncoder().encode(text).length).fill(1));
    const units = buildTextLayout(result);
    const pages = buildTokenPages(units, 17);
    expect(pages.map((page) => units.slice(page.unitStart, page.unitEnd).map((unit) => unit.text).join('')).join('')).toBe(text);
    expect(pages.flatMap((page) => Array.from({ length: page.tokenEnd - page.tokenStart }, (_, i) => i + page.tokenStart))).toEqual(result.tokens.map((_, i) => i));
  });
  it('preserves pathological long combining clusters at page boundaries', () => {
    const text = 'a' + '\u0301'.repeat(600);
    const units = buildTextLayout(splitResult(text, Array(new TextEncoder().encode(text).length).fill(1)));
    expect(units).toHaveLength(1);
    expect(buildTokenPages(units)).toHaveLength(1);
  });
});
