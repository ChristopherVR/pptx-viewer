/**
 * Home ribbon buttons, drawn the way Office draws them: flat, transparent until hovered, small
 * rows or large glyph-over-caption commands. `R` is every Home control, shared or native.
 */
/** The repeated hook outranks the binding-level touch-target baselines (min-height: 24px). */
const R = '[data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"][data-pptx-chrome]';
const BTN = `${R} :is(
    button[data-ribbon-control^="home."],
    [data-ribbon-control^="home."] > button,
    [data-ribbon-control^="home."] > span > button,
    [data-pptx-chrome="control-cluster"] > button,
    [data-pptx-chrome$="-controls"] > button
  )`;
const LARGE = `${R} :is(button, [data-ribbon-control^="home."] > button, [data-pptx-chrome="control-cluster"] > button)[data-size="large"]`;

export const EDITOR_CONTROLS_CSS = `
@media (min-width: 768px) {
  [data-pptx-editor-chrome] [data-pptx-chrome="home-content"] { gap: 0; }
  ${R} [data-ribbon-control^="home."]:not(button, input, select, pptx-ui-select) {
    display: inline-flex; align-items: center; line-height: 16px;
  }
  ${BTN} {
    display: inline-flex; align-items: center; justify-content: center; flex: none;
    box-sizing: border-box; height: 24px; padding: 0 6px; min-width: 28px; width: auto;
    border: 0; border-radius: 4px; font-size: 12px; line-height: 16px; gap: 6px;
    color: var(--pptx-foreground); background: transparent; white-space: nowrap;
  }
  ${BTN}:disabled { opacity: 0.4; }
  ${BTN}:hover:not(:disabled) { background: var(--pptx-accent); }
  ${BTN}:active:not(:disabled) { background: color-mix(in oklab, var(--pptx-accent) 70%, var(--pptx-primary)); }
  ${BTN}[aria-pressed="true"] {
    background: color-mix(in oklab, var(--pptx-primary) 22%, transparent);
    box-shadow: inset 0 0 0 1px var(--pptx-primary);
  }
  ${BTN} svg { width: 16px; height: 16px; flex: none; }
  ${LARGE} {
    flex-direction: column; justify-content: flex-start; min-width: 48px; height: 66px; min-height: 66px;
    padding: 3px 6px; gap: 2px; line-height: 15px;
  }
  ${LARGE} svg { width: 32px; height: 32px; stroke-width: 1.35; }
  ${LARGE} svg.chev { width: 9px; height: 9px; margin-top: -1px; stroke-width: 2.2; }
  ${BTN} svg.chev { width: 10px; height: 10px; stroke-width: 2.2; }
  ${R} [data-pptx-chrome="font-controls"] { display: flex; align-items: center; gap: 4px; }
  ${R} [data-pptx-chrome="font-controls-fragment"] { display: contents; }
  ${R} [data-pptx-chrome="slides-controls"] { display: flex; align-items: flex-start; gap: 2px; }
  ${R} [data-pptx-chrome="slides-controls"] > [data-pptx-chrome="slides-buttons"] { display: contents; }
  /* Split buttons: the glyph and caption press the main action, the strip beneath opens the menu. */
  ${R} [data-pptx-chrome="split-button"] {
    position: relative; display: inline-flex; align-items: stretch; gap: 0; padding: 0; border: 0; background: transparent;
  }
  ${R} [data-pptx-chrome="split-button"]:has([data-size="large"]) { flex-direction: column; }
  ${R} button[data-pptx-chrome="split-main"][data-size="large"] { height: 52px; min-height: 52px; border-radius: 4px 4px 0 0; }
  ${R} button[data-pptx-chrome="split-caret"][data-size="caret"] {
    min-width: 0; height: 14px; min-height: 14px; padding: 0; border-radius: 0 0 4px 4px; align-self: stretch;
  }
  ${R} button[data-pptx-chrome="split-caret"][data-size="caret"] svg { width: 10px; height: 10px; stroke-width: 2.2; }
  ${R} [data-pptx-chrome="split-caret"]:not([data-size]) {
    min-width: 16px; padding: 0 2px; border-radius: 0 4px 4px 0; height: auto; align-self: stretch;
  }
  ${R} [data-pptx-chrome="split-caret"]:not([data-size]) svg { width: 10px; height: 10px; stroke-width: 2.2; }
}
`;
