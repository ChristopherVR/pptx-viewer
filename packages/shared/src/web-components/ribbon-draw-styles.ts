import { attachScopedRibbonStyles } from './ribbon-scoped-styles';

const RIBBON_DRAW_STYLES = `
:host { display:inline-flex; align-items:center; color:var(--pptx-foreground,#f8fafc); font:inherit; }
.tools,.settings,label { display:inline-flex; align-items:center; gap:6px; }
.tools { gap:2px; }
.settings { gap:10px; margin-inline-start:10px; font-size:11px; }
label { color:var(--pptx-muted-foreground,#94a3b8); }
button,input,select,summary { font:inherit; color:inherit; box-sizing:border-box; }
button,summary,select,input[type=color] { border:1px solid var(--pptx-border,#374151); background:var(--pptx-background,#111827); border-radius:4px; }
button,summary { cursor:pointer; }
button { min-width:28px; min-height:28px; padding:4px; display:inline-flex; align-items:center; justify-content:center; }
button:hover:not(:disabled),summary:hover { background:var(--pptx-accent,#374151); }
button[aria-pressed=true] { background:var(--pptx-primary,#6366f1); color:var(--pptx-primary-foreground,#fff); }
button:disabled,input:disabled,select:disabled { opacity:.4; cursor:default; }
button:focus-visible,summary:focus-visible,input:focus-visible,select:focus-visible { outline:2px solid var(--pptx-ring,#818cf8); outline-offset:2px; }
svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; }
details { position:relative; }
summary { padding:5px 8px; min-height:28px; display:flex; align-items:center; gap:6px; list-style:none; }
summary::-webkit-details-marker { display:none; }
summary[aria-disabled=true] { opacity:.4; cursor:default; }
summary::after { content:'\\2304'; }
.preview { width:14px; height:14px; border:1px solid var(--pptx-border,#374151); }
.palette { box-sizing:border-box; position:fixed; z-index:1200; width:240px; max-width:calc(100vw - 16px); max-height:65vh; overflow:auto; padding:8px; background:var(--pptx-popover,#111827); border:1px solid var(--pptx-border,#374151); border-radius:6px; box-shadow:0 8px 24px #0005; }
.swatches { display:flex; flex-wrap:wrap; gap:4px; margin:4px 0 8px; }
.swatch { width:28px; height:28px; border:1px solid var(--pptx-border,#374151); }
input[type=color] { width:30px; height:28px; padding:2px; cursor:pointer; }
input[type=range] { width:72px; accent-color:var(--pptx-primary,#6366f1); }
select { height:28px; padding:2px 4px; }
@media (pointer:coarse),(max-width:900px) {
	button,summary,input[type=color],select,input[type=range] { min-width:44px; min-height:44px; }
	.swatch { width:44px; height:44px; }
	.palette { width:264px; }
}
@media (forced-colors:active) {
	button,summary,select,input[type=color],.palette { border-color:ButtonText; }
	button[aria-pressed=true] { outline:2px solid Highlight; }
	.preview,.swatch { forced-color-adjust:none; }
}
`;

export function attachRibbonDrawStyles(doc: Document): void {
	attachScopedRibbonStyles(doc, 'pptx-ui-draw-styles', 'pptx-ui-ribbon-draw', RIBBON_DRAW_STYLES);
}
