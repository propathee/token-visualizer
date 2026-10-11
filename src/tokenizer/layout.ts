import type { TokenizationResult } from './types';
import { visibleText } from './bytes';

export interface TokenPart { index: number; byteStart: number; byteEnd: number }
export interface TextUnit { text: string; byteStart: number; byteEnd: number; parts: TokenPart[]; emoji: boolean }
export interface TokenPage { unitStart: number; unitEnd: number; tokenStart: number; tokenEnd: number }
const encoder = new TextEncoder();
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
export const TOKEN_COLORS = ['#dceddf', '#e4e7f6', '#f4e1cd', '#dceef1', '#f1deea', '#edeccf'];
export const RAIL_COLORS = ['#75a685', '#949ccd', '#c79b6f', '#75aeb7', '#bc89aa', '#b1ad64'];

/** Build a monotone mapping from intact graphemes to the actual UTF-8 token
 * intervals. Never decode individual fragments into replacement characters. */
export function buildTextLayout(result: TokenizationResult): TextUnit[] {
  const units: TextUnit[] = [];
  let offset = 0;
  let index = 0;
  for (const { segment } of segmenter.segment(result.decoded)) {
    // CR/LF need independent line-layout behavior; unlike a glyph, they do not
    // need to be kept in an unbreakable visual box.
    for (const text of segment === '\r\n' ? ['\r', '\n'] : [segment]) {
      const end = offset + encoder.encode(text).length;
      const parts: TokenPart[] = [];
      while (index < result.tokens.length && result.tokens[index].byteEnd <= offset) index++;
      let cursor = index;
      while (cursor < result.tokens.length && result.tokens[cursor].byteStart < end) {
        const token = result.tokens[cursor];
        parts.push({ index: cursor, byteStart: Math.max(offset, token.byteStart), byteEnd: Math.min(end, token.byteEnd) });
        cursor++;
      }
      if (!parts.length || parts.reduce((sum, part) => sum + part.byteEnd - part.byteStart, 0) !== end - offset) {
        throw new Error('Token byte offsets do not cover the decoded text.');
      }
      const emoji = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(text);
      const previous = units.at(-1);
      // Ordinary text retains whole-token wrapping and one continuous color.
      // A shared grapheme is always a separate unit with one intact text node.
      if (parts.length === 1 && previous?.parts.length === 1 && previous.parts[0].index === parts[0].index) {
        previous.text += text;
        previous.byteEnd = end;
        previous.parts[0].byteEnd = end;
        previous.emoji ||= emoji;
      } else units.push({ text, byteStart: offset, byteEnd: end, parts, emoji });
      offset = end;
    }
  }
  if (offset !== (result.tokens.at(-1)?.byteEnd ?? 0)) throw new Error('Token bytes and decoded text have different lengths.');
  return units;
}

/** A page boundary must split neither a token nor a grapheme. A page can
 * exceed the target when a grapheme spans it (e.g. a long combining sequence). */
export function buildTokenPages(units: TextUnit[], target = 500): TokenPage[] {
  if (!Number.isInteger(target) || target < 1) throw new Error('Page size must be a positive integer.');
  const pages: TokenPage[] = [];
  let unitStart = 0;
  let tokenStart = 0;
  for (let i = 0; i < units.length; i++) {
    const tokenEnd = units[i].parts.at(-1)!.index + 1;
    const safe = i === units.length - 1 || units[i + 1].parts[0].index >= tokenEnd;
    if (safe && (tokenEnd - tokenStart >= target || i === units.length - 1)) {
      pages.push({ unitStart, unitEnd: i + 1, tokenStart, tokenEnd });
      unitStart = i + 1;
      tokenStart = tokenEnd;
    }
  }
  return pages;
}
/** Visual slices represent token membership, not byte size. Keep this separate
 * from TokenPart byte offsets, which remain the exact source of byte details. */
export function partPosition(unit: TextUnit, partIndex: number) {
  const count = unit.parts.length;
  const left = 100 * partIndex / count;
  const right = 100 * (partIndex + 1) / count;
  return { left, width: right - left };
}
export function unitGradient(unit: TextUnit, rail = false): string {
  const colors = rail ? RAIL_COLORS : TOKEN_COLORS;
  const stops = unit.parts.map((part, partIndex) => {
    const { left, width } = partPosition(unit, partIndex);
    return `${colors[part.index % colors.length]} ${left}% ${left + width}%`;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
}
export function displayText(text: string, whitespace: boolean): string {
  let output = '';
  for (const { segment } of segmenter.segment(text)) {
    // Preserve shaping controls inside a grapheme (ZWJ emoji, Indic conjuncts,
    // etc). An isolated invisible joiner is still escaped for inspection.
    if (/^[\p{Mark}\p{Format}]+$/u.test(segment)) {
      output += Array.from(segment, (char) => {
        const point = char.codePointAt(0)!;
        return point <= 0xffff ? `\\u${point.toString(16).padStart(4, '0')}` : `\\u{${point.toString(16)}}`;
      }).join('');
    } else output += visibleText(segment, whitespace, Array.from(segment).length > 1);
  }
  return output;
}
