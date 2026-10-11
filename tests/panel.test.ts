// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResultPanel } from '../src/panel';
import { setLanguage } from '../src/i18n';
import { splitResult } from './layout-fixture';
import type { WorkerRequest, WorkerResponse, TokenizationResult } from '../src/tokenizer/types';

class FakeWorker {
  static latest: FakeWorker;
  onmessage?: (event: MessageEvent<WorkerResponse>) => void;
  onerror?: () => void;
  request!: WorkerRequest;
  constructor() { FakeWorker.latest = this; }
  postMessage(request: WorkerRequest) { this.request = request; }
  terminate() {}
  respond(result: TokenizationResult) {
    this.onmessage?.({ data: { type: 'result', requestId: this.request.requestId, result, persistent: true } } as MessageEvent<WorkerResponse>);
  }
}
let panel: ResultPanel;
const clipboard = vi.fn(async () => {});
function render(result: TokenizationResult) {
  panel.invalidate(result.decoded);
  panel.encode();
  FakeWorker.latest.respond(result);
}
const one = (selector: string) => panel.root.querySelector<HTMLElement>(selector)!;
const all = (selector: string) => Array.from(panel.root.querySelectorAll<HTMLElement>(selector));
const hover = (index: number) => one(`[data-index="${index}"]`).dispatchEvent(new MouseEvent('mouseenter'));
beforeEach(() => {
  setLanguage('en');
  vi.stubGlobal('Worker', FakeWorker);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: clipboard } });
  clipboard.mockClear();
  panel = new ResultPanel('deepseek-v4.1', () => {});
  document.body.replaceChildren(panel.root);
});
afterEach(() => { panel.dispose(); vi.unstubAllGlobals(); setLanguage('en'); });

describe('shared character rendering and inspection', () => {
  it.each([
    ['龘', [2, 1]], ['𠮷', [1, 1, 1, 1]], ['👩🏽‍💻', [4, 4, 3, 4]], ['e\u0301', [1, 2]],
  ] as const)('renders %s once with independent token hit areas', (text, lengths) => {
    render(splitResult(text, [...lengths]));
    expect(one('.tokens').textContent).toBe(text);
    expect(all('.shared-glyph')).toHaveLength(1);
    expect(all('.token-slice')).toHaveLength(lengths.length);
    expect(all('.tokens [tabindex="0"]')).toHaveLength(1);
    expect(one('.token-rail').style.backgroundImage).toContain('linear-gradient');
    expect(all('.token-slice').reduce((sum, node) => sum + parseFloat(node.style.width), 0)).toBeCloseTo(100);
    all('.token-slice').forEach((node) => expect(parseFloat(node.style.width)).toBeCloseTo(100 / lengths.length));
    expect(all('.token-slice').map((node) => Number(node.dataset.index))).toEqual(lengths.map((_, i) => i));
  });
  it('previews the exact hovered slice, pins it, and ignores other hovered slices until unpinned', () => {
    render(splitResult('龘', [2, 1]));
    hover(0);
    expect(one('.token-literal').textContent).toBe('"⟨E9 BE⟩"');
    one('[data-index="0"]').click();
    hover(1);
    expect(one('.token-literal').textContent).toBe('"⟨E9 BE⟩"');
    expect(one('.inspector-hint').textContent).toContain('Pinned');
    one('.unpin').click();
    hover(1);
    expect(one('.token-literal').textContent).toBe('"⟨98⟩"');
    panel.root.dispatchEvent(new MouseEvent('mouseleave'));
    expect(one('.inspector-placeholder')).not.toBeNull();
  });
  it('offers larger detail buttons for narrow emoji slices', () => {
    render(splitResult('👩🏽‍💻', [4, 4, 3, 4]));
    one('[data-index="0"]').click();
    expect(all('.shared-choice')).toHaveLength(4);
    one('[data-member="2"]').click();
    expect(one('[data-index="2"]').getAttribute('aria-pressed')).toBe('true');
    expect(one('.token-literal').textContent).toBe(JSON.stringify('\u200d'));
    expect(one('.shared-context-glyph').textContent).toBe('👩🏽‍💻');
    expect(one('.shared-context-glyph').style.backgroundImage).toBe(one('.shared-token').style.backgroundImage);
    expect(one('.shared-context-glyph .token-rail').style.backgroundImage).toBe(one('.shared-token .token-rail').style.backgroundImage);
    expect(document.activeElement).toBe(one('[data-member="2"]'));
  });
  it('supports keyboard access to every slice and retains selection across language changes', () => {
    render(splitResult('𠮷', [1, 1, 1, 1]));
    one('[data-index="0"]').focus();
    one('[data-index="0"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(document.activeElement).toBe(one('[data-index="1"]'));
    one('[data-index="1"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    setLanguage('zh'); panel.translate();
    expect(one('[data-index="1"]').getAttribute('aria-pressed')).toBe('true');
    expect(one('.inspector-hint').textContent).toContain('已固定');
    expect(one('.shared-context-glyph').textContent).toBe('𠮷');
    one('[data-index="1"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(one('[data-index="1"]').getAttribute('aria-pressed')).toBe('false');
  });
  it('does not escape a complete ZWJ emoji when it is a single token', () => {
    render(splitResult('👩🏽‍💻', [15]));
    expect(one('.tokens').textContent).toBe('👩🏽‍💻');
    expect(all('.shared-token')).toHaveLength(0);
  });
  it('keeps normalized text, ID view, and clipboard output independent of the visualization', async () => {
    const result = splitResult('é', [1, 1]); result.changed = true;
    render(result);
    expect(one('.normalization-note').hidden).toBe(false);
    one('.view-tab:last-child').click();
    expect(one('.tokens').textContent).toBe('0 1 ');
    expect(all('.shared-token')).toHaveLength(0);
    one('.result-toolbar .text-button').click();
    expect(clipboard).toHaveBeenCalledWith('[0,1]');
  });
  it('extends pages through a shared glyph and resets details on page changes', () => {
    const text = 'A'.repeat(499) + '𠮷B';
    render(splitResult(text, Array(504).fill(1)));
    expect(one('.tokens').textContent).toBe('A'.repeat(499) + '𠮷');
    expect(one('.pager').textContent).toContain('1–503 / 504');
    one('[data-index="500"]').click();
    one('.pager button:last-child').click();
    expect(one('.tokens').textContent).toBe('B');
    expect(one('.pager').textContent).toContain('504–504 / 504');
    expect(one('.inspector-placeholder')).not.toBeNull();
  });
  it('renders literal markup as text', () => {
    panel.setWhitespace(false);
    const text = '<img src=x onerror=alert(1)>👩🏽‍💻';
    render(splitResult(text, Array(new TextEncoder().encode(text).length).fill(1)));
    expect(one('.tokens').textContent).toBe(text);
    expect(panel.root.querySelector('img')).toBeNull();
  });
});

describe('Text / Token pieces / IDs views', () => {
  const changeView = (view: string) => one(`[data-view="${view}"]`).click();
  it('keeps Text as the default and selects pieces even before a tokenizer is ready', () => {
    expect(one('[data-view="text"]').getAttribute('aria-pressed')).toBe('true');
    changeView('pieces');
    expect(one('[data-view="pieces"]').getAttribute('aria-pressed')).toBe('true');
    render(splitResult('龘', [2, 1]));
    expect(all('.token-piece').map((node) => node.textContent)).toEqual(['⟨E9 BE⟩', '⟨98⟩']);
    expect(all('.shared-token')).toHaveLength(0);
  });
  it('keeps token selection, data, count, and copied IDs across all views without retokenizing', () => {
    const result = splitResult('👩🏽‍💻', [3, 1, 3, 1, 3, 3, 1]);
    render(result);
    const snapshot = JSON.stringify(result);
    const post = vi.spyOn(FakeWorker.latest, 'postMessage');
    one('[data-index="1"]').click();
    for (const view of ['pieces', 'ids', 'text']) {
      changeView(view);
      expect(one('[data-index="1"]').getAttribute('aria-pressed')).toBe('true');
      expect(one('[data-index="1"]').tabIndex).toBe(0);
      expect(one('.inspector-hint').textContent).toContain('#2 · Pinned');
      expect(one('.token-count').textContent).toBe('7');
      one('.result-toolbar .text-button').click();
      expect(clipboard).toHaveBeenLastCalledWith('[0,1,2,3,4,5,6]');
      expect(all('.view-tab[aria-pressed="true"]')).toHaveLength(1);
      expect(one(`.view-tab[aria-pressed="true"]`).dataset.view).toBe(view);
    }
    expect(one('.tokens').textContent).toBe('👩🏽‍💻');
    expect(JSON.stringify(result)).toBe(snapshot);
    expect(post).not.toHaveBeenCalled();
  });
  it('supports preview, pinning, unpinning, and keyboard traversal in pieces', () => {
    render(splitResult('𠮷', [1, 1, 1, 1]));
    changeView('pieces');
    hover(2);
    expect(one('.token-literal').textContent).toBe('"⟨AE⟩"');
    one('[data-index="2"]').click();
    hover(0);
    expect(one('.inspector-hint').textContent).toContain('#3 · Pinned');
    one('.unpin').click();
    one('[data-index="2"]').focus();
    one('[data-index="2"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(document.activeElement).toBe(one('[data-index="3"]'));
    one('[data-index="3"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(one('.inspector-hint').textContent).toContain('#4 · Pinned');
  });
  it('keeps a selected non-first page aligned in all three views', () => {
    const text = 'A'.repeat(499) + '𠮷BC';
    render(splitResult(text, Array(505).fill(1)));
    one('.pager button:last-child').click();
    one('[data-index="504"]').click();
    for (const view of ['pieces', 'ids', 'text']) {
      changeView(view);
      expect(all('.tokens [data-index]').map((node) => node.dataset.index)).toEqual(['503', '504']);
      expect(one('.pager').textContent).toContain('504–505 / 505');
      expect(one('[data-index="504"]').getAttribute('aria-pressed')).toBe('true');
    }
    changeView('pieces');
    one('.pager button:first-child').click();
    expect(all('.token-piece')).toHaveLength(503);
    expect(all('.token-piece').slice(-4).map((node) => node.textContent)).toEqual(['⟨F0⟩', '⟨A0⟩', '⟨AE⟩', '⟨B7⟩']);
    expect(one('.inspector-placeholder')).not.toBeNull();
  });
  it('keeps pieces active through language changes, whitespace toggles, and fresh input', () => {
    render(splitResult(' a\n龘', [2, 1, 2, 1]));
    changeView('pieces');
    one('[data-index="2"]').click();
    setLanguage('zh'); panel.translate();
    expect(one('[data-view="pieces"]').textContent).toBe('分词片段');
    expect(one('[data-view="pieces"]').getAttribute('aria-pressed')).toBe('true');
    expect(one('[data-index="2"]').getAttribute('aria-pressed')).toBe('true');
    panel.setWhitespace(false);
    expect(all('.token-piece').map((node) => node.textContent)).toEqual([' a', '\n', '⟨E9 BE⟩', '⟨98⟩']);
    render(splitResult('Hi', [2]));
    expect(all('.token-piece').map((node) => node.textContent)).toEqual(['Hi']);
    expect(all('.tokens .selected')).toHaveLength(0);
  });
  it('uses a separate piece for each token even when one token spans two glyphs', () => {
    render(splitResult('龘😊A', [2, 3, 3]));
    expect(all('.tokens [data-index="1"]')).toHaveLength(2);
    changeView('pieces');
    expect(all('.token-piece')).toHaveLength(3);
    expect(all('.tokens [data-index="1"]')).toHaveLength(1);
    expect(one('[data-index="1"]').textContent).toBe('⟨98 F0 9F⟩');
  });
  it('renders HTML and special-token spellings literally in pieces', () => {
    const text = '<script>alert(1)</script><|endoftext|>';
    const result = splitResult(text, [25, 13]);
    result.tokens[1].special = true;
    render(result);
    changeView('pieces');
    expect(all('.token-piece').map((node) => node.textContent)).toEqual(['<script>alert(1)</script>', '<|endoftext|>']);
    expect(panel.root.querySelector('script')).toBeNull();
    one('[data-index="1"]').click();
    expect(one('.token-kind').textContent).toBe('Special token');
  });
});


describe('piece whitespace layout', () => {
  it('retains blank lines, indentation, tabs, and literal backslashes without adding tokens', () => {
    const text = 'if (x) {\n\tfoo();\n\n    bar();\n}\n\\n';
    const result = splitResult(text, Array(text.length).fill(1));
    render(result);
    one('[data-view="pieces"]').click();
    panel.setWhitespace(false);
    expect(one('.tokens').textContent).toBe(text);
    expect(all('.token-piece')).toHaveLength(result.tokens.length);
    panel.setWhitespace(true);
    expect(one('.tokens').textContent).toContain('↵\n⇥\t');
    expect(one('.tokens').textContent).toContain('↵\n↵\n····bar');
  });
  it('keeps a multiline partial token as one selectable token with inline whitespace and hex children', () => {
    const result = splitResult(' \n😊', [4, 2]);
    render(result);
    one('[data-view="pieces"]').click();
    panel.setWhitespace(false);
    expect(one('[data-index="0"]').textContent).toBe(' \n⟨F0 9F⟩');
    expect(all('.token-piece')).toHaveLength(2);
    expect(all('.piece-hex')).toHaveLength(2);
    one('.piece-hex').click();
    expect(one('.inspector-hint').textContent).toContain('#1 · Pinned');
    one('.result-toolbar .text-button').click();
    expect(clipboard).toHaveBeenCalledWith('[0,1]');
  });
});

describe('picker integration', () => {
  it('terminates the previous worker and sends the current input to the selected tokenizer', () => {
    render(splitResult('Hello', [5]));
    const previous = FakeWorker.latest;
    const terminate = vi.spyOn(previous, 'terminate');
    one('[role="combobox"]').click();
    document.querySelector<HTMLElement>('[role="listbox"] [data-model="glm-5.3"]')!.click();
    expect(terminate).toHaveBeenCalled();
    expect(FakeWorker.latest).not.toBe(previous);
    expect(FakeWorker.latest.request.modelId).toBe('glm-5.3');
    expect(FakeWorker.latest.request.text).toBe('Hello');
    expect(one('[role="combobox"]').textContent).toBe('GLM-5.3');
    FakeWorker.latest.respond(splitResult('Hello', [2, 3]));
    expect(one('.token-count').textContent).toBe('2');
  });
});


describe('recovery after failed cache deletion', () => {
  it('resumes interrupted loading with the same input and ignores the old worker', () => {
    panel.invalidate('Hello'); panel.encode();
    const oldWorker = FakeWorker.latest;
    panel.stop(); panel.resumePending();
    expect(FakeWorker.latest).not.toBe(oldWorker);
    expect(FakeWorker.latest.request.text).toBe('Hello');
    oldWorker.respond(splitResult('wrong', [5]));
    expect(one('.token-count').textContent).toBe('—');
    FakeWorker.latest.respond(splitResult('Hello', [2, 3]));
    expect(one('.token-count').textContent).toBe('2');
    expect(one('.tokens').textContent).toBe('Hello');
  });
  it('preserves an already computed result and does not start work for invalid or empty input', () => {
    render(splitResult('Hello', [5]));
    one('[data-index="0"]').click();
    const worker = FakeWorker.latest;
    panel.stop(); panel.resumePending();
    expect(FakeWorker.latest).toBe(worker);
    expect(one('[data-index="0"]').getAttribute('aria-pressed')).toBe('true');
    panel.invalidate('', undefined); panel.resumePending();
    expect(FakeWorker.latest).toBe(worker);
    panel.invalidate('too long', 'Input exceeds the limit'); panel.resumePending();
    expect(FakeWorker.latest).toBe(worker);
  });
});
