export const RIBBON_COMMAND_STYLES = `
:host { display: inline-flex; flex: none; }
button {
	box-sizing: border-box; display: inline-flex; flex-direction: column; align-items: center;
	justify-content: flex-start; gap: 2px; min-width: 54px; max-width: 78px; height: 58px;
	padding: 4px; border: 0; border-radius: 4px; background: transparent;
	color: var(--pptx-foreground, #f9fafb); cursor: pointer; font: inherit;
	font-size: 9px; line-height: 11px; text-align: center;
}
svg { width: 24px; height: 24px; flex: none; color: var(--pptx-primary, #6366f1);
	fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
:host([compact]) button { flex-direction: row; align-items: center; justify-content: flex-start;
	gap: 6px; min-width: 88px; max-width: none; height: 26px; padding: 0 4px; font-size: 10px; text-align: left; }
:host([compact]) svg { width: 16px; height: 16px; }
button:hover:not(:disabled) { background: var(--pptx-accent, #33334d); }
:host([active]) button { background: color-mix(in srgb, var(--pptx-primary, #6366f1) 15%, transparent); color: var(--pptx-primary, #6366f1); }
button:disabled { opacity: .35; cursor: not-allowed; }
button:focus-visible { outline: 2px solid var(--pptx-ring, #6366f1); outline-offset: 2px; }
@media (pointer: coarse), (max-width: 767px) { :host([compact]) button { min-height: 44px; } }
@media (forced-colors: active) {
	button { color: ButtonText; } svg { color: ButtonText; }
	button:disabled { color: GrayText; opacity: 1; }
	button:focus-visible { outline-color: Highlight; }
	:host([active]) button { border: 1px solid Highlight; }
}
`;
