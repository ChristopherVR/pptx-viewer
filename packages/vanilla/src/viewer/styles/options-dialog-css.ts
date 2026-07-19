/**
 * Styles for the PowerPoint "File > Options" parity dialog (category rail +
 * schema-driven panes), the title-bar Quick Access strip, the end-of-slide-show
 * black slide, the in-show context menu, and the option-driven viewer root
 * classes (`pptxv-no-hw-accel`, `pptxv-compat-display`, `pptxv-reduced-motion`,
 * `pptxv-no-show-popup`).
 */
export const OPTIONS_DIALOG_CSS = `
/* ── Dialog shell override: the Options dialog is wider than parity dialogs ── */
.pptxv-options-dialog { width: min(56rem, calc(100vw - 32px)); height: min(620px, 88vh); }
.pptxv-options-dialog .pptxv-parity-body { flex: 1; min-height: 0; padding: 0; gap: 0; }
.pptxv-options-body { display: flex; flex: 1; min-height: 0; }
.pptxv-options-nav { display: flex; flex-direction: column; gap: 2px; flex: none; width: 172px; overflow-y: auto; padding: 8px; border-right: 1px solid var(--pptx-border); }
.pptxv-options-nav button { padding: 8px 10px; border: 0; border-radius: 4px; background: transparent; color: var(--pptx-foreground); font: inherit; font-size: 12px; text-align: left; cursor: pointer; white-space: nowrap; }
.pptxv-options-nav button:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-options-nav button.is-active { background: color-mix(in srgb, var(--pptx-primary) 14%, transparent); color: var(--pptx-primary); font-weight: 600; }
.pptxv-options-pane { flex: 1; min-width: 0; overflow-y: auto; padding: 14px 18px; font-size: 12px; }
.pptxv-options-headline { margin: 0 0 12px; font-size: 12px; font-weight: 600; }

/* ── Sections + control rows ── */
.pptxv-options-section { margin: 0 0 16px; }
.pptxv-options-section > h3 { margin: 0 0 4px; padding-bottom: 3px; border-bottom: 1px solid var(--pptx-border); color: var(--pptx-muted-foreground); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.pptxv-options-section-desc { margin: 0 0 8px; color: var(--pptx-muted-foreground); font-size: 11px; }
.pptxv-options-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 28px; padding: 2px 0; }
.pptxv-options-row.is-indent { padding-left: 22px; }
label.pptxv-options-row { cursor: pointer; }
.pptxv-options-row-label { display: inline-flex; align-items: center; gap: 5px; min-width: 0; }
.pptxv-options-info { display: inline-grid; place-items: center; width: 13px; height: 13px; flex: none; border: 1px solid currentcolor; border-radius: 50%; color: var(--pptx-primary); font-size: 9px; font-style: normal; cursor: help; opacity: .75; }
.pptxv-options-row select, .pptxv-options-row input[type='text'], .pptxv-options-row input[type='number'] { max-width: 55%; padding: 5px 7px; border: 1px solid var(--pptx-border); border-radius: 4px; background: var(--pptx-muted); color: inherit; font: inherit; font-size: 12px; }
.pptxv-options-row input[type='number'] { width: 72px; text-align: right; }
.pptxv-options-row input[type='text'] { width: 180px; }
.pptxv-options-row input[type='checkbox'] { flex: none; width: 15px; height: 15px; accent-color: var(--pptx-primary); }
.pptxv-options-unit { color: var(--pptx-muted-foreground); font-size: 11px; }
.pptxv-options-number { display: inline-flex; align-items: center; gap: 6px; }
.pptxv-options-action { padding: 6px 11px; border: 1px solid var(--pptx-border); border-radius: 4px; background: var(--pptx-muted); color: inherit; font: inherit; font-size: 12px; cursor: pointer; }
.pptxv-options-action:hover:not(:disabled) { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-options-action:disabled { opacity: .45; cursor: default; }

/* ── Customize Ribbon pane ── */
.pptxv-options-ribbon-list { display: flex; flex-direction: column; gap: 2px; padding: 6px; border: 1px solid var(--pptx-border); border-radius: 6px; }
.pptxv-options-ribbon-list .pptxv-parity-check.is-locked { opacity: .55; cursor: not-allowed; }

/* ── Quick Access pane ── */
.pptxv-options-qa { display: flex; align-items: stretch; gap: 10px; }
.pptxv-options-qa-col { flex: 1; min-width: 0; }
.pptxv-options-qa-title { margin: 0 0 4px; color: var(--pptx-muted-foreground); font-size: 11px; font-weight: 600; }
.pptxv-options-qa-list { display: flex; flex-direction: column; gap: 2px; height: 190px; overflow-y: auto; padding: 4px; border: 1px solid var(--pptx-border); border-radius: 6px; }
.pptxv-options-qa-list button { padding: 6px 8px; border: 0; border-radius: 4px; background: transparent; color: var(--pptx-foreground); font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.pptxv-options-qa-list button:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-options-qa-list button.is-selected { background: color-mix(in srgb, var(--pptx-primary) 16%, transparent); color: var(--pptx-primary); }
.pptxv-options-qa-arrows { display: flex; flex-direction: column; justify-content: center; gap: 6px; }

/* ── Add-ins pane ── */
.pptxv-options-addins-head { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; padding: 0 8px 4px; border-bottom: 1px solid var(--pptx-border); color: var(--pptx-muted-foreground); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.pptxv-options-addins h4 { margin: 12px 0 4px; font-size: 11px; }
.pptxv-options-addins table { width: 100%; border-collapse: collapse; text-align: left; }
.pptxv-options-addins td { padding: 5px 8px; border-bottom: 1px solid color-mix(in srgb, var(--pptx-border) 55%, transparent); font-size: 11px; }
.pptxv-options-addins td:nth-child(2) { color: var(--pptx-muted-foreground); font-family: ui-monospace, monospace; font-size: 10px; }
.pptxv-options-addins td:nth-child(3) { color: var(--pptx-muted-foreground); }
.pptxv-options-addins tr { cursor: pointer; }
.pptxv-options-addins tr:hover { background: var(--pptx-accent); }
.pptxv-options-addins tr.is-selected { background: color-mix(in srgb, var(--pptx-primary) 12%, transparent); }
.pptxv-options-addins-empty { padding: 4px 8px; color: var(--pptx-muted-foreground); font-style: italic; }
.pptxv-options-addins-detail { margin-top: 10px; padding: 10px; border: 1px solid var(--pptx-border); border-radius: 6px; background: var(--pptx-muted); }
.pptxv-options-addins-detail p { margin: 0 0 4px; font-size: 11px; }
.pptxv-options-addins-detail p:last-child { margin: 0; color: var(--pptx-muted-foreground); font-family: ui-monospace, monospace; font-size: 10px; }

/* ── Title-bar Quick Access strip ── */
.pptxv-qat { display: inline-flex; align-items: center; gap: 2px; }
.pptxv-qat[hidden] { display: none; }
.pptxv-qat .pptxv-btn-label { padding-left: 4px; font-size: 11px; white-space: nowrap; }
.pptxv-qat .pptxv-btn-pill { width: auto; padding: 0 6px; }

/* ── End of slide show (black slide) + in-show context menu ── */
.pptxv-endshow { position: absolute; inset: 0; z-index: 60; display: grid; place-items: center; border: 0; background: #000; color: #e5e7eb; font-size: 13px; cursor: pointer; }
.pptxv-showmenu { position: absolute; z-index: 65; display: flex; flex-direction: column; min-width: 160px; padding: 4px; border: 1px solid var(--pptx-border); border-radius: 6px; background: var(--pptx-card); color: var(--pptx-card-foreground); box-shadow: 0 10px 28px rgb(0 0 0 / .35); }
.pptxv-showmenu button { padding: 7px 10px; border: 0; border-radius: 4px; background: transparent; color: inherit; font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.pptxv-showmenu button:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }

/* ── Option-driven viewer root classes ── */
.pptxv.pptxv-reduced-motion *, .pptxv.pptxv-reduced-motion *::before, .pptxv.pptxv-reduced-motion *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
.pptxv.pptxv-no-hw-accel * { will-change: auto !important; backface-visibility: visible !important; perspective: none !important; }
.pptxv.pptxv-compat-display .pptxv-stage-wrap { box-shadow: none; }
.pptxv.pptxv-compat-display .pptxv-stage { image-rendering: crisp-edges; text-rendering: optimizeSpeed; }
.pptxv.pptxv-no-show-popup .pptxv-presentation-touch-prev,
.pptxv.pptxv-no-show-popup .pptxv-presentation-touch-next,
.pptxv.pptxv-no-show-popup .pptxv-presentation-touch-counter { display: none !important; }
@media (max-width: 767px) { .pptxv-options-body { flex-direction: column; } .pptxv-options-nav { flex-direction: row; width: 100%; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--pptx-border); } }
`;
