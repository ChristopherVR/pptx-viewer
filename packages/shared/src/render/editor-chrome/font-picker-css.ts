/** Reserve space for decimal sizes and long font names before selection changes. */
export const EDITOR_FONT_PICKER_CSS = `
@media (min-width: 768px) {
  [data-pptx-editor-chrome] [data-pptx-chrome="font-groups"] { display: contents; }
  [data-pptx-editor-chrome] [data-pptx-chrome="font-picker-controls"] {
    display: flex; align-items: center; gap: 4px;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="control-cluster"] {
    display: inline-flex; align-items: center; gap: 0; border: 0; padding: 0;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="font-controls"] [data-pptx-chrome="control-cluster"] {
    background: var(--pptx-muted); border-radius: 3px; overflow: hidden;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="font-controls"] :is(
    [data-ribbon-control^="home.font."] > div > button,
    [data-ribbon-control^="home.font."] > button,
    button[data-ribbon-control^="home.font."]
  ) { flex: none; box-sizing: border-box; height: 28px; width: 36px; padding: 6px 10px; gap: 6px; }
  [data-pptx-editor-chrome] [data-pptx-chrome="font-controls"] :is([data-ribbon-control$="Color"] > button:first-child, [data-ribbon-control$="Color"] > div:first-child > button:first-child, [data-ribbon-control$="Color"] > span:first-child > button:first-child) {
    width: 58px; flex-direction: row;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="font-controls"] [data-ribbon-control$="Color"] [data-pptx-chrome="color-swatch"] {
    box-sizing: border-box; display: block; width: 16px; height: 4px; margin: -2px 0 0;
    border: 0; border-radius: 2px; flex: none;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="font-controls"] [data-ribbon-control^="home.font."] > div > button {
    display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 3px;
    font-size: 12px; line-height: 16px; background: var(--pptx-muted); color: var(--pptx-foreground);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="font-controls"] [data-ribbon-control^="home.font."] > div > button:disabled { opacity: .4; }
  [data-pptx-editor-chrome] [data-pptx-chrome="font-controls"] [data-ribbon-control^="home.font."] > div > button svg { width: 16px; height: 16px; }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] :is(
    [data-ribbon-control="home.font.fontFamily"], [data-ribbon-control="home.font.fontSize"]
  ) {
    --pptx-editor-font-picker-width: 120px;
    box-sizing: border-box; flex: none; display: inline-flex; align-items: center; height: 28px;
    width: var(--pptx-editor-font-picker-width);
    min-width: var(--pptx-editor-font-picker-width);
    max-width: var(--pptx-editor-font-picker-width);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] [data-ribbon-control="home.font.fontSize"] {
    --pptx-editor-font-picker-width: 64px;
    font-variant-numeric: tabular-nums;
  }
}
`;
