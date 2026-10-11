// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelPicker } from '../src/model-picker';
import { setLanguage } from '../src/i18n';

let picker: ModelPicker;
const change = vi.fn();
const key = (value: string) => picker.trigger.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
const option = (id: string) => picker.menu.querySelector<HTMLElement>(`[data-model="${id}"]`)!;
beforeEach(() => {
  setLanguage('en'); change.mockClear();
  picker = new ModelPicker('deepseek-v4.1', change);
  document.body.replaceChildren(picker.root);
});
afterEach(() => { picker.dispose(); vi.unstubAllGlobals(); setLanguage('en'); });

describe('model picker', () => {
  it('opens all options with metadata and the current selection without loading anything', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    picker.trigger.click();
    expect(picker.trigger.getAttribute('aria-expanded')).toBe('true');
    expect(picker.menu.hidden).toBe(false);
    expect(picker.menu.querySelectorAll('[role="option"]')).toHaveLength(4);
    expect(option('glm-5.3').textContent).toContain('20.2 MB');
    expect(option('deepseek-v4.1').getAttribute('aria-selected')).toBe('true');
    expect(change).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('commits a click once and does not reload a model that is already selected', () => {
    picker.trigger.click(); option('glm-5.3').click();
    expect(picker.value).toBe('glm-5.3');
    expect(change).toHaveBeenCalledExactlyOnceWith('glm-5.3');
    expect(picker.trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(picker.trigger);
    picker.trigger.click(); option('glm-5.3').click();
    expect(change).toHaveBeenCalledOnce();
  });
  it('navigates with arrows, commits with Enter, and cancels with Escape', () => {
    picker.trigger.focus(); key('ArrowDown'); key('ArrowDown');
    expect(picker.trigger.getAttribute('aria-activedescendant')).toBe(option('glm-5.3').id);
    expect(picker.value).toBe('deepseek-v4.1');
    key('Enter'); expect(picker.value).toBe('glm-5.3');
    key(' '); key('End'); key('Escape');
    expect(picker.value).toBe('glm-5.3'); expect(change).toHaveBeenCalledOnce();
    expect(picker.menu.hidden).toBe(true);
  });
  it('supports Home/End, typeahead and Tab without trapping focus', () => {
    key('Enter'); key('End'); expect(picker.trigger.getAttribute('aria-activedescendant')).toBe(option('qwen3.8').id);
    key('Home'); expect(picker.trigger.getAttribute('aria-activedescendant')).toBe(option('deepseek-v4').id);
    key('g'); key('Enter'); expect(picker.value).toBe('glm-5.3');
    key('q'); key('Enter'); expect(picker.value).toBe('qwen3.8');
    key('ArrowUp'); key('Tab'); expect(picker.menu.hidden).toBe(true);
    expect(document.activeElement).toBe(picker.trigger);
  });
  it('dismisses on outside interaction and removes the portal on disposal', () => {
    picker.trigger.click();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(picker.menu.hidden).toBe(true);
    picker.trigger.click();
    picker.dispose();
    expect(document.getElementById(picker.menu.id)).toBeNull();
  });
  it('translates metadata while keeping the selected model and unique listbox IDs', () => {
    const another = new ModelPicker('qwen3.8', vi.fn());
    expect(another.menu.id).not.toBe(picker.menu.id); another.dispose();
    picker.trigger.click(); setLanguage('zh'); picker.translate();
    expect(picker.trigger.getAttribute('aria-label')).toBe('分词模型: DeepSeek V4.1');
    expect(option('glm-5.3').textContent).toContain('词表项');
    expect(picker.value).toBe('deepseek-v4.1');
  });
});
