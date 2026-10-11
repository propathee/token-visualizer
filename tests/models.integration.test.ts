import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAdapter } from '../src/tokenizer/engine';
import { models } from '../src/models';
import { buildTextLayout, buildTokenPages, displayText } from '../src/tokenizer/layout';
import reference from './reference.json';

const assetDirectory = process.env.TOKENIZER_TEST_DIR;
describe.skipIf(!assetDirectory)('official tokenizers match the independent Rust reference', () => {
  for (const model of models) {
    it(model.label, () => {
      const json = JSON.parse(readFileSync(join(assetDirectory!, `${model.id}-tokenizer.json`), 'utf8'));
      const config = JSON.parse(readFileSync(join(assetDirectory!, `${model.id}-tokenizer_config.json`), 'utf8'));
      const adapter = createAdapter(model.engine, json, config);
      const fixture = reference.models[model.id as keyof typeof reference.models];
      expect(model.revision).toBe(fixture.revision);
      for (const { text, ids, decoded } of fixture.cases) {
        const result = adapter.encode(text);
        expect(result.tokens.map((token) => token.id), JSON.stringify(text)).toEqual(ids);
        expect(result.decoded, JSON.stringify(text)).toBe(decoded);
        expect(result.changed).toBe(decoded !== text);
        const units = buildTextLayout(result);
        expect(units.map((unit) => unit.text).join('')).toBe(decoded);
        const pages = buildTokenPages(units, 3);
        expect(pages.flatMap((page) => Array.from({ length: page.tokenEnd - page.tokenStart }, (_, i) => i + page.tokenStart))).toEqual(ids.map((_, i) => i));
        for (const unit of units) {
          expect(unit.parts.reduce((sum, part) => sum + part.byteEnd - part.byteStart, 0)).toBe(new TextEncoder().encode(unit.text).length);
          if (unit.emoji && unit.text.includes('\u200d')) expect(displayText(unit.text, false)).toContain('\u200d');
        }
        const bytes = result.tokens.flatMap((token) => token.bytes);
        expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(new Uint8Array(bytes))).toBe(decoded);
        expect(result.tokens.at(-1)?.byteEnd ?? 0).toBe(bytes.length);
      }
    });
  }
});
