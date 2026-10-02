export const CONTEXT_MENU_STYLES = `
:host { color: var(--pptx-popover-foreground, #e2e8f0); font: 12px/16px system-ui, sans-serif; }
.menu {
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	min-width: 180px;
	max-height: calc(100vh - 16px);
	overflow-y: auto;
	padding: 6px 0;
	border: 1px solid var(--pptx-border, #33334d);
	border-radius: var(--pptx-radius, 6px);
	background: var(--pptx-popover, #1e1e2e);
	color: inherit;
	box-shadow: 0 18px 40px rgb(0 0 0 / 35%);
	user-select: none;
}
.menu:focus { outline: none; }
.item {
	box-sizing: border-box;
	display: flex;
	align-items: center;
	width: 100%;
	min-height: 28px;
	padding: 6px 12px;
	border: 0;
	background: transparent;
	color: inherit;
	font: inherit;
	text-align: left;
	white-space: nowrap;
	cursor: pointer;
}
.item:hover:not(:disabled),
.item:focus-visible,
.item:focus:not(:disabled) {
	background: var(--pptx-accent, #33334d);
	color: var(--pptx-accent-foreground, inherit);
	outline: none;
}
.item:focus-visible { outline: 2px solid var(--pptx-ring, #6366f1); outline-offset: -2px; }
.item:disabled { opacity: .45; cursor: default; }
.item.danger { color: var(--pptx-destructive, #f87171); }
.check { flex: none; width: 14px; margin-right: 6px; text-align: center; }
.separator { height: 1px; margin: 5px 0; background: var(--pptx-border, #33334d); }
.heading {
	padding: 6px 12px 2px;
	color: var(--pptx-muted-foreground, #9ca3af);
	font-size: 10px;
	font-weight: 600;
	letter-spacing: .06em;
	text-transform: uppercase;
}
@media (pointer: coarse) {
	.item { min-height: 44px; }
}
@media (forced-colors: active) {
	.menu { border-color: CanvasText; background: Canvas; color: CanvasText; box-shadow: none; }
	.item, .item.danger { color: CanvasText; }
	.item:disabled { color: GrayText; opacity: 1; }
	.item:hover:not(:disabled),
	.item:focus:not(:disabled) { background: Highlight; color: HighlightText; }
	.item:focus-visible { outline: 2px solid CanvasText; outline-offset: -4px; }
	.separator { background: CanvasText; }
	.heading { color: CanvasText; }
}
`;
