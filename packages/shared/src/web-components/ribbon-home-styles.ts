import { attachScopedRibbonStyles } from './ribbon-scoped-styles';

export const RIBBON_HOME_TAGS = [
	'pptx-ui-ribbon-home-clipboard',
	'pptx-ui-ribbon-home-font',
	'pptx-ui-ribbon-home-paragraph',
	'pptx-ui-ribbon-home-editing',
	'pptx-ui-ribbon-home-slides',
	'pptx-ui-ribbon-home-drawing',
	'pptx-ui-ribbon-home-arrange-align',
	'pptx-ui-ribbon-home-arrange-flip',
	'pptx-ui-ribbon-home-arrange-order',
	'pptx-ui-ribbon-home-arrange-edit',
	'pptx-ui-ribbon-home-font-picker',
	'pptx-ui-ribbon-home-arrange-painter',
	'pptx-ui-ribbon-home-arrange-shape',
] as const;

const RIBBON_HOME_STYLES = `
:host { display:contents; }
.home { display:contents; }
.group { display:flex; flex-direction:column; align-items:center; gap:2px; }
.row { display:flex; align-items:center; gap:4px; }
.wrap { display:inline-flex; align-items:center; gap:4px; }
.free { display:inline-flex; align-items:center; gap:4px; }
.slot { position:relative; display:inline-flex; align-items:center; }
.slot[hidden] { display:none !important; }
.free button.b { border-radius:4px; background:var(--pptx-muted,#2a2a3d); gap:6px; white-space:nowrap; }
.free button.b[data-tone=danger] { background:color-mix(in srgb,#b91c1c 80%,transparent); }
.free button.b[data-tone=danger]:hover:not(:disabled) { background:#dc2626; }
.slot > button.b[data-pptx-chrome=split-main] { border-radius:4px 0 0 4px; background:var(--pptx-muted,#2a2a3d); gap:6px; white-space:nowrap; }
.slot > button.b[data-pptx-chrome=split-caret] { min-width:20px; padding:0 4px; border-radius:0 4px 4px 0; border-left:1px solid color-mix(in srgb,var(--pptx-border,#475569) 40%,transparent); background:var(--pptx-muted,#2a2a3d); align-self:stretch; height:auto; }
.slot > button.b[data-pptx-chrome=split-caret] svg { width:12px; height:12px; }
.text { white-space:nowrap; }
button.b .chev { width:12px; height:12px; }
.free button.b[aria-pressed=true] { background:var(--pptx-accent,#33334d); }
.free button.b[data-testid=format-painter-toggle][aria-pressed=true] { background:#d97706; color:#fffbeb; box-shadow:none; }
.free pptx-ui-select, .wrap pptx-ui-select { flex:none; }
input.num { box-sizing:border-box; width:52px; height:26px; padding:0 4px; border:1px solid var(--pptx-border,#475569); border-radius:4px; background:var(--pptx-muted,#2a2a3d); color:var(--pptx-foreground,#f8fafc); font:inherit; font-size:11px; text-align:center; }
input.num:disabled { opacity:.4; }
input.num:focus-visible { outline:2px solid var(--pptx-ring,#818cf8); outline-offset:-2px; }
.popup { box-sizing:border-box; position:fixed; z-index:1200; max-width:calc(100vw - 16px); max-height:min(70vh,520px); overflow:auto; padding:4px 0; border:1px solid var(--pptx-border,#475569); border-radius:8px; background:var(--pptx-popover,#111827); color:var(--pptx-popover-foreground,#f8fafc); box-shadow:0 8px 24px #0006; font-size:12px; }
.popup[hidden] { display:none; }
.popup[role=dialog] { padding:8px; }
.popup .heading { padding:6px 12px 2px; font-size:10px; font-weight:600; color:var(--pptx-muted-foreground,#94a3b8); }
.popup[role=dialog] .heading { padding:4px 0 2px; }
.popup hr { margin:4px 0; border:0; height:1px; background:var(--pptx-border,#475569); }
.popup button.item { box-sizing:border-box; display:flex; align-items:center; gap:8px; width:100%; min-width:120px; padding:6px 12px; border:0; background:transparent; color:inherit; font:inherit; text-align:left; cursor:pointer; }
.popup button.item:hover:not(:disabled), .popup button.item:focus-visible { background:var(--pptx-accent,#33334d); outline:0; }
.popup button.item:disabled { opacity:.4; cursor:default; }
.popup button.item svg { width:14px; height:14px; flex:none; fill:none; stroke:currentColor; stroke-width:1.2; }
.popup button.item .label { flex:1; white-space:nowrap; }
.popup button.item .mark { margin-left:auto; color:var(--pptx-primary,#6366f1); }
.popup .theme-grid { display:grid; gap:2px; justify-content:start; margin-bottom:4px; }
.popup .std-grid { display:grid; grid-template-columns:repeat(6,20px); gap:4px; margin-bottom:6px; }
.popup .recent { display:flex; flex-wrap:wrap; align-items:center; gap:4px; margin-top:4px; font-size:9px; color:var(--pptx-muted-foreground,#94a3b8); }
.popup button.sw { box-sizing:border-box; width:16px; height:16px; min-width:0; min-height:0; padding:0; border:1px solid var(--pptx-border,#475569); border-radius:3px; cursor:pointer; }
.popup .std-grid button.sw, .popup .recent button.sw { width:20px; height:20px; }
.popup button.sw:hover:not(:disabled) { transform:scale(1.15); }
.popup button.sw[aria-pressed=true] { border-color:var(--pptx-primary,#6366f1); box-shadow:0 0 0 1px var(--pptx-primary,#6366f1); }
.popup button.sw:focus-visible { outline:2px solid var(--pptx-ring,#818cf8); outline-offset:1px; }
.popup button.custom { width:100%; padding:4px 0; border:0; background:transparent; color:var(--pptx-muted-foreground,#94a3b8); font:inherit; font-size:10px; cursor:pointer; }
.popup button.custom:hover { color:var(--pptx-foreground,#f8fafc); }
.popup .custom-input { position:absolute; width:1px; height:1px; opacity:0; pointer-events:none; }
.popup[data-testid=layout-gallery-menu] { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; width:620px; padding:12px; }
.popup[data-testid=layout-gallery-menu][hidden] { display:none; }
.popup .empty { grid-column:1 / -1; margin:0; padding:12px 8px; color:var(--pptx-muted-foreground,#94a3b8); }
.popup button.tile { display:flex; flex-direction:column; align-items:center; gap:4px; min-width:0; padding:4px; border:2px solid transparent; border-radius:4px; background:transparent; color:inherit; font:inherit; cursor:pointer; }
.popup button.tile:hover { background:var(--pptx-accent,#33334d); }
.popup button.tile[aria-current=true] { border-color:var(--pptx-primary,#6366f1); background:color-mix(in srgb,var(--pptx-primary,#6366f1) 12%,transparent); }
.popup button.tile:focus-visible { outline:2px solid var(--pptx-ring,#818cf8); }
.popup .thumb { position:relative; flex:none; overflow:hidden; border:1px solid color-mix(in srgb,var(--pptx-border,#475569) 70%,transparent); border-radius:2px; box-shadow:0 1px 2px #0004; }
.popup .surface { position:absolute; left:0; top:0; transform-origin:top left; overflow:hidden; }
.popup .frame { position:absolute; box-sizing:border-box; border:0 dashed color-mix(in srgb,var(--pptx-muted-foreground,#94a3b8) 70%,transparent); background:color-mix(in srgb,var(--pptx-background,#111827) 20%,transparent); }
.popup .name { width:100%; overflow:hidden; text-align:center; text-overflow:ellipsis; white-space:nowrap; }
.caption { color:var(--pptx-muted-foreground,#94a3b8); font-size:9px; line-height:9px; text-align:center; }
.cluster { display:inline-flex; align-items:center; border-radius:3px; overflow:hidden; background:var(--pptx-muted,#2a2a3d); }
button.b { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; min-width:32px; height:28px; padding:6px 10px; border:0; border-radius:0; background:transparent; color:var(--pptx-foreground,#f8fafc); font:inherit; font-size:12px; cursor:pointer; }
button.b[hidden] { display:none !important; }
button.b svg { width:16px; height:16px; flex:none; }
button.b:hover:not(:disabled) { background:var(--pptx-accent,#33334d); }
button.b[aria-pressed=true] { background:var(--pptx-accent,#33334d); box-shadow:inset 0 0 0 1px var(--pptx-primary,#6366f1); }
button.b:disabled { opacity:.4; cursor:default; }
button.b:focus-visible { outline:2px solid var(--pptx-ring,#818cf8); outline-offset:-2px; }
@media (pointer:coarse),(max-width:900px) {
	button.b { min-width:44px !important; min-height:44px !important; }
	input.num { min-height:44px; }
	.popup button.item { min-height:44px; }
	.popup button.sw { min-width:28px; min-height:28px; }
}
@media (max-width:700px) { .popup[data-testid=layout-gallery-menu] { grid-template-columns:repeat(2,minmax(0,1fr)); width:min(620px,calc(100vw - 16px)); } }
@media (forced-colors:active) {
	.popup { border:1px solid ButtonText; background:Canvas; color:CanvasText; }
	.popup button.item:hover:not(:disabled), .popup button.item:focus-visible { outline:2px solid Highlight; }
	.popup button.tile[aria-current=true], .popup button.sw[aria-pressed=true] { outline:2px solid Highlight; }
	.cluster { border:1px solid ButtonText; }
	button.b[aria-pressed=true] { outline:2px solid Highlight; outline-offset:-2px; }
	button.b:disabled { color:GrayText; }
}
`;

export function attachRibbonHomeStyles(doc: Document): void {
	for (const tag of RIBBON_HOME_TAGS) {
		attachScopedRibbonStyles(doc, `${tag}-styles`, tag, RIBBON_HOME_STYLES);
	}
}
