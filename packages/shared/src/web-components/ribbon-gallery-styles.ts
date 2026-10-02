const host = 'pptx-ui-ribbon-gallery';
const CSS = `
${host} { display:inline-flex; position:relative; flex:none; color:var(--pptx-foreground,#f9fafb); }
${host} .gallery-view { display:contents; }
${host} button { box-sizing:border-box; font:inherit; color:inherit; cursor:pointer; border:1px solid var(--pptx-border,#374151); border-radius:4px; background:var(--pptx-background,#111827); }
${host} button:hover:not(:disabled) { background:var(--pptx-accent,#33334d); }
${host} button:disabled { opacity:.4; cursor:not-allowed; }
${host} button:focus-visible { outline:2px solid var(--pptx-ring,#6366f1); outline-offset:2px; }
${host} .trigger { display:inline-flex; align-items:center; gap:6px; min-height:26px; padding:4px 8px; font-size:11px; white-space:nowrap; }
${host} .trigger svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; }
${host}[mode=inline] .trigger, ${host}[chevron-only] .trigger { align-self:stretch; padding:0 4px; }
${host} .strip { display:flex; gap:2px; padding:2px; align-items:center; }
${host} .tile { display:inline-flex; align-items:center; justify-content:center; flex:none; padding:2px; }
${host} .tile[aria-pressed=true] { border:2px solid var(--pptx-primary,#6366f1); background:color-mix(in srgb,var(--pptx-primary,#6366f1) 15%,var(--pptx-background,#111827)); }
${host} .tile svg { max-width:100%; max-height:100%; }
${host}[mode=inline] .strip { gap:0; padding:2px; border:1px solid var(--pptx-border,#374151); border-inline-end:0; border-radius:3px 0 0 3px; background:color-mix(in srgb,var(--pptx-muted,#2a2a3d) 30%,transparent); }
${host}[mode=inline] .trigger { border-radius:0 3px 3px 0; background:color-mix(in srgb,var(--pptx-muted,#2a2a3d) 30%,transparent); }
pptx-ui-ribbon-group:is([data-ribbon-group^="shapeFormat."],[data-ribbon-group^="pictureFormat."],[data-ribbon-group^="tableDesign."],[data-ribbon-group^="chartDesign."],[data-ribbon-group^="smartArtDesign."]) ${host}[mode=dropdown] .trigger { border-color:transparent; background:transparent; }
pptx-ui-ribbon-group:is([data-ribbon-group^="shapeFormat."],[data-ribbon-group^="pictureFormat."],[data-ribbon-group^="tableDesign."],[data-ribbon-group^="chartDesign."],[data-ribbon-group^="smartArtDesign."]) ${host}[mode=dropdown] .trigger:hover:not(:disabled) { border-color:var(--pptx-border,#374151); background:var(--pptx-accent,#33334d); }
${host} .trigger.command { border-color:transparent; background:transparent; justify-content:flex-start; }
${host} .trigger.command:hover:not(:disabled) { border-color:var(--pptx-border,#374151); background:var(--pptx-accent,#33334d); }
${host} .trigger.command svg { color:var(--pptx-primary,#6366f1); }
${host} .trigger.command-large { flex-direction:column; align-items:center; justify-content:flex-start; gap:2px; min-width:54px; max-width:78px; height:58px; padding:4px; font-size:10px; line-height:11px; white-space:normal; text-align:center; }
${host} .trigger.command-large svg { width:24px; height:24px; }
${host} .popup { box-sizing:border-box; position:fixed; z-index:1200; max-width:calc(100vw - 16px); max-height:65vh; overflow:auto; padding:8px; border:1px solid var(--pptx-border,#374151); border-radius:6px; background:var(--pptx-popover,#111827); color:var(--pptx-popover-foreground,#f9fafb); box-shadow:0 8px 24px #0006; }
${host} .popup[hidden] { display:none; }
${host} .grid { display:grid; gap:4px; width:max-content; max-width:100%; }
${host} .heading { margin:4px 0 6px; font-size:11px; font-weight:600; }
${host} .section + .section { margin-top:10px; }
@media (pointer:coarse), (max-width:1023px) {
 ${host} .trigger, ${host} .tile { min-height:44px; min-width:44px; }
 ${host} .popup { max-height:60vh; }
}
@media (forced-colors:active) {
 ${host} button, ${host} .popup { color:ButtonText; background:Canvas; border-color:ButtonText; }
 ${host} button:disabled { color:GrayText; opacity:1; }
 ${host} button:focus-visible, ${host} .tile[aria-pressed=true] { outline:2px solid Highlight; border-color:Highlight; }
}
`;

/** Preserve the public light-DOM gallery hooks while scoping every shared rule. */
export function attachRibbonGalleryStyles(doc: Document): void {
	if (!doc.getElementById('pptx-ui-gallery-styles')) {
		const style = doc.createElement('style');
		style.id = 'pptx-ui-gallery-styles';
		style.textContent = CSS;
		doc.head.append(style);
	}
}
