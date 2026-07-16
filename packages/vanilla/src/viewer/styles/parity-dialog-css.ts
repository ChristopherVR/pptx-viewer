export const PARITY_DIALOG_CSS = `
.pptxv-parity-backdrop { position: fixed; inset: 0; z-index: 1200; border: 0; background: rgb(0 0 0 / .55); }
.pptxv-parity-dialog { position: fixed; z-index: 1201; top: 50%; left: 50%; display: flex; flex-direction: column; width: min(440px, calc(100vw - 32px)); max-height: 88vh; transform: translate(-50%, -50%); overflow: hidden; border: 1px solid var(--pptx-border); border-radius: 10px; background: var(--pptx-background); color: var(--pptx-foreground); box-shadow: 0 24px 70px rgb(0 0 0 / .34); }
.pptxv-parity-header, .pptxv-parity-footer { display: flex; align-items: center; padding: 12px 16px; border-color: var(--pptx-border); }
.pptxv-parity-header { justify-content: space-between; border-bottom: 1px solid var(--pptx-border); }
.pptxv-parity-header h2 { margin: 0; font-size: 14px; }
.pptxv-parity-header button { border: 0; background: transparent; color: inherit; font-size: 20px; cursor: pointer; }
.pptxv-parity-body { display: flex; flex-direction: column; gap: 12px; overflow: auto; padding: 16px; font-size: 12px; }
.pptxv-parity-body fieldset { display: flex; flex-direction: column; gap: 7px; margin: 0; padding: 10px 12px; border: 1px solid var(--pptx-border); border-radius: 6px; }
.pptxv-parity-body legend { padding: 0 4px; color: var(--pptx-muted-foreground); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.pptxv-parity-body input[type='text'], .pptxv-parity-body input[type='number'] { min-width: 0; padding: 7px 8px; border: 1px solid var(--pptx-border); border-radius: 4px; background: var(--pptx-muted); color: inherit; }
.pptxv-parity-check, .pptxv-parity-range { display: flex; align-items: center; gap: 8px; min-height: 28px; cursor: pointer; }
.pptxv-parity-select { display: grid; grid-template-columns: 130px 1fr; align-items: center; gap: 10px; }
.pptxv-parity-select select { padding: 7px 8px; border: 1px solid var(--pptx-border); border-radius: 4px; background: var(--pptx-muted); color: inherit; }
.pptxv-parity-range input[type='number'] { width: 58px; }
.pptxv-parity-footer { justify-content: flex-end; gap: 8px; border-top: 1px solid var(--pptx-border); }
.pptxv-parity-footer button, .pptxv-parity-tabs button, .pptxv-compare-panel button { padding: 7px 11px; border: 1px solid var(--pptx-border); border-radius: 4px; background: var(--pptx-muted); color: inherit; cursor: pointer; }
.pptxv-parity-footer .is-primary, .pptxv-parity-tabs .is-active, .pptxv-compare-actions button { border-color: var(--pptx-primary); background: var(--pptx-primary); color: #fff; }
.pptxv-parity-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--pptx-border); }
.pptxv-shortcut-list { display: flex; flex-direction: column; gap: 3px; }
.pptxv-shortcut-list > div { display: flex; justify-content: space-between; gap: 14px; padding: 7px 8px; border-radius: 4px; background: var(--pptx-muted); }
.pptxv-shortcut-list kbd { color: var(--pptx-muted-foreground); white-space: nowrap; }
.pptxv-compare-panel { position: absolute; z-index: 45; inset: 0 0 0 auto; display: flex; flex-direction: column; width: min(440px, 100%); border-left: 1px solid var(--pptx-border); background: var(--pptx-card); color: var(--pptx-foreground); box-shadow: -16px 0 38px rgb(0 0 0 / .2); }
.pptxv-compare-panel > header { display: flex; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--pptx-border); }
.pptxv-compare-panel h2, .pptxv-compare-panel p { margin: 0; } .pptxv-compare-panel header p { margin-top: 3px; color: var(--pptx-muted-foreground); font-size: 11px; }
.pptxv-compare-actions { padding: 9px 16px; border-bottom: 1px solid var(--pptx-border); }
.pptxv-compare-list { display: flex; flex-direction: column; gap: 8px; overflow: auto; padding: 12px; }
.pptxv-compare-row { padding: 10px; border: 1px solid var(--pptx-border); border-radius: 6px; background: var(--pptx-muted); font-size: 11px; }
.pptxv-compare-row p { margin: 6px 0; color: var(--pptx-muted-foreground); } .pptxv-compare-row div { display: flex; justify-content: flex-end; gap: 6px; } .pptxv-compare-row.is-resolved { opacity: .55; }
.pptxv-rehearse { position: absolute; z-index: 130; top: 8px; left: 50%; display: flex; align-items: center; gap: 8px; padding: 8px 10px; transform: translateX(-50%); border: 1px solid #ffffff2b; border-radius: 7px; background: #020617ee; color: #f8fafc; box-shadow: 0 10px 28px rgb(0 0 0 / .35); font-size: 11px; }
.pptxv-rehearse button { padding: 5px 8px; border: 0; border-radius: 4px; background: #ffffff16; color: inherit; cursor: pointer; }
.pptxv-workspace-pane { position: absolute; z-index: 48; inset: 0 0 0 auto; display: flex; flex-direction: column; width: min(300px, 100%); border-left: 1px solid var(--pptx-border); background: var(--pptx-card); color: var(--pptx-foreground); box-shadow: -12px 0 30px rgb(0 0 0 / .18); }
.pptxv-workspace-pane > header, .pptxv-slide-sorter > header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 11px 13px; border-bottom: 1px solid var(--pptx-border); }
.pptxv-workspace-pane h2, .pptxv-slide-sorter h2 { margin: 0; font-size: 13px; } .pptxv-workspace-pane header button, .pptxv-slide-sorter header button { border: 0; background: transparent; color: inherit; font-size: 18px; cursor: pointer; }
.pptxv-workspace-list { display: flex; flex-direction: column; gap: 5px; overflow: auto; padding: 8px; }
.pptxv-selection-row { display: grid; grid-template-columns: 18px 1fr 28px; align-items: center; border-radius: 4px; background: var(--pptx-muted); } .pptxv-selection-row.is-selected { color: var(--pptx-primary); box-shadow: inset 3px 0 var(--pptx-primary); } .pptxv-selection-row button { padding: 7px; border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }
.pptxv-comment-card { display: flex; flex-direction: column; gap: 6px; padding: 8px; border: 1px solid var(--pptx-border); border-radius: 6px; } .pptxv-comment-card.is-resolved { opacity: .6; } .pptxv-comment-card textarea, .pptxv-workspace-list > textarea { min-height: 58px; padding: 6px; border: 1px solid var(--pptx-border); border-radius: 4px; background: var(--pptx-muted); color: inherit; resize: vertical; } .pptxv-comment-card div { display: flex; gap: 4px; }
.pptxv-slide-sorter { position: absolute; z-index: 50; inset: 0; display: flex; flex-direction: column; background: color-mix(in srgb, var(--pptx-background) 96%, transparent); color: var(--pptx-foreground); }
.pptxv-sorter-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; overflow: auto; padding: 18px; } .pptxv-sorter-card { overflow: hidden; border: 2px solid var(--pptx-border); border-radius: 7px; background: var(--pptx-card); } .pptxv-sorter-card.is-current { border-color: var(--pptx-primary); } .pptxv-sorter-card.is-hidden { opacity: .5; } .pptxv-sorter-card > button { display: grid; width: 100%; min-height: 90px; place-items: center; border: 0; background: var(--pptx-muted); color: inherit; font-size: 22px; cursor: pointer; } .pptxv-sorter-card div { display: flex; gap: 3px; padding: 5px; } .pptxv-sorter-card div button { flex: 1; padding: 4px; border: 0; background: transparent; color: inherit; font-size: 9px; cursor: pointer; }
.pptxv-custom-shows article { display: grid; grid-template-columns: 1fr auto auto auto; gap: 6px; padding: 8px; border: 1px solid var(--pptx-border); border-radius: 6px; } .pptxv-custom-shows article > div { grid-column: 1 / -1; max-height: 140px; overflow: auto; }
@media (max-width: 767px) { .pptxv-parity-dialog { top: auto; bottom: 0; width: 100%; max-height: 88dvh; transform: translateX(-50%); border-radius: 16px 16px 0 0; } }
`;
