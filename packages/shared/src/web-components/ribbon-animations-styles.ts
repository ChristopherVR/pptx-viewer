import { attachScopedRibbonStyles } from './ribbon-scoped-styles';

const RIBBON_ANIMATIONS_STYLES = `
:host { display:inline-flex; align-items:stretch; flex:none; color:var(--pptx-foreground,#f8fafc); font:inherit; }
.stack { display:flex; flex-direction:column; justify-content:flex-start; gap:2px; }
.gallery { display:flex; align-items:flex-start; gap:8px; box-sizing:border-box; max-height:62px; overflow-y:auto; padding:4px 6px; border:1px solid color-mix(in srgb,var(--pptx-border,#374151) 60%,transparent); border-radius:2px; background:color-mix(in srgb,var(--pptx-muted,#2a2a3d) 30%,transparent); }
.column { display:flex; flex-direction:column; gap:2px; }
.caption { font-size:9px; font-weight:600; line-height:12px; color:var(--pptx-muted-foreground,#94a3b8); }
.items { display:flex; flex-wrap:wrap; gap:2px; max-width:150px; }
.preset { display:inline-flex; align-items:center; gap:2px; box-sizing:border-box; min-height:18px; padding:2px 4px; border:0; border-radius:2px; background:transparent; color:var(--pptx-foreground,#f8fafc); font:inherit; font-size:9px; line-height:12px; cursor:pointer; white-space:nowrap; }
.preset:hover:not(:disabled) { background:var(--pptx-accent,#33334d); }
.preset:disabled { opacity:.35; cursor:default; }
.preset:focus-visible,select:focus-visible,input:focus-visible { outline:2px solid var(--pptx-ring,#818cf8); outline-offset:2px; }
.preset::before { content:''; width:10px; height:10px; flex:none; background:currentColor; forced-color-adjust:none; clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%); }
.preset[data-tone=entrance]::before { background:#10b981; }
.preset[data-tone=emphasis]::before { background:#f59e0b; }
.preset[data-tone=exit]::before { background:#ef4444; }
.preset[data-tone=path]::before { background:#0ea5e9; clip-path:polygon(0 40%,60% 40%,60% 15%,100% 50%,60% 85%,60% 60%,0 60%); }
.timing { display:grid; grid-template-columns:48px 82px; align-items:center; gap:4px; font-size:10px; }
.timing span { display:inline-flex; align-items:center; gap:4px; }
.timing svg { width:12px; height:12px; fill:none; stroke:currentColor; stroke-width:1.6; }
select,input { box-sizing:border-box; height:24px; min-width:0; padding:0 4px; border:1px solid var(--pptx-border,#374151); border-radius:2px; background:var(--pptx-muted,#2a2a3d); color:inherit; font:inherit; font-size:10px; }
select:disabled,input:disabled { opacity:.4; }
[data-ribbon-group="animations.animation"] { max-width:500px; overflow:hidden; }
[data-ribbon-group="animations.motionPath"] { max-width:420px; overflow:hidden; }
@media (pointer:coarse),(max-width:900px) {
	.preset { min-height:44px; padding:4px 8px; }
	select,input { min-height:44px; }
}
@media (forced-colors:active) {
	.gallery,select,input { border-color:ButtonText; }
	.preset { border:1px solid ButtonText; }
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
