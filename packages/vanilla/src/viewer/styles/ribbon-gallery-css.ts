/**
 * Ribbon style galleries (dropdown + inline strip + dropped-down panel), the
 * contextual tab accent, and the `display: contents` wrappers the ribbon
 * customisation tagging adds. Split from `ribbon-css.ts` to keep both files
 * inside the per-file size budget.
 */
export const RIBBON_GALLERY_CSS = `
/* ── Ribbon galleries ──────────────────────────────────────────────────── */
.pptxv-ribbon-contents { display: contents; }
.pptxv-gallery { position: relative; display: inline-flex; align-items: stretch; }
.pptxv-gallery-inline {
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-background);
}
.pptxv-gallery-inline.is-disabled { opacity: 0.5; }
.pptxv-gallery-strip { display: flex; align-items: center; gap: 2px; padding: 2px; max-width: 320px; overflow: hidden; }
.pptxv-gallery-strip .pptxv-gallery-tile svg { width: auto; max-width: 48px; height: 32px; }
.pptxv-gallery-more {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 18px;
	padding: 0;
	border: none;
	border-left: 1px solid var(--pptx-border);
	background: transparent;
	color: inherit;
	cursor: pointer;
}
.pptxv-gallery-more:hover:not(:disabled) { background: var(--pptx-accent); }
.pptxv-gallery-more:disabled { opacity: 0.4; cursor: default; }
.pptxv-gallery-more svg { width: 12px; height: 12px; }
.pptxv-gallery-chevron { width: 16px; min-width: 16px; padding: 0; justify-content: center; border-color: transparent; background: transparent; }
.pptxv-split-gallery { display: inline-flex; align-items: center; }
.pptxv-gallery-popup {
	/* Positioned by attachAnchoredPopup (position: fixed), escaping the ribbon
	   row's overflow clip like every other ribbon menu. */
	z-index: 30;
	max-width: min(560px, calc(100vw - 16px));
	max-height: min(420px, calc(100vh - 120px));
	overflow: auto;
	padding: 6px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
	box-shadow: 0 6px 20px rgb(0 0 0 / 0.25);
}
.pptxv-gallery-popup[hidden] { display: none; }
.pptxv-gallery-section + .pptxv-gallery-section { margin-top: 6px; }
.pptxv-gallery-heading {
	padding: 2px 4px 4px;
	color: var(--pptx-muted-foreground);
	font-size: 10px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.04em;
}
.pptxv-gallery-grid { display: grid; gap: 4px; }
.pptxv-gallery-tile {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 2px;
	border: 1px solid transparent;
	border-radius: 4px;
	background: transparent;
	cursor: pointer;
	line-height: 0;
}
.pptxv-gallery-tile:hover:not(:disabled) { border-color: var(--pptx-border); background: var(--pptx-accent); }
.pptxv-gallery-tile.is-applied { border-color: var(--pptx-primary); }
.pptxv-gallery-tile:disabled { opacity: 0.5; cursor: default; }
.pptxv-gallery-tile:focus-visible { outline: 2px solid var(--pptx-primary); outline-offset: 1px; }
/* PowerPoint tints contextual tabs so they read as selection-driven. */
.pptxv-ribbon-tab.pptxv-ribbon-tab-contextual { color: var(--pptx-primary); }
.pptxv-ribbon-tab.pptxv-ribbon-tab-contextual.is-active { border-bottom-color: var(--pptx-primary); }
`;
