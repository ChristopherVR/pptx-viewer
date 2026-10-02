/** Clusters are plain flow containers: Office buttons are flat and are grouped by position. */
export const EDITOR_CLUSTER_CSS = `
@media (min-width: 768px) {
  [data-pptx-editor-chrome] [data-pptx-chrome="control-cluster"] {
    display: inline-flex; align-items: center; gap: 0; border: 0; padding: 0; background: transparent;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="arrange-controls"] :is(
    [data-pptx-chrome="align-controls"], [data-pptx-chrome="distribute-controls"],
    [data-pptx-chrome="flip-controls"], [data-pptx-chrome="group-controls"], [data-pptx-chrome="order-controls"]
  ) { display: inline-flex; flex: none; align-items: center; gap: 0; border: 0; padding: 0; background: transparent; }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] [data-ribbon-control="home.arrange.crop"] {
    display: inline-flex; flex: none; align-items: center; gap: 0; border: 0; padding: 0; background: transparent;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] [data-ribbon-control="home.arrange.crop"] [data-pptx-ribbon-control="crop"] {
    box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
    min-width: 28px; height: 24px; padding: 0 6px; margin: 0; border: 0; border-radius: 4px 0 0 4px; background: transparent;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] [data-ribbon-control="home.arrange.crop"] [data-pptx-ribbon-control="crop-menu"] {
    box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
    width: 16px; min-width: 16px; height: 24px; padding: 0; margin: 0; border: 0; border-radius: 0 4px 4px 0;
    background: transparent; color: var(--pptx-foreground); font-size: 12px; line-height: 16px; gap: normal;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"] [data-ribbon-control="home.arrange.crop"] [data-pptx-ribbon-control="crop-menu"] svg { width: 10px; height: 10px; }
}
`;
