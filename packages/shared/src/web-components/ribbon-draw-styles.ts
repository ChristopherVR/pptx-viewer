import { attachScopedRibbonStyles } from './ribbon-scoped-styles';

const RIBBON_DRAW_STYLES = `
:host { display:inline-flex; align-items:flex-start; color:var(--pptx-foreground,#f8fafc); font:inherit; }
.tools,.settings { display:inline-flex; align-items:flex-start; gap:2px; }
.settings { gap:8px; margin-inline-start:6px; padding-inline-start:8px; border-inline-start:1px solid color-mix(in srgb,var(--pptx-border,#374151) 80%,transparent); font-size:12px; }
label { display:flex; flex-wrap:wrap; align-items:center; gap:4px 6px; width:150px; color:var(--pptx-foreground,#f8fafc); }
label > span { flex:0 0 100%; }
button,input,summary { font:inherit; color:inherit; box-sizing:border-box; }
button,summary,input[type=color] { border:1px solid var(--pptx-border,#374151); background:var(--pptx-background,#111827); border-radius:4px; }
button,summary { cursor:pointer; }
button { min-width:28px; min-height:28px; padding:4px; display:inline-flex; align-items:center; justify-content:center; }
button:hover:not(:disabled),summary:hover { background:var(--pptx-accent,#374151); }
button[aria-pressed=true] { background:var(--pptx-primary,#6366f1); color:var(--pptx-primary-foreground,#fff); }
button:disabled,input:disabled { opacity:.4; cursor:default; }
button:focus-visible,summary:focus-visible,input:focus-visible { outline:2px solid var(--pptx-ring,#818cf8); outline-offset:2px; }
svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; }
details { position:relative; }
/* Pen colour: Office shows the ink colour on the tool; here a swatch sits above its caption. */
summary { box-sizing:border-box; width:56px; height:62px; padding:4px; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; gap:3px; border:0; background:transparent; list-style:none; font-size:12px; line-height:15px; text-align:center; }
summary::-webkit-details-marker { display:none; }
summary[aria-disabled=true] { opacity:.4; cursor:default; }
summary::after { content:''; width:6px; height:6px; margin-top:-3px; border-right:1.5px solid currentColor; border-bottom:1.5px solid currentColor; transform:rotate(45deg) scale(.8); }
.preview { width:30px; height:30px; border:1px solid var(--pptx-border,#374151); border-radius:4px; }
.palette { box-sizing:border-box; position:fixed; z-index:1200; width:240px; max-width:calc(100vw - 16px); max-height:65vh; overflow:auto; padding:8px; background:var(--pptx-popover,#111827); border:1px solid var(--pptx-border,#374151); border-radius:6px; box-shadow:0 8px 24px #0005; }
.swatches { display:flex; flex-wrap:wrap; gap:4px; margin:4px 0 8px; }
.swatch { width:28px; height:28px; border:1px solid var(--pptx-border,#374151); }
input[type=color] { width:30px; height:28px; padding:2px; cursor:pointer; }
input[type=range] { width:72px; accent-color:var(--pptx-primary,#6366f1); }
pptx-ui-select { font-size:11px; }
@media (pointer:coarse),(max-width:900px) {
	button,summary,input[type=color],input[type=range] { min-width:44px; min-height:44px; }
	.swatch { width:44px; height:44px; }
	.palette { width:264px; }
}
@media (forced-colors:active) {
	button,summary,input[type=color],.palette { border-color:ButtonText; }
	button[aria-pressed=true] { outline:2px solid Highlight; }
	.preview,.swatch { forced-color-adjust:none; }
}
`;

export function attachRibbonDrawStyles(doc: Document): void {
	attachScopedRibbonStyles(doc, 'pptx-ui-draw-styles', 'pptx-ui-ribbon-draw', RIBBON_DRAW_STYLES);
}
