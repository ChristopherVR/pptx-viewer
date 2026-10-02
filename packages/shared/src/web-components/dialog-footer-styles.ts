import { CHROME_ICON_STYLES } from './chrome-icons';

export const DIALOG_FOOTER_STYLES = `
:host { display: block; flex: 1 1 auto; min-width: 0; }
:host([hidden]) { display: none !important; }
${CHROME_ICON_STYLES}
.footer { box-sizing: border-box; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
button {
	box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
	min-width: 24px; min-height: 32px; padding: 6px 14px; border: 1px solid var(--pptx-border, #3f3f52);
	border-radius: 6px; background: var(--pptx-muted, #2a2a3d); color: var(--pptx-foreground, #e2e8f0);
	font: 500 13px/1.2 system-ui, sans-serif; cursor: pointer; touch-action: manipulation;
}
button:hover:not(:disabled) { background: var(--pptx-accent, #33334d); }
button.primary { border-color: var(--pptx-primary, #c43b32); background: var(--pptx-primary, #c43b32); color: #fff; }
button.primary:hover:not(:disabled) { opacity: .9; background: var(--pptx-primary, #c43b32); }
button.warning { border-color: #d97706; background: #d97706; color: #fff; }
button.warning:hover:not(:disabled) { opacity: .9; background: #d97706; }
button.danger { border-color: #b91c1c; background: #b91c1c; color: #fff; }
button.danger:hover:not(:disabled) { opacity: .9; background: #b91c1c; }
button.start { margin-right: auto; }
button.busy::before { content: ''; width: 12px; height: 12px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: pptx-footer-spin .8s linear infinite; }
@keyframes pptx-footer-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { button.busy::before { animation: none; } }
button:disabled { cursor: not-allowed; opacity: .55; }
button:focus-visible { outline: 2px solid var(--pptx-ring, #6366f1); outline-offset: 2px; }
@media (pointer: coarse) { button { min-width: 44px; min-height: 44px; } }
@media (forced-colors: active) {
	button, button.primary, button.warning, button.danger { border-color: ButtonText; background: ButtonFace; color: ButtonText; }
	button:hover:not(:disabled) { background: Highlight; color: HighlightText; }
	button.primary { border-width: 2px; }
	button:focus-visible { outline-color: Highlight; }
}
`;
