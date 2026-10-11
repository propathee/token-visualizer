import './style.css';
import { ResultPanel } from './panel';
import { getLanguage, setLanguage, t, type MessageKey } from './i18n';
import { textMetrics } from './text-metrics';
import { CACHE_NAME } from './tokenizer/cache';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="site-header">
    <a class="brand" href="./" data-label="home"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>Token Visualizer</a>
    <div class="header-actions"><div class="language-switch" role="group" data-label="language"><button type="button" class="language-option" data-language="en" lang="en" aria-label="English" aria-pressed="false">EN</button><button type="button" class="language-option" data-language="zh" lang="zh-CN" aria-label="中文" aria-pressed="false">中文</button></div><a class="source-link" href="https://github.com/propathee/token-visualizer" target="_blank" rel="noreferrer">GitHub ↗</a></div>
  </header>
  <main aria-label="Token Visualizer">
    <div class="options"><label class="checkbox-label"><input id="whitespace" type="checkbox" checked><span data-i18n="whitespace"></span></label><button id="compare" class="outline-button" aria-pressed="false"></button></div>
    <div class="workspace" id="workspace">
      <section class="input-panel">
        <div class="input-editor">
        <div class="input-heading"><label for="input" data-i18n="input"></label><button id="clear" class="text-button" disabled data-i18n="clear"></button></div>
        <textarea id="input" spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="input-note input-limit"></textarea>
        </div>
        <div class="input-stats"><span data-title="charactersHelp"><strong id="characters">0</strong> <span data-i18n="characters"></span></span><span data-title="codePointsHelp"><strong id="code-points">0</strong> <span data-i18n="codePoints"></span></span><span data-title="bytesHelp"><strong id="bytes">0</strong> UTF-8 bytes</span></div>
        <p id="input-limit" class="input-limit" role="status" hidden></p>
        <div class="input-note" id="input-note"><span class="privacy-dot" aria-hidden="true"></span><span data-i18n="privacy"></span></div>
      </section>
      <div class="results" id="results"></div>
    </div>
    <div class="reading-guide"><span class="color-legend" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span data-i18n="legend"></span><span class="whitespace-guide" data-i18n="whitespaceLegend"></span></div>
    <footer><span data-i18n="scope"></span><details><summary data-i18n="about"></summary><div class="about-content"><p data-i18n="aboutCache"></p><p data-i18n="aboutBytes"></p><p data-i18n="aboutScope"></p><p data-i18n="keyboardHelp"></p><button id="clear-cache" class="text-button" data-i18n="clearCache"></button><span id="cache-status" role="status"></span></div></details></footer>
  </main>`;

const input = document.querySelector<HTMLTextAreaElement>('#input')!;
const results = document.querySelector<HTMLDivElement>('#results')!;
const compare = document.querySelector<HTMLButtonElement>('#compare')!;
const whitespace = document.querySelector<HTMLInputElement>('#whitespace')!;
const clear = document.querySelector<HTMLButtonElement>('#clear')!;
let timer: ReturnType<typeof setTimeout>;
let valid = true;
const panels: ResultPanel[] = [];
const modelChanged = () => { if (!valid) updateInput(); };
function addPanel(model: string) {
  const panel = new ResultPanel(model, modelChanged);
  panel.setWhitespace(whitespace.checked);
  panels.push(panel);
  results.append(panel.root);
  return panel;
}
addPanel('deepseek-v4.1');
const format = new Intl.NumberFormat('en-US');
function updateInput() {
  clearTimeout(timer);
  const text = input.value;
  const metrics = textMetrics(text);
  valid = metrics.codePoints <= 100_000;
  document.querySelector('#characters')!.textContent = format.format(metrics.characters);
  document.querySelector('#code-points')!.textContent = format.format(metrics.codePoints);
  document.querySelector('#bytes')!.textContent = format.format(metrics.bytes);
  clear.disabled = !text;
  const limit = document.querySelector<HTMLParagraphElement>('#input-limit')!;
  limit.hidden = valid;
  limit.textContent = valid ? '' : t('limit');
  input.setAttribute('aria-invalid', String(!valid));
  panels.forEach((panel) => panel.invalidate(text, valid ? undefined : t('tooLong')));
  if (valid) timer = setTimeout(() => panels.forEach((panel) => panel.encode()), 180);
}
input.addEventListener('input', updateInput);
clear.addEventListener('click', () => { input.value = ''; updateInput(); input.focus(); });
whitespace.addEventListener('change', () => {
  panels.forEach((panel) => panel.setWhitespace(whitespace.checked));
  document.querySelector<HTMLElement>('.whitespace-guide')!.hidden = !whitespace.checked;
});
compare.addEventListener('click', () => {
  if (panels.length === 1) {
    const panel = addPanel('glm-5.3');
    panel.invalidate(input.value, valid ? undefined : t('tooLong'));
    if (valid) panel.encode();
  } else panels.pop()!.dispose();
  const active = panels.length === 2;
  document.querySelector('#workspace')!.classList.toggle('comparing', active);
  compare.setAttribute('aria-pressed', String(active));
  compare.textContent = t(active ? 'endCompare' : 'compare');
});
document.querySelector('#clear-cache')!.addEventListener('click', async () => {
  const status = document.querySelector('#cache-status')!;
  clearTimeout(timer);
  panels.forEach((panel) => panel.stop());
  try {
    await caches.delete(CACHE_NAME);
    cacheMessage = 'cacheCleared'; status.textContent = t(cacheMessage);
    panels.forEach((panel) => panel.cacheCleared());
  } catch {
    cacheMessage = 'cacheUnavailable'; status.textContent = t(cacheMessage);
    // Stopping workers prevents an in-flight download from repopulating a cache
    // being deleted. If deletion fails, resume any interrupted tokenization.
    panels.forEach((panel) => panel.resumePending());
  }
});

let cacheMessage: MessageKey | undefined;
function translateUI() {
  document.documentElement.lang = getLanguage() === 'en' ? 'en' : 'zh-CN';
  for (const [attribute, target] of [['data-i18n', 'text'], ['data-label', 'aria-label'], ['data-title', 'title']] as const) {
    document.querySelectorAll<HTMLElement>(`[${attribute}]`).forEach((node) => {
      const value = t(node.getAttribute(attribute) as MessageKey);
      if (target === 'text') node.textContent = value;
      else node.setAttribute(target, value);
    });
  }
  input.placeholder = t('placeholder');
  compare.textContent = t(panels.length === 2 ? 'endCompare' : 'compare');
  document.querySelector('#input-limit')!.textContent = valid ? '' : t('limit');
  if (cacheMessage) document.querySelector('#cache-status')!.textContent = t(cacheMessage);
  document.querySelectorAll<HTMLButtonElement>('[data-language]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.language === getLanguage()));
  });
  panels.forEach((panel) => panel.translate());
}
document.querySelectorAll<HTMLButtonElement>('[data-language]').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.language === getLanguage()) return;
    setLanguage(button.dataset.language === 'zh' ? 'zh' : 'en');
    translateUI();
  });
});
translateUI();
