const encoder = new TextEncoder();
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
export function textMetrics(text: string) {
  let characters = 0;
  for (const _ of segmenter.segment(text)) characters++;
  return { characters, codePoints: Array.from(text).length, bytes: encoder.encode(text).length };
}
