// Inverse of the GPT-2 ByteLevel alphabet. These characters are byte labels,
// not Unicode text: encoding a decoded replacement character would lose data.
const byteDecoder = new Map<string, number>();
const visible = [
  ...Array.from({ length: 94 }, (_, i) => i + 33),
  ...Array.from({ length: 12 }, (_, i) => i + 161),
  ...Array.from({ length: 82 }, (_, i) => i + 174),
];
visible.forEach((byte) => byteDecoder.set(String.fromCodePoint(byte), byte));
let extra = 256;
for (let byte = 0; byte < 256; byte++) {
  if (!visible.includes(byte)) byteDecoder.set(String.fromCodePoint(extra++), byte);
}
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
export function tokenBytes(piece: string, added: boolean): number[] {
  if (added) return Array.from(encoder.encode(piece));
  return Array.from(piece, (char) => {
    const byte = byteDecoder.get(char);
    if (byte === undefined) throw new Error('此 tokenizer 不是受支持的 ByteLevel 编码。');
    return byte;
  });
}
export function decodeBytes(bytes: number[]): { text: string; partial: boolean } {
  try {
    return { text: decoder.decode(new Uint8Array(bytes)), partial: false };
  } catch {
    return { text: `⟨${hexBytes(bytes)}⟩`, partial: true };
  }
}
export function hexBytes(bytes: number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}
export function visibleText(text: string, whitespace: boolean, preserveJoiners = false): string {
  // Preserve real line breaks, while making invisible controls inspectable.
  return text.replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]| /g, (char) => {
    if (preserveJoiners && (char === '\u200c' || char === '\u200d')) return char;
    if (char === ' ') return whitespace ? '·' : ' ';
    if (char === '\n') return whitespace ? '↵\n' : '\n';
    if (char === '\t') return whitespace ? '⇥\t' : '\t';
    if (char === '\r') return whitespace ? '␍' : '\r';
    return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
  });
}
