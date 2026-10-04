const host = 'pptx-ui-ribbon-gallery';
const FORMAT_GROUPS =
	'pptx-ui-ribbon-group:is([data-ribbon-group^="shapeFormat."],[data-ribbon-group^="pictureFormat."],[data-ribbon-group^="tableDesign."],[data-ribbon-group^="chartDesign."],[data-ribbon-group^="smartArtDesign."])';

/**
 * pptx-only gallery rules on top of the shared `office-ui-gallery` styles: dropdown galleries in
 * the contextual format groups draw flat until hovered, as PowerPoint's do.
 */
const CSS = `
${FORMAT_GROUPS} ${host}[mode=dropdown] .trigger { border-color:transparent; background:transparent; }
${FORMAT_GROUPS} ${host}[mode=dropdown] .trigger:hover:not(:disabled) { border-color:var(--pptx-border,#374151); background:var(--pptx-accent,#33334d); }
`;

export function attachRibbonGalleryStyles(doc: Document): void {
	if (!doc.getElementById('pptx-ui-gallery-styles')) {
		const style = doc.createElement('style');
		style.id = 'pptx-ui-gallery-styles';
		style.textContent = CSS;
		doc.head.append(style);
	}
}
