import { EDITOR_THUMBNAIL_GAP, EDITOR_THUMBNAIL_NUMBER_HEIGHT } from './metrics';

// Both ARIA values describe the active slide, regardless of binding semantics.
const CURRENT_SLIDE = ':is([aria-current="true"], [aria-current="page"])';

export const EDITOR_THUMBNAIL_CSS = `
@media (min-width: 768px) {
  [data-pptx-editor-chrome] [data-pptx-chrome="slide-list"] {
    display: block; padding: 0 6px 8px; gap: ${EDITOR_THUMBNAIL_GAP}px;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="slide-window"] {
    display: flex; flex-direction: column; gap: ${EDITOR_THUMBNAIL_GAP}px;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="slide-wrapper"] {
    border: 0; padding: 0; border-radius: 0; background: transparent;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="slide-row"] {
    position: relative; display: flex; width: 100%; align-items: center;
    gap: 4px; margin: 0; padding: 2px 4px; border: 0; border-radius: 0;
    box-sizing: border-box; background: transparent; color: var(--pptx-muted-foreground);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="slide-row"]${CURRENT_SLIDE} {
    background: color-mix(in oklab, var(--pptx-accent) 40%, transparent);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="slide-row"]${CURRENT_SLIDE}::before {
    content: ""; position: absolute; left: 0; top: 4px; bottom: 4px;
    width: 3px; border-radius: 0 2px 2px 0; background: var(--pptx-primary);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="slide-number"] {
    flex: 0 0 20px; width: 20px; min-width: 0; padding: 0;
    font-family: inherit; font-size: 10px; line-height: ${EDITOR_THUMBNAIL_NUMBER_HEIGHT}px; text-align: right;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="slide-frame"] {
    display: block; flex-shrink: 0; overflow: hidden; box-sizing: content-box;
    border: 1px solid transparent; border-radius: 0; outline: none; background: white;
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="slide-row"]${CURRENT_SLIDE} [data-pptx-chrome="slide-frame"] {
    border-color: color-mix(in oklab, var(--pptx-primary) 60%, transparent);
  }
  [data-pptx-editor-chrome] [data-pptx-chrome="slide-row"]${CURRENT_SLIDE} [data-pptx-chrome="slide-number"] {
    color: var(--pptx-primary); font-weight: 500;
  }
}
`;
