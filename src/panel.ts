import { t, diagnostic } from './i18n';
import { fragmentContext } from './tokenizer/fragment';
import { ModelPicker } from './model-picker';
import { getModel, modelSize } from './models';
import { buildTextLayout, buildTokenPages, displayText, partPosition, unitGradient, type TextUnit, type TokenPage } from './tokenizer/layout';
import { pieceSegments } from './tokenizer/pieces';
import { hexBytes } from './tokenizer/bytes';
import type { TokenizationResult, WorkerResponse } from './tokenizer/types';

const PAGE_SIZE = 500;
const number = new Intl.NumberFormat('en-US');
function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export class ResultPanel {
  readonly root = element('section', 'result-panel');
  private worker?: Worker;
  private requestId = 0;
  private result?: TokenizationResult;
  private units: TextUnit[] = [];
  private pages: TokenPage[] = [];
  private inspectedUnit?: TextUnit;
  private text = '';
  private inputError?: string;
  private page = 0;
  private selected: number | null = null;
  private inspected: number | null = null;
  private statusText: () => string = () => t('emptyStatus');
  private view: 'text' | 'pieces' | 'ids' = 'text';
  private whitespace = true;
  private picker: ModelPicker;
  private count = element('span', 'token-count', '—');
  private meta = element('a', 'model-meta');
  private status = element('div', 'load-status', t('emptyStatus'));
  private progress = element('progress', 'download-progress');
  private tokens = element('div', 'tokens');
  private inspector = element('div', 'inspector');
  private notice = element('p', 'normalization-note');
  private pager = element('div', 'pager');
  private copy = element('button', 'text-button', t('copy'));
  private retry = element('button', 'retry-button', t('reload'));
  private textTab = element('button', 'view-tab active', t('textView'));
  private piecesTab = element('button', 'view-tab', t('piecesView'));
  private idsTab = element('button', 'view-tab', t('idsView'));
  private timer?: ReturnType<typeof setTimeout>;

  constructor(modelId: string, private onModelChange: () => void) {
    const heading = element('div', 'result-heading');
    const modelField = element('div', 'model-field');
    modelField.append(element('span', 'eyebrow', t('model')));
    this.picker = new ModelPicker(modelId, () => {
      this.stop(); this.updateMeta(); this.invalidate(this.text, this.inputError); this.encode(); this.onModelChange();
    });
    modelField.append(this.picker.root);
    const countBlock = element('div', 'count-block');
    countBlock.append(this.count, element('span', 'count-unit', 'tokens'));
    heading.append(modelField, countBlock);
    this.meta.target = '_blank';
    this.meta.rel = 'noreferrer';
    this.updateMeta();
    const subheading = element('div', 'result-subheading');
    subheading.append(this.meta);
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.progress.max = 1;
    this.progress.hidden = true;
    this.progress.setAttribute('aria-label', t('downloadProgress'));
    this.retry.hidden = true;
    this.retry.addEventListener('click', () => { this.stop(); this.invalidate(this.text, this.inputError); this.encode(); });
    const loading = element('div', 'loading-row');
    loading.append(this.status, this.retry);
    const toolbar = element('div', 'result-toolbar');
    const tabs = element('div', 'view-tabs');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', t('resultViews'));
    const views = [[this.textTab, 'text', 'textHelp'], [this.piecesTab, 'pieces', 'piecesHelp'], [this.idsTab, 'ids', 'idsHelp']] as const;
    for (const [button, mode, help] of views) {
      button.type = 'button';
      button.dataset.view = mode;
      button.title = t(help);
      button.setAttribute('aria-pressed', String(mode === this.view));
      tabs.append(button);
      button.addEventListener('click', () => {
        if (this.view === mode) return;
        this.view = mode;
        for (const [tab, value] of views) {
          tab.classList.toggle('active', value === mode);
          tab.setAttribute('aria-pressed', String(value === mode));
        }
        this.renderTokens();
        this.revealSelection();
      });
    }
    this.copy.disabled = true;
    this.copy.addEventListener('click', () => void this.copyIds());
    toolbar.append(tabs, this.copy);
    this.tokens.setAttribute('aria-label', t('resultLabel'));
    this.notice.hidden = true;
    const metadata = element('div', 'result-metadata');
    metadata.append(heading, subheading, loading, this.progress);
    const viewport = element('div', 'result-viewport');
    viewport.append(this.notice, this.tokens);
    this.root.append(metadata, toolbar, viewport, this.pager, this.inspector);
    this.renderEmpty();
    this.root.addEventListener('mouseleave', () => { if (this.selected === null) this.renderInspector(null); });
  }
  private updateMeta() {
    const model = getModel(this.picker.value);
    this.meta.href = `https://huggingface.co/${model.repo}/tree/${model.revision}`;
    this.meta.textContent = `${number.format(model.vocabSize)} ${t('vocabItems')} · ${modelSize(model)} MB ↗`;
    this.meta.title = `${t('source')}: ${model.repo}\n${t('revision')}: ${model.revision}`;
  }
  setWhitespace(value: boolean) { this.whitespace = value; this.renderTokens(); }
  invalidate(text: string, error?: string) {
    this.text = text;
    this.inputError = error;
    this.requestId++;
    this.result = undefined;
    this.units = []; this.pages = []; this.inspectedUnit = undefined;
    this.selected = null;
    this.page = 0;
    this.count.textContent = text ? '—' : '0';
    this.copy.disabled = true;
    this.notice.hidden = true;
    this.retry.hidden = true;
    this.progress.hidden = true;
    this.status.classList.remove('error');
    this.setStatus(() => error ? t('tooLong') : t(text ? 'waiting' : 'emptyStatus'));
    this.renderEmpty(error ? t('overLimit') : text ? t('preparing') : undefined);
    if (!text || error) this.stop();
  }
  encode() {
    if (!this.text || this.inputError) return;
    if (!this.worker) {
      this.worker = new Worker(new URL('./tokenizer/worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.receive(event.data);
      this.worker.onerror = () => this.showError('worker-start-error');
    }
    this.setStatus(() => t('encoding'));
    this.worker.postMessage({ type: 'encode', requestId: this.requestId, modelId: this.picker.value, text: this.text });
  }
  private receive(message: WorkerResponse) {
    if (message.requestId !== this.requestId) return;
    if (message.type === 'progress') {
      this.setStatus(() => `${diagnostic(message.phase)} · ${(message.loaded / 1_000_000).toFixed(1)} / ${(message.total / 1_000_000).toFixed(1)} MB`);
      this.progress.hidden = false;
      this.progress.value = message.loaded / message.total;
    } else if (message.type === 'error') this.showError(message.message);
    else {
      try {
        this.units = buildTextLayout(message.result);
        this.pages = buildTokenPages(this.units, PAGE_SIZE);
      } catch (error) {
        this.showError(error instanceof Error ? error.message : 'Invalid token byte mapping.');
        return;
      }
      this.result = message.result;
      this.count.textContent = number.format(message.result.tokens.length);
      this.setStatus(() => `${t('ready')} · ${message.result.elapsedMs.toFixed(1)} ms · ${t(message.persistent ? 'cached' : 'sessionCache')}`);
      this.progress.hidden = true;
      this.copy.disabled = false;
      this.notice.hidden = !message.result.changed;
      this.notice.textContent = t('normalization');
      this.renderTokens();
    }
  }
  private showError(message: string) {
    this.setStatus(() => `${message === 'worker-start-error' ? t('workerError') : diagnostic(message)} ${t('retryHelp')}`);
    this.status.classList.add('error');
    this.progress.hidden = true;
    this.retry.hidden = false;
    this.renderEmpty(t('errorTitle'));
    this.stop();
  }
  private renderEmpty(message = t('empty')) {
    this.tokens.classList.remove('ids-view', 'pieces-view');
    this.tokens.replaceChildren(element('p', 'empty-message', message));
    this.pager.replaceChildren();
    this.renderInspector(null);
  }
  private renderTokens() {
    if (!this.result) return;
    this.tokens.replaceChildren();
    this.tokens.classList.toggle('ids-view', this.view === 'ids');
    this.tokens.classList.toggle('pieces-view', this.view === 'pieces');
    const page = this.pages[this.page] ?? { tokenStart: 0, tokenEnd: 0, unitStart: 0, unitEnd: 0 };
    const fragment = document.createDocumentFragment();
    if (this.view !== 'text') {
      for (let index = page.tokenStart; index < page.tokenEnd; index++) {
        const token = this.result.tokens[index];
        const classes = `token color-${index % 6}${this.view === 'pieces' ? ` token-piece${token.partial ? ' byte-piece' : ''}` : ''}`;
        const node = element('span', classes);
        if (this.view === 'ids') node.textContent = String(token.id);
        else for (const segment of pieceSegments(token, this.whitespace)) {
          node.append(segment.hex ? element('span', 'piece-hex', segment.text) : document.createTextNode(segment.text));
        }
        this.bindToken(node, index, page);
        fragment.append(node);
        if (this.view === 'ids') fragment.append(' ');
      }
    } else {
      for (const unit of this.units.slice(page.unitStart, page.unitEnd)) {
        if (unit.parts.length === 1) {
          const index = unit.parts[0].index;
          const node = element('span', `token color-${index % 6}`, displayText(unit.text, this.whitespace));
          this.bindToken(node, index, page);
          fragment.append(node);
        } else {
          const node = element('span', `shared-token${unit.emoji ? ' shared-emoji' : ''}`);
          node.style.backgroundImage = unitGradient(unit);
          node.setAttribute('role', 'group');
          node.setAttribute('aria-label', t('sharedAria', { text: unit.text, count: unit.parts.length }));
          const glyph = element('span', 'shared-glyph', displayText(unit.text, this.whitespace));
          glyph.setAttribute('aria-hidden', 'true');
          const rail = element('span', 'token-rail');
          rail.style.backgroundImage = unitGradient(unit, true);
          rail.setAttribute('aria-hidden', 'true');
          node.append(glyph, rail);
          for (const [partIndex, part] of unit.parts.entries()) {
            const slice = element('span', 'token-slice');
            const { left, width } = partPosition(unit, partIndex);
            slice.style.left = `${left}%`;
            slice.style.width = `${width}%`;
            this.bindToken(slice, part.index, page, unit);
            node.append(slice);
          }
          fragment.append(node);
        }
      }
    }
    this.tokens.append(fragment);
    const first = this.tokens.querySelector<HTMLElement>('[data-index]');
    const entry = this.selected === null ? first : this.tokens.querySelector<HTMLElement>(`[data-index="${this.selected}"]`) ?? first;
    if (entry) entry.tabIndex = 0;
    if (!this.result.tokens.length) this.tokens.append(element('p', 'empty-message', t('noTokens')));
    this.renderPager(page.tokenStart, page.tokenEnd);
    this.renderInspector(this.selected ?? this.inspected);
  }
  private revealSelection() {
    const viewport = this.root.querySelector<HTMLElement>('.result-viewport')!;
    viewport.scrollTop = 0;
    if (this.selected === null) return;
    const node = this.tokens.querySelector<HTMLElement>(`[data-index="${this.selected}"]`);
    if (!node) return;
    const frame = viewport.getBoundingClientRect();
    const target = node.getBoundingClientRect();
    if (frame.height <= 0) return;
    // Scroll only the output region; do not move the whole page or tab focus.
    if (target.height > frame.height - 16) viewport.scrollTop += target.top - frame.top - 8;
    else if (target.bottom > frame.bottom - 8) viewport.scrollTop += target.bottom - frame.bottom + 8;
  }
  private bindToken(node: HTMLElement, index: number, page: TokenPage, unit?: TextUnit) {
    const token = this.result!.tokens[index];
    node.dataset.index = String(index);
    node.setAttribute('role', 'button');
    node.tabIndex = -1;
    node.setAttribute('aria-pressed', String(index === this.selected));
    node.setAttribute('aria-label', t('tokenAria', { index: index + 1, id: token.id, text: token.partial ? t('fragment') + ' ' + hexBytes(token.bytes) : JSON.stringify(token.text) }));
    node.classList.toggle('selected', index === this.selected);
    const preview = () => {
      if (this.selected === null) { this.inspectedUnit = unit; this.renderInspector(index); }
    };
    const rove = (target: HTMLElement) => {
      this.tokens.querySelectorAll<HTMLElement>('[tabindex="0"]').forEach((other) => { other.tabIndex = -1; });
      target.tabIndex = 0;
    };
    node.addEventListener('mouseenter', preview);
    node.addEventListener('focus', preview);
    node.addEventListener('click', () => { rove(node); this.pin(index, unit); });
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.pin(index, unit); }
      if (event.key === 'Escape') {
        this.selected = null; this.inspectedUnit = unit; this.updateSelection(); this.renderInspector(index);
      }
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? page.tokenStart : event.key === 'End' ? page.tokenEnd - 1 : Math.max(page.tokenStart, Math.min(page.tokenEnd - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)));
        const target = this.tokens.querySelector<HTMLElement>(`[data-index="${next}"]`);
        if (target) { rove(target); target.focus(); }
      }
    });
  }
  private pin(index: number, unit?: TextUnit) {
    this.selected = this.selected === index ? null : index;
    this.inspectedUnit = unit;
    this.updateSelection();
    this.renderInspector(index);
  }
  private updateSelection() {
    this.tokens.querySelectorAll<HTMLElement>('[data-index]').forEach((node) => {
      const active = Number(node.dataset.index) === this.selected;
      node.classList.toggle('selected', active);
      node.setAttribute('aria-pressed', String(active));
    });
  }
  private renderPager(start: number, end: number) {
    this.pager.replaceChildren();
    const total = this.result?.tokens.length ?? 0;
    if (this.pages.length <= 1) return;
    const previous = element('button', 'text-button', t('previous'));
    const next = element('button', 'text-button', t('next'));
    previous.disabled = this.page === 0;
    next.disabled = end >= total;
    const change = (delta: number) => {
      this.page += delta; this.selected = null; this.inspected = null; this.inspectedUnit = undefined; this.renderTokens();
      this.root.querySelector('.result-viewport')!.scrollTop = 0;
    };
    previous.onclick = () => change(-1);
    next.onclick = () => change(1);
    this.pager.append(previous, element('span', '', `${start + 1}–${end} / ${number.format(total)}`), next);
  }
  private renderInspector(index: number | null) {
    this.inspected = index;
    if (index === null) this.inspectedUnit = undefined;
    this.inspector.replaceChildren();
    const title = element('div', 'inspector-title');
    title.append(element('span', 'eyebrow', t('details')));
    const token = index === null ? undefined : this.result?.tokens[index];
    title.append(element('span', 'inspector-hint', token ? `#${index! + 1} · ${t(this.selected === null ? 'previewHint' : 'pinnedHint')}` : t('hoverHint')));
    if (this.selected !== null) {
      const unpin = element('button', 'text-button unpin', t('unpin'));
      unpin.onclick = () => { this.selected = null; this.updateSelection(); this.renderInspector(null); };
      title.append(unpin);
    }
    this.inspector.append(title);
    if (!token) {
      this.inspector.append(element('p', 'inspector-placeholder', t('inspectPlaceholder')));
      return;
    }
    const content = element('div', 'inspector-content');
    const unit = this.inspectedUnit;
    if (unit && unit.parts.length > 1) {
      const context = element('div', 'shared-controls');
      context.title = t('sharedHelp');
      const enlarged = element('span', 'shared-context-glyph', displayText(unit.text, false));
      enlarged.style.backgroundImage = unitGradient(unit);
      const rail = element('span', 'token-rail');
      rail.style.backgroundImage = unitGradient(unit, true);
      rail.setAttribute('aria-hidden', 'true');
      enlarged.append(rail);
      context.append(enlarged);
      const choices = element('div', 'shared-choices');
      choices.setAttribute('role', 'group');
      choices.setAttribute('aria-label', t('shared'));
      for (const part of unit.parts) {
        const id = this.result!.tokens[part.index].id;
        const choice = element('button', `shared-choice color-${part.index % 6}`, `#${part.index + 1}`);
        choice.type = 'button';
        choice.dataset.member = String(part.index);
        choice.title = `ID ${id}`;
        choice.setAttribute('aria-label', t('memberAria', { index: part.index + 1, id }));
        choice.setAttribute('aria-pressed', String(part.index === index));
        choice.onclick = () => {
          this.selected = part.index; this.inspectedUnit = unit;
          this.updateSelection(); this.renderInspector(part.index);
          this.inspector.querySelector<HTMLElement>(`[data-member="${part.index}"]`)?.focus({ preventScroll: true });
        };
        choices.append(choice);
      }
      context.append(choices);
      content.append(context);
    }
    const top = element('div', 'inspector-summary');
    top.append(element('code', 'token-literal', JSON.stringify(token.text)), element('span', 'token-kind', token.special ? t('special') : token.partial ? t('fragment') : t('textView')));
    content.append(top);
    const grid = element('dl', 'detail-grid');
    const field = (label: string, value: string, help?: string) => {
      const row = element('div', 'detail-field');
      const term = element('dt', '', label);
      if (help) term.title = help;
      row.append(term, element('dd', '', value));
      grid.append(row);
    };
    field('ID', String(token.id));
    field(t('length'), `${token.bytes.length} ${token.bytes.length === 1 ? 'byte' : 'bytes'}`);
    field('Bytes', token.bytes.join(' '));
    field('Hex', hexBytes(token.bytes));
    field(t('byteRange'), `[${token.byteStart}, ${token.byteEnd})`, t('byteRangeHelp'));
    field(t('vocabPiece'), token.piece, t('vocabPieceHelp'));
    content.append(grid);
    if (token.partial) {
      const context = fragmentContext(this.result!, index!);
      if (context && !unit) content.append(element('p', 'fragment-context', `${t('reconstructed')}: ${JSON.stringify(context.text)} · ${t('tokens')} #${context.first + 1}–${context.last + 1}`));
      if (!unit) content.append(element('p', 'fragment-note', t('fragmentNote')));
    }
    if (token.special) content.append(element('p', 'fragment-note', t('specialNote')));
    this.inspector.append(content);
  }
  private async copyIds() {
    if (!this.result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(this.result.tokens.map((token) => token.id)));
      this.copy.textContent = t('copied');
    } catch { this.copy.textContent = t('copyFailed'); }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.copy.textContent = t('copy'); }, 1800);
  }
  private setStatus(render: () => string) { this.statusText = render; this.status.textContent = render(); }
  translate() {
    this.root.querySelector('.model-field .eyebrow')!.textContent = t('model');
    this.picker.translate();
    this.progress.setAttribute('aria-label', t('downloadProgress'));
    this.root.querySelector('.view-tabs')!.setAttribute('aria-label', t('resultViews'));
    this.tokens.setAttribute('aria-label', t('resultLabel'));
    this.textTab.textContent = t('textView');
    this.piecesTab.textContent = t('piecesView');
    this.idsTab.textContent = t('idsView');
    this.textTab.title = t('textHelp');
    this.piecesTab.title = t('piecesHelp');
    this.idsTab.title = t('idsHelp');
    this.copy.textContent = t('copy');
    this.retry.textContent = t('reload');
    this.notice.textContent = t('normalization');
    this.status.textContent = this.statusText();
    this.updateMeta();
    if (this.result) this.renderTokens();
    else this.renderEmpty(this.inputError ? t('overLimit') : this.status.classList.contains('error') ? t('errorTitle') : this.text ? t('preparing') : t('empty'));
  }
  resumePending() {
    if (!this.result && this.text && !this.inputError) {
      this.retry.hidden = true;
      this.status.classList.remove('error');
      this.encode();
    }
  }
  cacheCleared() {
    this.stop();
    this.progress.hidden = true;
    this.setStatus(() => t('cacheState'));
    this.retry.hidden = !this.text || Boolean(this.inputError);
  }
  stop() { this.requestId++; this.worker?.terminate(); this.worker = undefined; }
  dispose() { this.picker.dispose(); this.requestId++; this.stop(); clearTimeout(this.timer); this.root.remove(); }
}
