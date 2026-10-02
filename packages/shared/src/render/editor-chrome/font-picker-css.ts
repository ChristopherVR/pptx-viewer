/** Reserve space for decimal sizes and long font names before selection changes. */
export const EDITOR_FONT_PICKER_CSS = `
@media (min-width: 768px) {
  [data-pptx-editor-chrome] [data-pptx-chrome="font-groups"] { display: contents; }
  /* Font and highlight colours: the glyph over its colour bar, as in Office. */
  [data-pptx-editor-chrome] [data-pptx-chrome="font-controls"] :is(
    [data-ribbon-control$="Color"] > button:first-child, [data-ribbon-control$="Color"] > div:first-child > button:first-child,
    [data-ribbon-control$="Color"] > span:first-child > button:first-child
  ) {
    flex-direction: column; justify-content: center; width: 28px; min-width: 28px; padding: 0; gap: 1px;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="font-controls"] [data-ribbon-control$="Color"] [data-pptx-chrome="color-swatch"] {
    box-sizing: border-box; display: block; width: 16px; height: 4px; margin: 0;
    border: 0; border-radius: 1px; flex: none;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="font-controls"] [data-ribbon-control^="home.font."] > button { padding: 0; min-width: 28px; }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] :is(
    [data-ribbon-control="home.font.fontFamily"], [data-ribbon-control="home.font.fontSize"]
  ) {
    --pptx-editor-font-picker-width: 120px;
    box-sizing: border-box; flex: none; display: inline-flex; align-items: center; height: 24px;
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
