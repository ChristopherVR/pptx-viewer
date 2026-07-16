export const DOCUMENT_PROPERTIES_CSS = `
.pptxv-props-overlay { position:fixed; inset:0; z-index:210; display:grid; place-items:center; background:#0009; }
.pptxv-props-scrim { position:absolute; inset:0; width:100%; height:100%; border:0; background:transparent; }
.pptxv-props-dialog { position:relative; width:min(680px,calc(100vw - 32px)); max-height:calc(100vh - 40px); overflow:auto; border:1px solid var(--pptx-border); border-radius:10px; background:var(--pptx-card); color:var(--pptx-card-foreground); box-shadow:0 24px 80px #0008; }
.pptxv-props-dialog header,.pptxv-props-dialog footer { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:12px 16px; border-bottom:1px solid var(--pptx-border); }
.pptxv-props-dialog h2 { margin:0; font-size:16px; }
.pptxv-props-dialog button,.pptxv-props-dialog input,.pptxv-props-dialog select { border:1px solid var(--pptx-border); border-radius:5px; padding:6px 8px; background:var(--pptx-muted); color:inherit; }
.pptxv-props-tabs { display:flex; gap:4px; padding:8px 16px 0; }
.pptxv-props-tabs .is-active,.pptxv-props-dialog .is-primary { background:var(--pptx-primary); color:#fff; }
.pptxv-props-body { min-height:310px; padding:16px; }
.pptxv-props-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.pptxv-props-grid label { display:grid; gap:4px; font-size:11px; color:var(--pptx-muted-foreground); }
.pptxv-props-grid input { color:var(--pptx-foreground); }
.pptxv-props-stats { display:grid; grid-template-columns:1fr auto; gap:8px 24px; margin:0; }
.pptxv-props-stats dt { color:var(--pptx-muted-foreground); }
.pptxv-props-stats dd { margin:0; }
.pptxv-props-custom { display:grid; gap:8px; }
.pptxv-props-custom-row { display:grid; grid-template-columns:1fr 1fr 100px 34px; gap:6px; }
.pptxv-props-dialog footer { justify-content:flex-end; border-top:1px solid var(--pptx-border); border-bottom:0; }
@media (max-width:600px) { .pptxv-props-grid,.pptxv-props-custom-row { grid-template-columns:1fr; } }
`;
