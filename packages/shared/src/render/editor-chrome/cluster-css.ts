/** Joined controls retain their background when the individual actions are disabled. */
export const EDITOR_CLUSTER_CSS = `
@media (min-width: 768px) {
  [data-pptx-editor-chrome] [data-ribbon-group="home.clipboard"] > :first-child,
  [data-pptx-editor-chrome] [data-pptx-chrome="paragraph-controls"] [data-pptx-chrome="control-cluster"],
  [data-pptx-editor-chrome] [data-pptx-chrome="editing-controls"] [data-pptx-chrome="control-cluster"],
  [data-pptx-editor-chrome] [data-pptx-chrome="order-controls"],
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] :is(
    [data-ribbon-control="home.paragraph.bullets"], [data-ribbon-control="home.paragraph.numbering"]
  ) { background: var(--pptx-muted); border-radius: 3px; }
  [data-pptx-editor-chrome] [data-pptx-chrome="paragraph-controls"] [data-pptx-chrome="control-cluster"] {
    display: inline-flex; align-items: center; gap: 0; overflow: hidden;
  }
  [data-pptx-editor-chrome] :is([data-pptx-chrome="paragraph-controls"], [data-pptx-chrome="editing-controls"])
  [data-pptx-chrome="control-cluster"] > button { margin-right: 0; }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon"] [data-pptx-chrome="ribbon-content"] :is(
    [data-ribbon-control="home.paragraph.bullets"], [data-ribbon-control="home.paragraph.numbering"]
  ) [data-pptx-chrome="gallery-caret"] { padding: 0 2px; }
  [data-pptx-editor-chrome] [data-pptx-chrome="arrange-controls"] [data-pptx-chrome="distribute-controls"] > button {
    border-radius: 0; background: transparent; gap: normal;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] [data-ribbon-control="home.arrange.crop"]
  [data-pptx-ribbon-control="crop"] { gap: normal; }
  [data-pptx-editor-chrome] [data-pptx-chrome="drawing-controls"] :is(
    [data-ribbon-control="home.drawing.shapes"], [data-ribbon-control="home.drawing.arrange"]
  ) > button:first-child > svg:first-of-type { order: -1; }
}
`;
