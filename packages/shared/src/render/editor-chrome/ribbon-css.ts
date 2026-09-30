export const EDITOR_RIBBON_CSS = `
@media (min-width: 768px) {
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon"] {
    background: color-mix(in oklab, var(--pptx-secondary) 50%, transparent);
    color: var(--pptx-foreground); border-bottom: 1px solid var(--pptx-border);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-primary"] {
    min-height: 32px; height: 32px; padding: 2px 6px; gap: 2px;
    border: 0; box-sizing: border-box;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-tabs"] {
    display: flex; align-items: center; height: 35px; min-height: 35px;
    gap: 0; padding: 0 4px; box-sizing: border-box;
    border-top: 0; border-bottom: 1px solid var(--pptx-border);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-tabs"] [role="tablist"] {
    gap: 0; padding: 0; border: 0;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-tab-scroll"] {
    display: flex; flex: 1; min-width: 0; overflow-x: auto; overflow-y: hidden;
    height: 35px; align-self: flex-start; align-items: flex-start; margin-bottom: -1px;
    padding: 0; gap: 0; border: 0; scrollbar-width: none;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-tabs"]:has([data-pptx-chrome="ribbon-tab-scroll"]) { overflow: visible; }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-tabs"] [role="tab"] {
    position: relative; height: 34px; padding: 8px 14px;
    border: 0; border-radius: 0; font-size: 12px; line-height: 18px;
    font-weight: 500; white-space: nowrap; background: transparent;
    color: var(--pptx-muted-foreground);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-tabs"] [role="tab"][aria-selected="true"] {
    color: var(--pptx-foreground);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-tabs"] [role="tab"]::after { content: none; }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-tabs"] [role="tab"][aria-selected="true"]::after {
    content: ""; position: absolute; bottom: -1px; left: 0; right: 0;
    height: 2.5px; background: var(--pptx-primary);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] {
    min-height: 82px; padding: 2px 4px; gap: 0; box-sizing: border-box;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-group-label"] {
    font-size: 9px; line-height: 9px; font-weight: 400;
    color: var(--pptx-muted-foreground); text-align: center;
  }
}
`;
