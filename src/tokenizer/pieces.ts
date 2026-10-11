import type { TokenDetail } from './types';
import { displayText } from './layout';
import { hexBytes } from './bytes';

export interface PieceSegment { text: string; hex: boolean }
/** Keep actual whitespace in the text flow, including ASCII whitespace bundled
 * into a partially decodable token. All segments still belong to ONE token. */
export function pieceSegments(token: TokenDetail, whitespace: boolean): PieceSegment[] {
  if (!token.partial) return [{ text: displayText(token.text, whitespace), hex: false }];
  const segments: PieceSegment[] = [];
  let run: number[] = [];
  const flush = () => {
    if (run.length) { segments.push({ text: `⟨${hexBytes(run)}⟩`, hex: true }); run = []; }
  };
  for (const byte of token.bytes) {
    if (byte === 9 || byte === 10 || byte === 13 || byte === 32) {
      flush();
      segments.push({ text: displayText(String.fromCharCode(byte), whitespace), hex: false });
    } else run.push(byte);
  }
  flush();
  return segments;
}
export function pieceText(token: TokenDetail, whitespace: boolean): string {
  return pieceSegments(token, whitespace).map((segment) => segment.text).join('');
}
