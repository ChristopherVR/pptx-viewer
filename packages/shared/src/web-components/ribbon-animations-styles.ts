import { attachScopedRibbonStyles } from './ribbon-scoped-styles';

const RIBBON_ANIMATIONS_STYLES = `
:host { display:inline-flex; align-items:stretch; flex:none; color:var(--pptx-foreground,#f8fafc); font:inherit; }
.stack { display:flex; flex-direction:column; justify-content:flex-start; gap:2px; }
.gallery { display:flex; align-items:stretch; box-sizing:border-box; height:62px; border:1px solid color-mix(in srgb,var(--pptx-border,#374151) 70%,transparent); border-radius:3px; background:color-mix(in srgb,var(--pptx-muted,#2a2a3d) 30%,transparent); }
.strip { display:flex; flex:1; min-width:0; overflow-x:auto; scrollbar-width:none; scroll-snap-type:x proximity; }
.strip::-webkit-scrollbar { display:none; }
.column { display:flex; flex:none; }
.column + .column { margin-inline-start:4px; padding-inline-start:4px; border-inline-start:1px solid color-mix(in srgb,var(--pptx-border,#374151) 70%,transparent); }
.preset { display:inline-flex; flex-direction:column; align-items:center; justify-content:flex-start; gap:3px; box-sizing:border-box; flex:none; width:54px; height:58px; padding:4px 1px 0; border:1px solid transparent; border-radius:2px; background:transparent; color:var(--pptx-foreground,#f8fafc); font:inherit; font-size:10px; line-height:12px; text-align:center; cursor:pointer; scroll-snap-align:start; }
.preset .name { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tile-icon { width:26px; height:26px; flex:none; fill:none; stroke:currentColor; stroke-width:1.4; stroke-linecap:round; stroke-linejoin:round; forced-color-adjust:none; }
.preset[data-tone=entrance] .tile-icon { color:#10b981; fill:color-mix(in srgb,#10b981 25%,transparent); }
.preset[data-tone=emphasis] .tile-icon { color:#f59e0b; fill:color-mix(in srgb,#f59e0b 25%,transparent); }
.preset[data-tone=exit] .tile-icon { color:#ef4444; fill:color-mix(in srgb,#ef4444 25%,transparent); }
.preset[data-tone=path] .tile-icon { color:#0ea5e9; fill:none; }
.preset:hover:not(:disabled) { border-color:var(--pptx-border,#374151); background:var(--pptx-accent,#33334d); }
.preset:disabled { opacity:.35; cursor:default; }
.preset:focus-visible,.more:focus-visible,input:focus-visible { outline:2px solid var(--pptx-ring,#818cf8); outline-offset:-2px; }
.more { flex:none; width:16px; padding:0; border:0; border-inline-start:1px solid color-mix(in srgb,var(--pptx-border,#374151) 70%,transparent); background:transparent; color:inherit; cursor:pointer; }
.more:hover { background:var(--pptx-accent,#33334d); }
.more-icon { width:12px; height:12px; fill:none; stroke:currentColor; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; transform:rotate(-90deg); }
.timing { display:grid; grid-template-columns:48px 82px; align-items:center; gap:4px; font-size:10px; }
.timing span { display:inline-flex; align-items:center; gap:4px; }
.timing svg { width:12px; height:12px; fill:none; stroke:currentColor; stroke-width:1.6; }
pptx-ui-select { min-width:0; font-size:10px; }
input { box-sizing:border-box; height:24px; min-width:0; padding:0 4px; border:1px solid var(--pptx-border,#374151); border-radius:2px; background:var(--pptx-muted,#2a2a3d); color:inherit; font:inherit; font-size:10px; }
input:disabled { opacity:.4; }
input[type=number]::-webkit-inner-spin-button { opacity:1; }
.gallery { max-width:430px; }
[data-ribbon-control="animations.motionPath.gallery"] { max-width:240px; }
@media (pointer:coarse),(max-width:900px) {
	input { min-height:44px; }
}
@media (forced-colors:active) {
	.gallery,input { border-color:ButtonText; }
	.preset { border-color:ButtonText; }
}
`;

export function attachRibbonAnimationsStyles(doc: Document): void {
	attachScopedRibbonStyles(
		doc,
		'pptx-ui-animations-styles',
		'pptx-ui-ribbon-animations',
		RIBBON_ANIMATIONS_STYLES,
	);
}
