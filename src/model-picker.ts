import { getModel, models, modelSize } from './models';
import { t } from './i18n';

let nextId = 0;
/** Select-only combobox. The popup uses the top layer so panel overflow never
 * clips options; a positioned fallback also makes it usable without Popover. */
export class ModelPicker {
  readonly root = document.createElement('div');
  readonly trigger = document.createElement('button');
  readonly menu = document.createElement('div');
  private label = document.createElement('span');
  private options: HTMLDivElement[] = [];
  private current: string;
  private active = 0;
  private opened = false;
  private typeBuffer = '';
  private typeTimer?: ReturnType<typeof setTimeout>;
  private outside = (event: PointerEvent) => {
    if (!this.root.contains(event.target as Node) && !this.menu.contains(event.target as Node)) this.close(false);
  };
  private scroll = (event: Event) => { if (!this.menu.contains(event.target as Node)) this.close(false); };
  private resize = () => { if (this.opened) this.position(); };

  constructor(value: string, private onChange: (value: string) => void) {
    getModel(value);
    this.current = value;
    this.root.className = 'model-picker';
    this.trigger.type = 'button';
    this.trigger.className = 'model-trigger';
    this.trigger.setAttribute('role', 'combobox');
    this.trigger.setAttribute('aria-haspopup', 'listbox');
    this.trigger.setAttribute('aria-expanded', 'false');
    this.label.className = 'model-trigger-label';
    const arrow = document.createElement('span');
    arrow.className = 'model-chevron'; arrow.setAttribute('aria-hidden', 'true');
    this.trigger.append(this.label, arrow);
    this.root.append(this.trigger);
    this.menu.id = `model-list-${++nextId}`;
    this.menu.className = 'model-menu';
    this.menu.setAttribute('role', 'listbox');
    this.menu.setAttribute('popover', 'auto');
    this.menu.hidden = true;
    this.trigger.setAttribute('aria-controls', this.menu.id);
    models.forEach((model, index) => {
      const option = document.createElement('div');
      option.className = 'model-option';
      option.id = `${this.menu.id}-${index}`;
      option.dataset.model = model.id;
      option.setAttribute('role', 'option');
      const title = document.createElement('span'); title.className = 'model-option-name'; title.textContent = model.label;
      const detail = document.createElement('span'); detail.className = 'model-option-detail';
      const check = document.createElement('span'); check.className = 'model-option-check'; check.textContent = '✓'; check.setAttribute('aria-hidden', 'true');
      option.append(title, detail, check);
      option.addEventListener('pointermove', () => this.activate(index, false));
      option.addEventListener('click', () => this.commit(index));
      this.options.push(option); this.menu.append(option);
    });
    // Virtual focus stays on the combobox for keyboard / screen-reader users.
    this.menu.addEventListener('pointerdown', (event) => event.preventDefault());
    this.trigger.addEventListener('click', () => this.opened ? this.close(true) : this.open());
    this.trigger.addEventListener('keydown', (event) => this.keydown(event));
    this.menu.addEventListener('toggle', (event) => {
      if ((event as ToggleEvent).newState === 'closed') this.close(false);
    });
    document.addEventListener('pointerdown', this.outside);
    window.addEventListener('scroll', this.scroll, true);
    window.addEventListener('resize', this.resize);
    this.translate();
  }
  get value() { return this.current; }
  translate() {
    const model = getModel(this.current);
    this.label.textContent = model.label;
    this.trigger.title = model.label;
    this.trigger.setAttribute('aria-label', `${t('model')}: ${model.label}`);
    this.menu.setAttribute('aria-label', t('model'));
    this.options.forEach((option, index) => {
      const item = models[index];
      option.setAttribute('aria-selected', String(item.id === this.current));
      option.querySelector('.model-option-detail')!.textContent = `${new Intl.NumberFormat('en-US').format(item.vocabSize)} ${t('vocabItems')} · ${modelSize(item)} MB`;
    });
    if (this.opened) this.position();
  }
  private position() {
    const anchor = this.trigger.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const width = Math.min(Math.max(300, anchor.width), viewportWidth - 24);
    this.menu.style.width = `${width}px`;
    this.menu.style.left = `${Math.max(12, Math.min(anchor.left, viewportWidth - width - 12))}px`;
    const wanted = this.menu.scrollHeight || 256;
    const below = window.innerHeight - anchor.bottom - 20;
    const above = anchor.top - 20;
    const useAbove = below < Math.min(wanted, 220) && above > below;
    const available = Math.max(40, useAbove ? above : below);
    this.menu.style.maxHeight = `${available}px`;
    this.menu.style.top = `${useAbove ? Math.max(12, anchor.top - Math.min(wanted, available) - 8) : anchor.bottom + 8}px`;
  }
  private activate(index: number, scroll: boolean) {
    this.active = Math.max(0, Math.min(models.length - 1, index));
    this.options.forEach((option, i) => option.classList.toggle('option-active', i === this.active));
    this.trigger.setAttribute('aria-activedescendant', this.options[this.active].id);
    if (scroll) this.options[this.active].scrollIntoView?.({ block: 'nearest' });
  }
  private open() {
    if (this.opened) return;
    document.body.append(this.menu);
    this.menu.hidden = false;
    this.opened = true;
    this.trigger.setAttribute('aria-expanded', 'true');
    try {
      if (typeof this.menu.showPopover === 'function') this.menu.showPopover();
      else this.menu.removeAttribute('popover');
    } catch { this.menu.removeAttribute('popover'); }
    this.position();
    this.activate(models.findIndex((model) => model.id === this.current), false);
  }
  close(focus: boolean) {
    if (!this.opened) return;
    this.opened = false;
    clearTimeout(this.typeTimer); this.typeBuffer = '';
    try { this.menu.hidePopover?.(); } catch { /* fallback / already dismissed */ }
    this.menu.hidden = true;
    this.trigger.setAttribute('aria-expanded', 'false');
    this.trigger.removeAttribute('aria-activedescendant');
    if (focus) this.trigger.focus({ preventScroll: true });
  }
  private commit(index: number) {
    const next = models[index].id;
    const changed = this.current !== next;
    this.current = next;
    this.translate();
    this.close(true);
    if (changed) this.onChange(next);
  }
  private keydown(event: KeyboardEvent) {
    if (event.key === 'Tab') { this.close(false); return; }
    if (event.key === 'Escape') { event.preventDefault(); this.close(true); return; }
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!this.opened) { this.open(); return; }
      if (event.key === 'Enter' || event.key === ' ') this.commit(this.active);
      else this.activate(event.key === 'Home' ? 0 : event.key === 'End' ? models.length - 1 : this.active + (event.key === 'ArrowDown' ? 1 : -1), true);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); this.open();
      this.typeBuffer += event.key.toLocaleLowerCase();
      clearTimeout(this.typeTimer);
      this.typeTimer = setTimeout(() => { this.typeBuffer = ''; }, 700);
      const match = models.findIndex((model) => model.label.toLocaleLowerCase().startsWith(this.typeBuffer));
      if (match >= 0) this.activate(match, true);
    }
  }
  dispose() {
    this.close(false); clearTimeout(this.typeTimer); this.menu.remove();
    document.removeEventListener('pointerdown', this.outside);
    window.removeEventListener('scroll', this.scroll, true);
    window.removeEventListener('resize', this.resize);
  }
}
