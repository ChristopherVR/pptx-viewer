import { attachScopedRibbonStyles } from './ribbon-scoped-styles';

const RIBBON_TRANSITIONS_STYLES = `
:host { display:inline-flex; align-items:stretch; flex:none; color:var(--pptx-foreground,#f8fafc); font:inherit; }
.stack { display:flex; flex-direction:column; justify-content:flex-start; gap:4px; }
.gallery { display:flex; flex-wrap:wrap; align-content:flex-start; gap:4px; max-width:360px; }
.field { display:flex; align-items:center; gap:6px; font-size:11px; color:var(--pptx-muted-foreground,#94a3b8); white-space:nowrap; }
.caption { font-size:10px; font-weight:600; color:var(--pptx-foreground,#f8fafc); }
button,input,select { font:inherit; font-size:11px; color:inherit; box-sizing:border-box; }
.preset,.sound-preview,select,input[type=number],input[type=text] { border:1px solid var(--pptx-border,#374151); border-radius:4px; background:var(--pptx-muted,#1f2937); }
.preset { min-height:26px; padding:0 8px; cursor:pointer; color:var(--pptx-foreground,#f8fafc); }
.preset:hover:not(:disabled),.sound-preview:hover:not(:disabled) { background:var(--pptx-accent,#374151); }
.preset[aria-pressed=true] { border-color:var(--pptx-primary,#6366f1); background:color-mix(in srgb,var(--pptx-primary,#6366f1) 15%,transparent); color:var(--pptx-primary,#6366f1); font-weight:500; }
.sound-preview { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; padding:0; cursor:pointer; }
.sound-preview svg { width:12px; height:12px; fill:none; stroke:currentColor; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; }
select { width:104px; height:26px; padding:0 4px; }
input[type=number] { width:64px; height:26px; padding:0 4px; text-align:center; }
input[type=text] { width:72px; height:22px; padding:0 4px; text-align:center; }
input[type=checkbox] { width:14px; height:14px; margin:0; accent-color:var(--pptx-primary,#6366f1); }
.check { cursor:pointer; }
.sound-file { display:none; }
.inspector { align-self:center; margin-inline-start:8px; }
button:disabled,input:disabled,select:disabled { opacity:.4; cursor:default; }
button:focus-visible,input:focus-visible,select:focus-visible { outline:2px solid var(--pptx-ring,#818cf8); outline-offset:2px; }
@media (pointer:coarse),(max-width:900px) {
	.preset,.sound-preview,select,input[type=number],input[type=text] { min-height:44px; }
	.sound-preview { min-width:44px; }
	input[type=checkbox] { width:22px; height:22px; }
	.check { min-height:44px; }
}
@media (forced-colors:active) {
	.preset,.sound-preview,select,input { border-color:ButtonText; }
	.preset[aria-pressed=true] { outline:2px solid Highlight; }
}
`;

export function attachRibbonTransitionsStyles(doc: Document): void {
	attachScopedRibbonStyles(
		doc,
		'pptx-ui-transitions-styles',
		'pptx-ui-ribbon-transitions',
		RIBBON_TRANSITIONS_STYLES,
	);
}
