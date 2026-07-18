/**
 * Styles for the modal equation editor dialog (`ui/ribbon/equation-panel.ts`),
 * mirroring React's `EquationEditorDialog`: centered modal over a dimmed
 * backdrop with a live MathML preview, LaTeX textarea, and the shared
 * template gallery grid.
 */
export const EQUATION_DIALOG_CSS = `
.pptxv-eqdlg-root[hidden] { display: none; }
.pptxv-eqdlg-backdrop { position: fixed; inset: 0; z-index: 1200; border: 0; background: rgb(0 0 0 / .55); }
.pptxv-eqdlg { position: fixed; z-index: 1201; top: 50%; left: 50%; display: flex; flex-direction: column; gap: 12px; width: min(600px, calc(100vw - 32px)); max-height: 85vh; overflow-y: auto; transform: translate(-50%, -50%); padding: 16px; border: 1px solid var(--pptx-border); border-radius: 10px; background: var(--pptx-background); color: var(--pptx-foreground); box-shadow: 0 24px 70px rgb(0 0 0 / .34); }
.pptxv-eqdlg-header { display: flex; align-items: center; justify-content: space-between; }
.pptxv-eqdlg-header h2 { margin: 0; font-size: 14px; }
.pptxv-eqdlg-close { border: 0; background: transparent; color: var(--pptx-muted-foreground); font-size: 18px; cursor: pointer; border-radius: var(--pptx-radius); padding: 0 6px; }
.pptxv-eqdlg-close:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-eqdlg-preview { display: flex; align-items: center; justify-content: center; min-height: 72px; padding: 12px; border: 1px solid var(--pptx-border); border-radius: var(--pptx-radius); background: var(--pptx-muted); font-size: 22px; font-family: 'Cambria Math', 'STIX Two Math', serif; }
.pptxv-eqdlg-preview.is-empty { font-size: 12px; font-style: italic; font-family: inherit; color: var(--pptx-muted-foreground); }
.pptxv-eqdlg-field { display: flex; flex-direction: column; gap: 5px; }
.pptxv-eqdlg-label { font-size: 11px; font-weight: 500; color: var(--pptx-muted-foreground); }
.pptxv-eqdlg-input { width: 100%; padding: 6px 8px; border: 1px solid var(--pptx-border); border-radius: var(--pptx-radius); background: var(--pptx-muted); color: inherit; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; resize: vertical; }
.pptxv-eqdlg-input:disabled { opacity: 0.4; }
.pptxv-eqdlg-hint { font-size: 10px; color: var(--pptx-muted-foreground); }
.pptxv-eqdlg-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.pptxv-eqdlg-template { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 7px; border: 1px solid var(--pptx-border); border-radius: var(--pptx-radius); background: var(--pptx-muted); color: inherit; cursor: pointer; }
.pptxv-eqdlg-template:hover { background: var(--pptx-accent); }
.pptxv-eqdlg-template.is-active { border-color: var(--pptx-primary); background: color-mix(in srgb, var(--pptx-primary) 14%, transparent); }
.pptxv-eqdlg-template-math { display: flex; align-items: center; justify-content: center; height: 28px; overflow: hidden; font-size: 13px; font-family: 'Cambria Math', 'STIX Two Math', serif; }
.pptxv-eqdlg-template-label { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; font-size: 9px; color: var(--pptx-muted-foreground); }
.pptxv-eqdlg-footer { display: flex; justify-content: flex-end; gap: 7px; }
.pptxv-eqdlg-footer button { padding: 7px 11px; border: 1px solid var(--pptx-border); border-radius: var(--pptx-radius); background: var(--pptx-muted); color: inherit; cursor: pointer; font: inherit; font-size: 12px; }
.pptxv-eqdlg-footer button:hover:not(:disabled) { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-eqdlg-footer button:disabled { opacity: 0.35; cursor: default; }
.pptxv-eqdlg-footer button.is-primary { border-color: var(--pptx-primary); background: var(--pptx-primary); color: #fff; }
.pptxv-eqdlg-footer button.is-primary:hover:not(:disabled) { background: var(--pptx-primary); color: #fff; filter: brightness(1.1); }
@media (max-width: 767px) { .pptxv-eqdlg { top: auto; bottom: 0; width: 100%; max-height: 88dvh; transform: translateX(-50%); border-radius: 16px 16px 0 0; } }
`;
