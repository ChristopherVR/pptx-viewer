/** Semantic hooks keep this stylesheet independent of framework class names. */
export const EDITOR_LAYOUT_CSS = `
[data-pptx-editor-chrome] [data-pptx-chrome][hidden] { display: none !important; }
@media (min-width: 768px) {
  [data-pptx-editor-chrome] [data-pptx-title-bar] {
    background: color-mix(in oklab, var(--pptx-secondary) 80%, transparent);
    border-bottom-color: color-mix(in oklab, var(--pptx-border) 60%, transparent);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="body"] {
    position: relative; display: flex; flex: 1; min-width: 0; min-height: 0;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="body"] [data-pptx-viewport] {
    background: var(--pptx-background);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="slides"] {
    flex-shrink: 0; min-width: 0; box-sizing: border-box;
    background: color-mix(in oklab, var(--pptx-secondary) 30%, transparent);
    border-right: 1px solid var(--pptx-border);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="slide-footer"] {
    padding: 6px 8px; border-top: 1px solid color-mix(in oklab, var(--pptx-border) 60%, transparent);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="slide-footer"] > button {
    width: 100%; display: flex; justify-content: center; align-items: center;
    gap: 4px; padding: 4px 8px; font-size: 11px; line-height: 16.5px;
    border: 0; background: transparent; color: var(--pptx-muted-foreground);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="notes"] {
    flex: none; width: 100%; margin: 0; box-sizing: border-box;
    border-top: 1px solid color-mix(in oklab, var(--pptx-border) 60%, transparent);
    background: var(--pptx-background);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="notes-host"] {
    padding: 0; border: 0; background: transparent;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="notes-header"] {
    display: flex; align-items: center; gap: 6px; width: 100%;
    box-sizing: border-box; padding: 4px 12px; min-height: 24.5px;
    border: 0; background: transparent; color: var(--pptx-muted-foreground);
    font-size: 11px; line-height: 16.5px; font-weight: 500;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="notes-header"] svg { width: 12px; height: 12px; }
  [data-pptx-editor-chrome] [data-pptx-chrome="notes-header"]:hover { color: var(--pptx-foreground); }
}
`;
