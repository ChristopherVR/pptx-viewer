export const EDITOR_INSPECTOR_CSS = `
@media (min-width: 768px) {
  [data-pptx-editor-chrome] [data-pptx-chrome="inspector"] {
    background: var(--pptx-background); color: var(--pptx-foreground);
    font-size: 12px; line-height: 18px; border-left: 1px solid var(--pptx-border);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="inspector-header"] {
    display: flex; align-items: center; gap: 4px;
    padding: 8px; border-bottom: 1px solid var(--pptx-border);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="inspector-tabs"] {
    display: flex; gap: 2px; padding: 2px; border: 0; border-radius: 4px;
    background: color-mix(in oklab, var(--pptx-muted) 50%, transparent);
    flex: 1; min-width: 0;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="inspector-tabs"] button {
    display: inline-flex; align-items: center; justify-content: center;
    gap: 4px; padding: 4px; min-height: 28px; border: 0; border-radius: 2px;
    font-size: 11px; line-height: 16.5px; font-weight: 500;
    background: transparent; color: var(--pptx-muted-foreground);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="inspector-tabs"] svg { width: 14px; height: 14px; flex: none; }
  [data-pptx-editor-chrome] [data-pptx-chrome="inspector-header"] > button { flex: none; width: 28px; height: 28px; }
  [data-pptx-editor-chrome] [data-pptx-chrome="inspector-tabs"] button[aria-selected="true"] {
    background: var(--pptx-primary); color: var(--pptx-primary-foreground);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="inspector-body"] { padding: 12px 10px; }
  [data-pptx-editor-chrome] [data-pptx-chrome="deck-properties"] {
    display: flex; flex-direction: column; gap: 12px;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="deck-properties"] > * { margin: 0; }
  [data-pptx-editor-chrome] :is([data-pptx-chrome="inspector-card"], .pptx-editor-card) {
    border: 1px solid var(--pptx-border); border-radius: 4px;
    padding: 8px; background: var(--pptx-card); font-size: 12px; line-height: 18px;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="inspector"] [data-pptx-chrome="deck-properties"] :is([data-pptx-chrome="inspector-card"], .pptx-editor-card) {
    padding: 8px; border: 1px solid var(--pptx-border);
  }
  [data-pptx-editor-chrome] :is([data-pptx-chrome="inspector-heading"], .pptx-editor-heading) {
    margin: 0 0 8px; font-size: 11px; line-height: 16.5px; font-weight: 400;
    letter-spacing: 0.275px; text-transform: uppercase; color: var(--pptx-muted-foreground);
  }
  [data-pptx-editor-chrome] .pptx-editor-presentation-card { display: block; }
  [data-pptx-editor-chrome] [data-pptx-chrome="presentation-fields"] {
    display: grid; gap: 6px; font-size: 11px; line-height: 18px;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="presentation-fields"] > * {
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px; padding: 0; margin: 0; font-size: 11px; line-height: 18px;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="presentation-fields"] > * > span { flex-shrink: 0; order: 0; }
  [data-pptx-editor-chrome] [data-pptx-chrome="presentation-fields"] pptx-ui-checkbox { order: 1; }
  [data-pptx-editor-chrome] [data-pptx-chrome="presentation-fields"] pptx-ui-select {
    flex: none; width: 112px; height: 28px; min-height: 28px;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="presentation-fields"] input[type="number"] {
    width: 64px; height: 22.5px; min-height: 22.5px;
  }
  [data-pptx-editor-chrome] :is([data-pptx-chrome="inspector-card"], .pptx-editor-card) :is(input:not([type="checkbox"]):not([type="color"]), select) {
    box-sizing: border-box; max-width: 100%; border: 1px solid var(--pptx-border);
    border-radius: 4px; padding: 2px 6px; font-size: 11px; line-height: 16.5px;
    background: var(--pptx-muted); color: var(--pptx-foreground);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="theme-editor"] {
    position: absolute; right: 0; top: 0; z-index: 30; width: 288px; height: 100%;
    box-sizing: border-box; overflow-y: auto; padding: 10px;
    background: var(--pptx-card); color: var(--pptx-foreground);
    border-left: 1px solid var(--pptx-border); box-shadow: -8px 0 24px rgb(0 0 0 / 15%);
  }
}
@media (max-width: 767px) {
  [data-pptx-editor-chrome] [data-pptx-chrome="theme-editor"] {
    position: absolute; inset: auto 0 0; z-index: 30; width: 100%; max-height: 60%;
    box-sizing: border-box; overflow-y: auto; padding: 10px;
    border-top: 1px solid var(--pptx-border); border-radius: 12px 12px 0 0;
    background: var(--pptx-card); color: var(--pptx-foreground);
  }
}
`;
