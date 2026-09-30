export const EDITOR_CONTROLS_CSS = `
@media (min-width: 768px) {
  [data-pptx-editor-chrome] [data-pptx-chrome="home-content"] { gap: 0; }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] [data-ribbon-group^="home."] { gap: 2px; }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"]
  [data-ribbon-control^="home."]:not(button, input, select, pptx-ui-select) {
    display: inline-flex; align-items: center; line-height: 16px;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="home-group"] {
    gap: 2px; padding: 0 4px 0 0; margin-right: 4px;
    border-right: 1px solid color-mix(in oklab, var(--pptx-border) 40%, transparent);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] :is(
    button[data-ribbon-control^="home."],
    [data-ribbon-control^="home."] > button,
    [data-ribbon-control^="home."] > span > button
  ) {
    display: inline-flex; align-items: center; justify-content: center;
    box-sizing: border-box; height: 28px; padding: 6px 10px; min-width: 0; width: auto;
    border: 0; border-radius: 3px; font-size: 12px; line-height: 16px;
    color: var(--pptx-foreground); background: var(--pptx-muted); gap: 6px;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] :is(
    button[data-ribbon-control^="home."], [data-ribbon-control^="home."] > button
  ):disabled { opacity: 0.4; }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] :is(
    button[data-ribbon-control^="home."], [data-ribbon-control^="home."] > button
  ):hover:not(:disabled) { background: var(--pptx-accent); }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] :is(
    button[data-ribbon-control^="home."], [data-ribbon-control^="home."] > button
  )[aria-pressed="true"] { background: var(--pptx-accent); }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] :is(
    button[data-ribbon-control^="home."], [data-ribbon-control^="home."] > button
  ) svg { width: 16px; height: 16px; flex: none; }
  [data-pptx-editor-chrome] [data-pptx-chrome="font-controls"] {
    display: flex; align-items: center; gap: 4px;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="font-controls-fragment"] { display: contents; }
  [data-pptx-editor-chrome] [data-ribbon-group="home.clipboard"] > :first-child { gap: 0; }
  [data-pptx-editor-chrome] [data-pptx-chrome="slides-controls"] {
    display: flex; align-items: center; gap: 4px;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="slides-controls"] > [data-pptx-chrome="slides-buttons"] { display: contents; }
  [data-pptx-editor-chrome] [data-pptx-chrome="split-button"] {
    position: relative; display: inline-flex; align-items: center; gap: 0;
    padding: 0; border: 0; border-radius: 3px; background: transparent;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="split-segment"] {
    display: inline-flex; align-items: center; padding: 0; border: 0; border-radius: 0;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] [data-pptx-chrome="split-button"]:has([data-pptx-chrome="split-caret"]:not([hidden])) [data-pptx-chrome="split-main"] {
    border-top-right-radius: 0; border-bottom-right-radius: 0;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon"] [data-pptx-chrome="ribbon-content"] [data-pptx-chrome="split-main"] {
    display: inline-flex; align-items: center; justify-content: center;
    height: 28px; padding: 6px 10px; gap: 6px; border: 0; border-radius: 3px; font-size: 12px; line-height: 16px;
    background: var(--pptx-muted); color: var(--pptx-foreground);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon"] [data-pptx-chrome="ribbon-content"] [data-pptx-chrome="split-caret"] {
    display: inline-flex; align-items: center; justify-content: center;
    box-sizing: border-box; height: 28px; width: 36px; min-width: 36px; max-width: 36px;
    padding: 6px 8px; margin: 0; border: 0; border-radius: 0 3px 3px 0;
    font-size: 12px; line-height: 16px; background: var(--pptx-muted); color: var(--pptx-foreground);
    border-left: 1px solid color-mix(in oklab, var(--pptx-border) 40%, transparent);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="split-caret"] svg { display: block; flex: none; width: 16px; height: 16px; margin: 0; }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon"] [data-pptx-chrome="ribbon-content"] :is([data-pptx-chrome="split-main"], [data-pptx-chrome="split-caret"]):hover:not(:disabled) {
    background: var(--pptx-accent);
  }
}
`;
