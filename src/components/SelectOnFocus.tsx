"use client";

import { useEffect } from "react";

const TEXTLIKE = new Set(["text", "search", "email", "tel", "url", "number"]);

const selectable = (el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement =>
  (el instanceof HTMLInputElement && TEXTLIKE.has(el.type) && !el.readOnly && !el.disabled) ||
  (el instanceof HTMLTextAreaElement && !el.readOnly && !el.disabled);

/**
 * App-wide: focusing any text box (by click, Tab or script) selects all of its text,
 * so typing replaces the value — like a spreadsheet cell.
 */
export function SelectOnFocus() {
  useEffect(() => {
    let fresh: EventTarget | null = null;

    const onFocusIn = (e: FocusEvent) => {
      if (!selectable(e.target)) return;
      const el = e.target;
      fresh = el;
      el.select();
      // Some browsers re-place the caret after focus; select again on the next frame.
      requestAnimationFrame(() => document.activeElement === el && el.select());
      setTimeout(() => (fresh = null), 250);
    };
    // The mouseup that finishes the focusing click would collapse the selection — swallow it once.
    const onMouseUp = (e: MouseEvent) => {
      if (fresh && e.target === fresh) {
        e.preventDefault();
        fresh = null;
      }
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("mouseup", onMouseUp, true);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("mouseup", onMouseUp, true);
    };
  }, []);
  return null;
}
