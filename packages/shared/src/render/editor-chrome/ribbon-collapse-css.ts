/**
 * Collapsed groups (a narrow window): Office turns a group into one button and opens its commands
 * in a popup. The overflow controller sets `data-collapsed` / `data-open` and injects the face
 * button into native group shells; the shared `pptx-ui-ribbon-group` draws its own in its shadow root.
 */
const R = '[data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"][data-pptx-chrome]';
const FACE = '[data-pptx-chrome="ribbon-collapse"]';
const NATIVE = ':not(pptx-ui-ribbon-group)';

export const EDITOR_COLLAPSE_CSS = `
@media (min-width: 768px) {
  /* The dialog launcher: a corner glyph at the bottom right of a group. */
  ${R} [data-ribbon-group] > [data-pptx-chrome="group-launcher"] {
    position: absolute; right: 1px; bottom: 1px; display: inline-flex; align-items: center; justify-content: center;
    width: 14px; min-width: 14px; height: 14px; min-height: 14px; padding: 0; border: 0; border-radius: 2px;
    background: transparent; color: var(--pptx-muted-foreground); cursor: pointer;
  }
  ${R} [data-ribbon-group] > [data-pptx-chrome="group-launcher"] svg { width: 10px; height: 10px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }
  ${R} [data-ribbon-group] > [data-pptx-chrome="group-launcher"]:hover { background: var(--pptx-accent); color: var(--pptx-foreground); }
  ${R} [data-ribbon-group] > [data-pptx-chrome="group-launcher"]:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: 1px; }
  ${R} [data-ribbon-group][data-collapsed] > [data-pptx-chrome="group-launcher"] { display: none; }
  ${R} [data-ribbon-group] > ${FACE} { display: none; }
  ${R} [data-ribbon-group][data-collapsed]${NATIVE} > ${FACE} {
    display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 2px;
    box-sizing: border-box; min-width: 56px; height: 66px; margin: 3px 0 0; padding: 3px 6px;
    border: 0; border-radius: 4px; background: transparent; color: var(--pptx-foreground);
    font: inherit; font-size: 12px; line-height: 15px; cursor: pointer;
  }
  ${R} [data-ribbon-group][data-collapsed]${NATIVE} > ${FACE}:hover,
  ${R} [data-ribbon-group][data-open]${NATIVE} > ${FACE} { background: var(--pptx-accent); }
  ${R} [data-ribbon-group][data-collapsed]${NATIVE} > ${FACE}:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: 2px; }
  ${R} [data-ribbon-group][data-collapsed]${NATIVE} > ${FACE} svg { width: 32px; height: 32px; flex: none; stroke-width: 1.35; color: var(--pptx-primary); }
  ${R} [data-ribbon-group][data-collapsed]${NATIVE} > ${FACE} svg.chev { width: 9px; height: 9px; margin-top: -1px; stroke-width: 1.8; color: inherit; }
  ${R} [data-ribbon-group][data-collapsed]${NATIVE} > :not(${FACE}) { display: none !important; }
  ${R} [data-ribbon-group][data-collapsed][data-open]${NATIVE} > :not(${FACE}):not([data-pptx-chrome="ribbon-group-label"]):not([data-pptx-chrome="group-launcher"]) {
    display: flex !important; flex-wrap: wrap; position: fixed; top: var(--pptx-collapse-y, 120px); left: var(--pptx-collapse-x, 8px);
    z-index: 1200; box-sizing: border-box; width: auto; max-width: calc(100vw - 16px); padding: 8px;
    background: var(--pptx-popover); color: var(--pptx-popover-foreground);
    border: 1px solid var(--pptx-border); border-radius: 6px; box-shadow: 0 8px 24px #0005;
  }
}
@media (forced-colors: active) {
  ${R} [data-ribbon-group][data-collapsed][data-open]${NATIVE} > :not(${FACE}) { border-color: ButtonText; }
}
`;
