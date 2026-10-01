/** Control clusters use the same spacing as the React Home ribbon. */
export const EDITOR_HOME_LAYOUT_CSS = `
@media (min-width: 768px) {
  [data-pptx-editor-chrome] [data-pptx-chrome="control-fragment"] { display: contents; }
  [data-pptx-editor-chrome] pptx-ui-select[variant="ribbon-icon"] {
    flex: none; width: 36px; min-width: 36px; max-width: 36px;
  }
  [data-pptx-editor-chrome]  :is([data-pptx-chrome="paragraph-controls"], [data-pptx-chrome="drawing-controls"], [data-pptx-chrome="arrange-controls"], [data-pptx-chrome="editing-controls"]) {
    display: flex; flex-wrap: nowrap; align-items: center; gap: 4px;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="list-controls"] {
    display: inline-flex; align-items: center; gap: 4px;
    border: 0; padding: 0; background: transparent;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] :is(
    [data-ribbon-control="home.paragraph.bullets"], [data-ribbon-control="home.paragraph.numbering"]
  ) { display: inline-flex; align-items: center; gap: 0; }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] :is(
    [data-ribbon-control="home.paragraph.bullets"], [data-ribbon-control="home.paragraph.numbering"]
  ) > button:first-child { width: 36px; height: 28px; border-radius: 3px; }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon"] [data-pptx-chrome="ribbon-content"] :is(
    [data-ribbon-control="home.paragraph.bullets"], [data-ribbon-control="home.paragraph.numbering"]
  ) [data-pptx-chrome="gallery-caret"] {
    box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
    width: 24px; min-width: 24px; height: 24px; min-height: 24px; padding: 0 2px;
    border: 0; border-radius: 0; background: transparent; color: var(--pptx-foreground); gap: normal; font-size: 12px; line-height: 16px;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] :is(
    [data-ribbon-control="home.paragraph.bullets"], [data-ribbon-control="home.paragraph.numbering"]
  ) [data-pptx-chrome="gallery-caret"] svg { width: 12px; height: 12px; }
  [data-pptx-editor-chrome] [data-pptx-chrome="home-content"] > .pptx-svelte-hometab-sep {
    width: 1px; height: 20px; align-self: center; margin: 0 4px;
    background: color-mix(in oklab, var(--pptx-border) 40%, transparent);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="order-controls"] {
    display: inline-flex; align-items: center; gap: 0; border: 0; padding: 0;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="drawing-controls"] [data-pptx-chrome="ribbon-inline-label"] { display: none; }
  [data-pptx-editor-chrome] [data-pptx-chrome="drawing-controls"] [data-ribbon-control="home.drawing.shapes"] { order: 1; }
  [data-pptx-editor-chrome] [data-pptx-chrome="drawing-controls"] [data-ribbon-control="home.drawing.arrange"] { order: 2; }
  [data-pptx-editor-chrome] [data-pptx-chrome="drawing-controls"] [data-ribbon-control="home.drawing.shapeFill"] { order: 3; }
  [data-pptx-editor-chrome] [data-pptx-chrome="drawing-controls"] [data-ribbon-control="home.drawing.shapeOutline"] { order: 4; }
  [data-pptx-editor-chrome] [data-pptx-chrome="drawing-controls"] [data-ribbon-control="home.drawing.quickStyles"] { order: 5; }
  [data-pptx-editor-chrome] [data-pptx-chrome="drawing-controls"] [data-ribbon-control="home.drawing.shapeEffects"] { order: 6; }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] [data-pptx-chrome="drawing-controls"] :is(
    [data-ribbon-control="home.drawing.shapeFill"], [data-ribbon-control="home.drawing.shapeOutline"]
  ) :is(button:first-child, button svg) { flex: none; }
  [data-pptx-editor-chrome] [data-pptx-chrome="drawing-controls"] :is(
    [data-ribbon-control="home.drawing.shapeFill"], [data-ribbon-control="home.drawing.shapeOutline"]
  ) > button:first-child,
  [data-pptx-editor-chrome] [data-pptx-chrome="drawing-controls"] :is(
    [data-ribbon-control="home.drawing.shapeFill"], [data-ribbon-control="home.drawing.shapeOutline"]
  ) > div:first-child > button:first-child {
    display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 28px;
    padding: 6px 10px; border: 0; border-radius: 3px; background: var(--pptx-muted);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="drawing-controls"] [data-pptx-chrome="color-swatch"] { display: none; }
  [data-pptx-editor-chrome] [data-pptx-chrome="drawing-controls"] :is(
    [data-ribbon-control="home.drawing.shapes"], [data-ribbon-control="home.drawing.arrange"]
  ) > button:first-child > svg:nth-of-type(2) { display: none; }
  [data-pptx-editor-chrome] [data-pptx-chrome="drawing-controls"] :is(
    [data-ribbon-control="home.drawing.quickStyles"], [data-ribbon-control="home.drawing.shapeEffects"]
  ) > button > svg:last-child { width: 16px; height: 16px; }
  [data-pptx-editor-chrome] [data-pptx-chrome="arrange-controls"] .pptx-rb-sep { display: none; }
  [data-pptx-editor-chrome] [data-pptx-chrome="arrange-controls"] [data-pptx-chrome="arrange-extras"] { display: contents; }
  [data-pptx-editor-chrome] [data-pptx-chrome="arrange-controls"] [data-ribbon-control="home.arrange.outlineWidth"] { order: 1; }
  [data-pptx-editor-chrome] [data-pptx-chrome="arrange-controls"] [data-pptx-chrome="order-controls"] { order: 2; }
  [data-pptx-editor-chrome] [data-pptx-chrome="arrange-controls"] :is(
    [data-ribbon-control="home.arrange.duplicate"], [data-ribbon-control="home.arrange.delete"]
  ) { order: 3; }
  [data-pptx-editor-chrome] [data-pptx-chrome="arrange-controls"] > [data-pptx-chrome="duplicate-controls"] { display: contents; }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] [data-ribbon-control="home.arrange.outlineWidth"] {
    box-sizing: border-box; flex: none; width: 52px; height: 26px; padding: 0 4px;
    border: 1px solid var(--pptx-border); border-radius: 3px; background: var(--pptx-muted);
    font-size: 11px; line-height: 16px; color: var(--pptx-foreground); text-align: center;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] [data-ribbon-control="home.arrange.outlineWidth"]:disabled { opacity: .4; }
  [data-pptx-editor-chrome] [data-ribbon-group="home.editing"][data-pptx-chrome="home-group"] { padding-right: 0; margin-right: 0; border-right: 0; }
  [data-pptx-editor-chrome] [data-pptx-chrome="list-controls"] > :is(
    [data-ribbon-control="home.paragraph.bullets"], [data-ribbon-control="home.paragraph.numbering"]
  ) > div { border: 0; }
}
`;
