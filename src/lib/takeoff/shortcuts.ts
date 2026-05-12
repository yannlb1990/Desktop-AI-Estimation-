import type { ToolType } from './types';

/** Single-key → tool map (lowercased). */
export const TOOL_SHORTCUT_MAP: Readonly<Record<string, ToolType>> = {
  v: 'select',
  h: 'pan',
  e: 'eraser',
  l: 'line',
  r: 'rectangle',
  p: 'polygon',
  c: 'circle',
  n: 'count',
};

/** Resolve a keyboard event key to the matching tool, or null. Case-insensitive. */
export function shortcutToTool(key: string): ToolType | null {
  if (!key || key.length !== 1) return null;
  return TOOL_SHORTCUT_MAP[key.toLowerCase()] ?? null;
}

/**
 * Guard: should a keyboard shortcut fire in the current focus context?
 * Returns false when focus is inside a text input, textarea, select, or
 * contenteditable — so typing in label fields never switches tools.
 */
export function shouldHandleShortcut(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return true;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;
  if (target.isContentEditable) return false;
  return true;
}
