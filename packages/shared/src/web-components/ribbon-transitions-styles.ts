import { attachScopedRibbonStyles } from './ribbon-scoped-styles';

const RIBBON_TRANSITIONS_STYLES = `
:host { display:inline-flex; align-items:stretch; flex:none; color:var(--pptx-foreground,#f8fafc); font:inherit; }
.stack { display:flex; flex-direction:column; justify-content:flex-start; gap:4px; }
.gallery { display:flex; align-items:stretch; box-sizing:border-box; height:62px; max-width:520px; border:1px solid color-mix(in srgb,var(--pptx-border,#374151) 70%,transparent); border-radius:3px; background:color-mix(in srgb,var(--pptx-muted,#2a2a3d) 30%,transparent); }
.strip { display:flex; flex:1; min-width:0; overflow-x:auto; scrollbar-width:none; scroll-snap-type:x proximity; }
.strip::-webkit-scrollbar { display:none; }
.more { flex:none; width:16px; padding:0; border:0; border-inline-start:1px solid color-mix(in srgb,var(--pptx-border,#374151) 70%,transparent); background:transparent; color:inherit; cursor:pointer; }
.more:hover { background:var(--pptx-accent,#33334d); }
.more-icon { width:12px; height:12px; fill:none; stroke:currentColor; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; transform:rotate(-90deg); }
.field { display:flex; align-items:center; gap:6px; font-size:11px; color:var(--pptx-muted-foreground,#94a3b8); white-space:nowrap; }
.caption { font-size:10px; font-weight:600; color:var(--pptx-foreground,#f8fafc); }
button,input { font:inherit; font-size:11px; color:inherit; box-sizing:border-box; }
.sound-preview,input[type=number],input[type=text] { border:1px solid var(--pptx-border,#374151); border-radius:4px; background:var(--pptx-muted,#1f2937); }
.preset { display:inline-flex; flex-direction:column; align-items:center; justify-content:flex-start; gap:3px; flex:none; width:58px; height:58px; padding:4px 2px 0; border:1px solid transparent; border-radius:2px; background:transparent; font-size:10px; line-height:12px; text-align:center; cursor:pointer; color:var(--pptx-foreground,#f8fafc); scroll-snap-align:start; }
.preset .name { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tile-icon { width:36px; height:24px; flex:none; fill:none; stroke:var(--pptx-primary,#6366f1); stroke-width:1.4; stroke-linecap:round; stroke-linejoin:round; }
.preset:hover:not(:disabled) { border-color:var(--pptx-border,#374151); background:var(--pptx-accent,#374151); }
.sound-preview:hover:not(:disabled) { background:var(--pptx-accent,#374151); }
.preset[aria-pressed=true] { border-color:var(--pptx-primary,#6366f1); background:color-mix(in srgb,var(--pptx-primary,#6366f1) 15%,transparent); color:var(--pptx-primary,#6366f1); }
.sound-preview { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; padding:0; cursor:pointer; }
.sound-preview svg { width:12px; height:12px; fill:none; stroke:currentColor; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; }
pptx-ui-select { width:104px; font-size:11px; }
input[type=number] { width:64px; height:26px; padding:0 4px; text-align:center; }
input[type=text] { width:72px; height:22px; padding:0 4px; text-align:center; }
.check { cursor:pointer; }
.sound-file { display:none; }
input[type=number]::-webkit-inner-spin-button { opacity:1; }
button:disabled,input:disabled { opacity:.4; cursor:default; }
button:focus-visible,input:focus-visible { outline:2px solid var(--pptx-ring,#818cf8); outline-offset:2px; }
.preset:focus-visible,.more:focus-visible { outline-offset:-2px; }
@media (pointer:coarse),(max-width:900px) {
	.sound-preview,input[type=number],input[type=text] { min-height:44px; }
	.sound-preview { min-width:44px; }
	.check { min-height:44px; }
}
@media (forced-colors:active) {
	.preset,.gallery,.sound-preview,input { border-color:ButtonText; }
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
