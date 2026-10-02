/**
 * Home group shells and rows. Every binding emits the same `data-ribbon-group`, `data-ribbon-control`
 * and `data-pptx-chrome` hooks, so one stylesheet gives all five Office's layout: groups that stretch
 * the ribbon, rows that fill them and an 11px caption beneath.
 */
/** The repeated hook outranks the binding-level touch-target baselines (min-height: 24px). */
const R = '[data-pptx-editor-chrome] [data-pptx-chrome="ribbon-content"][data-pptx-chrome]';
const GROUPS = [
	'home.clipboard',
	'home.slides',
	'home.font',
	'home.paragraph',
	'home.editing',
	'home.drawing',
	'home.arrange',
]
	.map((id) => `[data-ribbon-group="${id}"]`)
	.join(', ');
/** Two-row groups: the first row, a zero-height line break, then the second row (ordered by id). */
const BREAK = 'content: ""; flex: 0 0 100%; height: 0; order: 6;';
const LISTS = `:is([data-ribbon-control="home.paragraph.bullets"], [data-ribbon-control="home.paragraph.numbering"])`;
const FILL_IDS = ['shapeFill', 'shapeOutline', 'shapeEffects'].map(
	(id) => `[data-ribbon-control="home.drawing.${id}"]`,
);
const FILL_OUTLINE = [...FILL_IDS, ...FILL_IDS.map((id) => `${id} > button`)].join(', ');

export const EDITOR_HOME_LAYOUT_CSS = `
@media (min-width: 768px) {
  [data-pptx-editor-chrome] [data-pptx-chrome="control-fragment"] { display: contents; }
  ${R} :is(${GROUPS}) {
    position: relative; box-sizing: border-box; align-self: stretch; flex: none;
    display: flex; flex-direction: column; align-items: center; justify-content: space-between;
    min-height: 84px; padding: 3px 6px 0; margin: 0; gap: 0; border: 0;
  }
  ${R} :is(${GROUPS})::after {
    content: ""; position: absolute; top: 6px; bottom: 6px; right: 0; width: 1px;
    background: color-mix(in oklab, var(--pptx-border) 80%, transparent);
  }
  ${R}:has([data-ribbon-group="home.font"]) :is(.w-px.self-stretch, .pptx-rb-sep, [data-pptx-chrome="ribbon-sep"]),
  [data-pptx-editor-chrome] [data-pptx-chrome="home-content"] > .pptx-svelte-hometab-sep { display: none; }
  ${R} [data-pptx-chrome="ribbon-group-label"] {
    flex: none; max-width: 100%; height: 16px; font-size: 11px; line-height: 16px; font-weight: 400;
    color: var(--pptx-muted-foreground); text-align: center; white-space: nowrap;
  }
  ${R} :is(${GROUPS}) > :is([data-pptx-chrome$="-controls"], .row) {
    flex: 1 1 auto; display: flex; align-items: flex-start; gap: 2px;
  }
  ${R} :is([data-pptx-chrome="list-controls"], [data-pptx-chrome="font-picker-controls"]) { display: contents; }

  /* Font: family, size, grow, shrink, clear on the first row; styles, spacing, case and colours on the second. */
  ${R} [data-ribbon-group="home.font"] [data-pptx-chrome="font-controls"] {
    flex-wrap: wrap; align-content: flex-start; align-items: center; gap: 5px 2px; width: 282px;
  }
  ${R} [data-ribbon-group="home.font"] [data-pptx-chrome="font-controls"]::after { ${BREAK} }
  ${R} [data-ribbon-control="home.font.fontFamily"] { order: 1; }
  ${R} [data-ribbon-control="home.font.fontSize"] { order: 2; }
  ${R} [data-ribbon-control="home.font.increaseFontSize"] { order: 3; }
  ${R} [data-ribbon-control="home.font.decreaseFontSize"] { order: 4; }
  ${R} [data-ribbon-control="home.font.clearFormatting"] { order: 5; }
  ${R} [data-ribbon-control="home.font.bold"] { order: 10; }
  ${R} [data-ribbon-control="home.font.italic"] { order: 11; }
  ${R} [data-ribbon-control="home.font.underline"] { order: 12; }
  ${R} [data-ribbon-control="home.font.shadow"] { order: 13; }
  ${R} [data-ribbon-control="home.font.strikethrough"] { order: 14; }
  ${R} [data-ribbon-control="home.font.characterSpacing"] { order: 15; }
  ${R} [data-ribbon-control="home.font.changeCase"] { order: 16; }
  ${R} [data-ribbon-control="home.font.highlightColor"] { order: 17; }
  ${R} [data-ribbon-control="home.font.fontColor"] { order: 18; }

  /* Paragraph: lists, indents and line spacing, then alignment, direction and columns. */
  ${R} [data-ribbon-group="home.paragraph"] [data-pptx-chrome="paragraph-controls"] {
    flex-wrap: wrap; align-content: flex-start; align-items: center; gap: 5px 2px; width: 196px;
  }
  ${R} [data-ribbon-group="home.paragraph"] [data-pptx-chrome="paragraph-controls"]::after { ${BREAK} }
  ${R} [data-ribbon-control="home.paragraph.bullets"] { order: 1; }
  ${R} [data-ribbon-control="home.paragraph.numbering"] { order: 2; }
  ${R} [data-ribbon-control="home.paragraph.decreaseIndent"] { order: 3; }
  ${R} [data-ribbon-control="home.paragraph.increaseIndent"] { order: 4; }
  ${R} [data-ribbon-control="home.paragraph.lineSpacing"] { order: 5; }
  ${R} [data-ribbon-control="home.paragraph.alignLeft"] { order: 10; }
  ${R} [data-ribbon-control="home.paragraph.alignCenter"] { order: 11; }
  ${R} [data-ribbon-control="home.paragraph.alignRight"] { order: 12; }
  ${R} [data-ribbon-control="home.paragraph.justify"] { order: 13; }
  ${R} [data-ribbon-control="home.paragraph.textDirection"] { order: 14; }
  ${R} [data-ribbon-control="home.paragraph.columns"] { order: 15; }
  ${R} ${LISTS} { display: inline-flex; align-items: center; gap: 0; border: 0; background: transparent; }
  ${R} ${LISTS} > button:first-child { width: 28px; min-width: 28px; padding: 0; border-radius: 4px 0 0 4px; }
  ${R} ${LISTS} [data-pptx-chrome="gallery-caret"] {
    box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
    width: 16px; min-width: 16px; height: 24px; min-height: 24px; padding: 0; border: 0; border-radius: 0 4px 4px 0;
    background: transparent; color: var(--pptx-foreground); gap: normal; font-size: 12px; line-height: 16px;
  }
  ${R} ${LISTS} [data-pptx-chrome="gallery-caret"] svg { width: 10px; height: 10px; }
  ${R} ${LISTS} > div { border: 0; }
  [data-pptx-editor-chrome] pptx-ui-select[variant="ribbon-icon"] { flex: none; width: 28px; min-width: 28px; max-width: 28px; }

  /* Editing: Find, Replace and Select stack as three labelled rows. */
  ${R} [data-ribbon-group="home.editing"] [data-pptx-chrome="editing-controls"] {
    flex-direction: column; align-items: stretch; justify-content: flex-start; gap: 0;
  }
  ${R} [data-ribbon-group="home.editing"] :is(button, [data-ribbon-control]) { justify-content: flex-start; height: 22px; min-height: 22px; }
  ${R} [data-ribbon-group="home.editing"] [data-ribbon-control] > button { height: 22px; min-height: 22px; width: 100%; }
  ${R} [data-ribbon-group="home.clipboard"] [data-stack] { gap: 0; }
  ${R} [data-ribbon-group="home.clipboard"] [data-stack] > button { height: 22px; min-height: 22px; justify-content: flex-start; }

  /* Drawing: Shapes, Arrange and Quick Styles stand tall; Fill, Outline and Effects stack beside them. */
  ${R} [data-ribbon-group="home.drawing"] [data-pptx-chrome="drawing-controls"] {
    flex-direction: column; flex-wrap: wrap; align-content: flex-start; align-items: stretch; gap: 0 2px; height: 66px; max-height: 66px;
  }
  ${R} [data-pptx-chrome="drawing-controls"] [data-pptx-chrome="ribbon-inline-label"] { display: none; }
  ${R} [data-pptx-chrome="drawing-controls"] [data-ribbon-control="home.drawing.shapes"] { order: 1; }
  ${R} [data-pptx-chrome="drawing-controls"] [data-ribbon-control="home.drawing.arrange"] { order: 2; }
  ${R} [data-pptx-chrome="drawing-controls"] [data-ribbon-control="home.drawing.quickStyles"] { order: 3; }
  ${R} [data-pptx-chrome="drawing-controls"] [data-ribbon-control="home.drawing.shapeFill"] { order: 4; }
  ${R} [data-pptx-chrome="drawing-controls"] [data-ribbon-control="home.drawing.shapeOutline"] { order: 5; }
  ${R} [data-pptx-chrome="drawing-controls"] [data-ribbon-control="home.drawing.shapeEffects"] { order: 6; }
  ${R} [data-pptx-chrome="drawing-controls"] :is(${FILL_OUTLINE}) { height: 22px; min-height: 22px; }
  ${R} [data-pptx-chrome="drawing-controls"] [data-pptx-chrome="color-swatch"] { display: none; }
  ${R} [data-ribbon-control="home.drawing.quickStyles"] { height: 66px; }
  ${R} [data-ribbon-control="home.drawing.quickStyles"] .trigger {
    flex-direction: column; justify-content: flex-start; min-width: 56px; height: 66px; padding: 3px 6px; gap: 2px; line-height: 15px;
  }
  ${R} [data-ribbon-control="home.drawing.quickStyles"] .trigger svg { width: 32px; height: 32px; stroke-width: 1.35; }
  ${R} [data-ribbon-control="home.drawing.shapeEffects"] .trigger { height: 22px; min-height: 22px; width: 100%; justify-content: flex-start; }

  /* Arrange: the viewer's own order, align and edit commands, as flat buttons. */
  ${R} [data-pptx-chrome="arrange-controls"] { flex-wrap: nowrap; align-items: center; gap: 2px; }
  ${R} [data-pptx-chrome="arrange-controls"] .pptx-rb-sep { display: none; }
  ${R} [data-pptx-chrome="arrange-controls"] [data-pptx-chrome="arrange-extras"],
  ${R} [data-pptx-chrome="arrange-controls"] > [data-pptx-chrome="duplicate-controls"] { display: contents; }
  ${R} [data-pptx-chrome="arrange-controls"] [data-ribbon-control="home.arrange.outlineWidth"] { order: 1; }
  ${R} [data-pptx-chrome="arrange-controls"] [data-pptx-chrome="order-controls"] { order: 2; }
  ${R} [data-pptx-chrome="arrange-controls"] :is([data-ribbon-control="home.arrange.duplicate"], [data-ribbon-control="home.arrange.delete"]) { order: 3; }
  ${R} [data-ribbon-control="home.arrange.outlineWidth"] {
    box-sizing: border-box; flex: none; width: 52px; height: 24px; padding: 0 4px;
    border: 1px solid var(--pptx-border); border-radius: 4px; background: transparent;
    font-size: 12px; line-height: 16px; color: var(--pptx-foreground); text-align: center;
  }
  ${R} [data-ribbon-control="home.arrange.outlineWidth"]:disabled { opacity: .4; }
}
`;
