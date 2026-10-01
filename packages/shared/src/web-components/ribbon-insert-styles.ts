import { attachScopedRibbonStyles } from './ribbon-scoped-styles';

const RIBBON_INSERT_STYLES = `
:host { display:inline-flex; align-items:stretch; flex:none; color:var(--pptx-foreground,#f8fafc); font:inherit; }
[hidden] { display:none !important; }
:host[hidden] { display:none !important; }
.stack { display:flex; flex-direction:column; justify-content:flex-start; gap:2px; }
.cluster { display:flex; flex-direction:column; gap:2px; align-items:stretch; }
select,.pick,.trigger,.list button { font:inherit; color:inherit; box-sizing:border-box; }
select { height:28px; max-width:112px; padding:2px 4px; border:1px solid var(--pptx-border,#374151); background:var(--pptx-background,#111827); border-radius:4px; font-size:11px; }
.pick,.trigger { display:inline-flex; align-items:center; justify-content:flex-start; gap:6px; min-height:26px; min-width:88px; padding:0 4px; border:0; border-radius:4px; background:transparent; cursor:pointer; font-size:10px; line-height:11px; }
.pick:hover:not(:disabled),.trigger:hover:not(:disabled),.list button:hover { background:var(--pptx-accent,#33334d); }
.pick:disabled,.trigger:disabled,select:disabled,.list button:disabled { opacity:.35; cursor:not-allowed; }
.pick:focus-visible,.trigger:focus-visible,select:focus-visible,.list button:focus-visible { outline:2px solid var(--pptx-ring,#6366f1); outline-offset:2px; }
svg { width:16px; height:16px; flex:none; fill:none; stroke:currentColor; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; }
.trigger svg:first-child,.pick svg { color:var(--pptx-primary,#6366f1); }
.trigger svg:last-child { width:10px; height:10px; margin-inline-start:auto; }
.menu { position:relative; display:inline-flex; }
.list { position:fixed; z-index:1200; display:flex; flex-direction:column; min-width:170px; max-width:calc(100vw - 16px); max-height:65vh; overflow:auto; padding:4px 0; background:var(--pptx-popover,#111827); border:1px solid var(--pptx-border,#374151); border-radius:6px; box-shadow:0 8px 24px #0005; }
.list[hidden] { display:none; }
.list button { display:flex; align-items:center; gap:8px; width:100%; min-height:28px; padding:4px 12px; border:0; background:transparent; font-size:12px; text-align:left; cursor:pointer; }
.list svg { width:16px; height:16px; }
@media (max-width:767px) {
	:host { flex-wrap:wrap; max-width:100%; }
}
@media (pointer:coarse),(max-width:900px) {
	select,.pick,.list button { min-height:44px; }
	.trigger { min-height:44px; min-width:44px; }
}
@media (forced-colors:active) {
	select,.list { border-color:ButtonText; }
	.trigger svg:first-child { color:ButtonText; }
	.pick:focus-visible,.trigger:focus-visible,.list button:focus-visible { outline-color:Highlight; }
	.pick:disabled,.trigger:disabled,select:disabled { color:GrayText; opacity:1; }
}
`;

export function attachRibbonInsertStyles(doc: Document): void {
	attachScopedRibbonStyles(
		doc,
		'pptx-ui-insert-styles',
		'pptx-ui-ribbon-insert',
		RIBBON_INSERT_STYLES,
	);
}
