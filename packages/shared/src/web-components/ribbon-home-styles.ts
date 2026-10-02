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
}
@media (forced-colors:active) {
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
