export const SELECT_STYLES = `
:host { display: inline-block; box-sizing: border-box; min-width: 0; max-width: 100%; border: 0 !important; padding: 0 !important; background: transparent !important; box-shadow: none !important; color: var(--pptx-foreground, #e2e8f0); font: inherit; font-size: 12px; vertical-align: middle; }
:host([disabled]) { opacity: .5; cursor: not-allowed; }
button { box-sizing: border-box; width: 100%; min-height: 28px; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 4px 7px; border: 1px solid var(--pptx-border, #3f3f52); border-radius: 5px; background: var(--pptx-select-control-bg, var(--pptx-background, #11111b)); color: inherit; font: inherit; font-size: inherit; text-align: left; cursor: pointer; }
:host(.bg-muted) button { background: var(--pptx-muted, #1f2937); }
:host(.bg-popover) button { background: var(--pptx-popover, #111827); }
button:focus-visible { outline: 2px solid var(--pptx-ring, #6366f1); outline-offset: 2px; }
button:disabled { cursor: not-allowed; }
@media (pointer: coarse), (max-width: 767px) { button { min-height: 44px; } }
.value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chevron { flex: none; width: 6px; height: 6px; margin: 0 2px 3px 0; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(45deg); }
:host([open]) .chevron { margin: 3px 2px 0 0; transform: rotate(225deg); }
.menu { box-sizing: border-box; position: fixed; margin: 0; padding: 4px; min-width: 90px; max-height: min(240px, 50vh); overflow: auto; border: 1px solid var(--pptx-border, #3f3f52); border-radius: 5px; background: var(--pptx-popover, var(--pptx-background, #11111b)); color: var(--pptx-popover-foreground, var(--pptx-foreground, #e2e8f0)); box-shadow: 0 8px 20px #0004; font: inherit; font-size: inherit; }
.menu:not(:popover-open):not([data-fallback-open]) { display: none; }
.option { display: block; box-sizing: border-box; width: 100%; padding: 6px 8px; border-radius: 3px; cursor: pointer; white-space: nowrap; }
.group { padding: 7px 8px 3px; color: var(--pptx-muted-foreground, #9ca3af); font-size: .9em; font-weight: 600; }
.option:not([aria-disabled="true"]):hover, .option[data-active]:not([aria-selected="true"]) { background: color-mix(in srgb, var(--pptx-primary, #e86a40) 20%, var(--pptx-popover, #11111b)); }
.option[aria-selected="true"] { background: var(--pptx-primary, #e86a40); color: var(--pptx-primary-foreground, #fff); }
.option[aria-selected="true"]:hover { filter: brightness(1.08); }
.option[aria-disabled="true"] { opacity: .45; cursor: not-allowed; }
@media (forced-colors: active) { button, .menu { border-color: CanvasText; background: Canvas; color: CanvasText; } .option[aria-selected="true"], .option[data-active], .option:not([aria-disabled="true"]):hover { background: Highlight; color: HighlightText; } }
`;
