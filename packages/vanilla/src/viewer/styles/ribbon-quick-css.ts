/**
 * Quick-access chrome stylesheet fragment: the primary row's React-aligned
 * right cluster (Present split button, popover menus, "+ Show") and the tab
 * row's right-side actions (Record, Share). Split from `ribbon-css.ts` to
 * keep both files inside the repo's per-file size budget; concatenated right
 * after it by {@link buildViewerCss}.
 */
export const RIBBON_QUICK_CSS = `
/* ── Primary-row quick actions ──────────────────────────────────────────── */
.pptxv-primary-sep { width: 1px; align-self: stretch; margin: 0 4px; background: color-mix(in srgb, var(--pptx-border) 40%, transparent); }
/* React-style "Present" split button + its options dropdown. */
.pptxv-present-split { position: relative; display: inline-flex; align-items: stretch; border-left: 1px solid var(--pptx-border); }
.pptxv-present-main {
	padding: 2px 8px;
	border: none;
	background: transparent;
	color: var(--pptx-foreground);
	font: inherit;
	font-size: 12px;
	cursor: pointer;
}
.pptxv-present-main:hover { background: var(--pptx-accent); }
.pptxv-present-caret {
	display: inline-flex;
	align-items: center;
	padding: 0 4px;
	border: none;
	border-left: 1px solid var(--pptx-border);
	background: transparent;
	color: var(--pptx-foreground);
	cursor: pointer;
}
.pptxv-present-caret:hover, .pptxv-present-caret.is-active { background: var(--pptx-accent); }
.pptxv-present-caret svg { width: 12px; height: 12px; }
/* Right-aligned popover menus (Present options + "..." overflow). */
.pptxv-primary-menu {
	position: absolute;
	top: calc(100% + 4px);
	right: 0;
	z-index: 40;
	min-width: 190px;
	max-height: 320px;
	overflow-y: auto;
	padding: 4px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
	box-shadow: 0 6px 20px rgb(0 0 0 / 0.25);
}
.pptxv-primary-menu[hidden] { display: none; }
.pptxv-primary-menu-item {
	display: block;
	width: 100%;
	padding: 6px 8px;
	border: none;
	border-radius: 4px;
	background: transparent;
	color: inherit;
	font: inherit;
	font-size: 12px;
	text-align: left;
	white-space: nowrap;
	cursor: pointer;
}
.pptxv-primary-menu-item:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-primary-menu-sep { margin: 4px 0; border-top: 1px solid color-mix(in srgb, var(--pptx-border) 60%, transparent); }
.pptxv-primary-menu-host { position: relative; display: inline-flex; }
/* Custom-shows quick action ("+ Show"). */
.pptxv-show-btn {
	padding: 2px 8px;
	border: none;
	border-radius: var(--pptx-radius);
	background: var(--pptx-muted);
	color: var(--pptx-foreground);
	font: inherit;
	font-size: 11px;
	white-space: nowrap;
	cursor: pointer;
}
.pptxv-show-btn:hover { background: var(--pptx-accent); }
/* ── Tab-row right-side actions ── */
/* Right side of the tab row: Record + Share, matching React's TabRowActions. */
.pptxv-tabrow-spacer { flex: 1; }
.pptxv-tabrow-actions { display: inline-flex; align-items: center; gap: 4px; padding-right: 4px; }
.pptxv-tabrow-record {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	padding: 3px 9px;
	border: none;
	border-radius: 3px;
	background: transparent;
	color: var(--pptx-muted-foreground);
	font: inherit;
	font-size: 11px;
	font-weight: 500;
	white-space: nowrap;
	cursor: pointer;
}
.pptxv-tabrow-record:hover { background: var(--pptx-accent); color: var(--pptx-foreground); }
.pptxv-tabrow-record-dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; }
.pptxv-tabrow-share, .pptxv-tabrow-share.pptxv-btn {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	width: auto;
	height: auto;
	padding: 3px 10px;
	border: none;
	border-radius: 3px;
	background: var(--pptx-primary);
	color: var(--pptx-primary-foreground, #fff);
	font: inherit;
	font-size: 11px;
	font-weight: 500;
	white-space: nowrap;
	cursor: pointer;
}
.pptxv-tabrow-share:hover, .pptxv-tabrow-share.pptxv-btn:hover:not(:disabled) {
	background: color-mix(in srgb, var(--pptx-primary) 90%, #000);
	color: var(--pptx-primary-foreground, #fff);
}
.pptxv-tabrow-share svg { width: 12px; height: 12px; }
`;
