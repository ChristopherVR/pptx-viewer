export const EDITOR_ARRANGE_CSS = `
@media (min-width: 768px) {
  [data-pptx-editor-chrome] [data-pptx-chrome="arrange-controls"] :is(
    [data-pptx-chrome="align-controls"], [data-pptx-chrome="distribute-controls"],
    [data-pptx-chrome="flip-controls"], [data-pptx-chrome="group-controls"]
  ) { display: inline-flex; flex: none; align-items: center; gap: 0; border: 0; padding: 0; background: var(--pptx-muted); border-radius: 3px; }
  [data-pptx-editor-chrome] [data-pptx-chrome="arrange-controls"] :is(
    [data-pptx-chrome="align-controls"], [data-pptx-chrome="distribute-controls"]
  ) > button {
    display: inline-flex; align-items: center; justify-content: center; flex: none;
    box-sizing: border-box; width: 36px; height: 28px; padding: 6px 10px;
    border: 0; border-radius: 3px; font-size: 12px; line-height: 16px; gap: 6px;
    color: var(--pptx-foreground); background: var(--pptx-muted);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="arrange-controls"] [data-pptx-chrome="distribute-controls"] > button:first-child { width: 37px; border-right: 1px solid var(--pptx-border); }
  [data-pptx-editor-chrome] [data-pptx-chrome="arrange-controls"] :is(
    [data-pptx-chrome="align-controls"], [data-pptx-chrome="distribute-controls"]
  ) > button:disabled { opacity: .4; }
  [data-pptx-editor-chrome] [data-pptx-chrome="arrange-controls"] :is(
    [data-pptx-chrome="align-controls"], [data-pptx-chrome="distribute-controls"]
  ) svg { width: 16px; height: 16px; flex: none; }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] [data-ribbon-control="home.arrange.crop"] {
    display: inline-flex; flex: none; align-items: center; gap: 0; border: 0; padding: 0;
    background: var(--pptx-muted); border-radius: 3px;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] [data-ribbon-control="home.arrange.crop"] [data-pptx-ribbon-control="crop"] {
    box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
    width: 37px; height: 28px; padding: 6px 10px; margin: 0;
    border: 0; border-right: 1px solid var(--pptx-border); border-radius: 0; background: transparent;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] [data-ribbon-control="home.arrange.crop"] [data-pptx-ribbon-control="crop-menu"] {
    box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
    width: 32px; height: 24px; min-height: 24px; padding: 6px 10px; margin: 0;
    border: 0; border-radius: 0; background: transparent; color: var(--pptx-foreground);
    font-size: 12px; line-height: 16px; gap: normal;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] [data-ribbon-control="home.arrange.crop"] [data-pptx-ribbon-control="crop-menu"] svg { width: 12px; height: 12px; }
}
`;
