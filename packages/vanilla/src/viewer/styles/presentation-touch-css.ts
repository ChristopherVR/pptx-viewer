/** Touch-only slide-show overlay. Hidden unless the viewer is presenting. */
export const PRESENTATION_TOUCH_CSS = `
.pptxv-presentation-touch-controls { display: none; }
@media (any-pointer: coarse) {
	.pptxv.pptxv-presenting .pptxv-presentation-touch-controls { display: contents; }
	.pptxv-presentation-touch-controls .pptxv-btn { position: fixed; z-index: 90; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 999px; background: rgb(0 0 0 / 55%); box-shadow: 0 4px 14px rgb(0 0 0 / 30%); color: #fff; font-size: 28px; touch-action: manipulation; }
	.pptxv-presentation-touch-controls .pptxv-btn:active { background: rgb(0 0 0 / 75%); }
	.pptxv-presentation-touch-controls .pptxv-btn:disabled { opacity: .3; }
	.pptxv-presentation-touch-controls svg { width: 26px; height: 26px; }
	.pptxv-presentation-touch-exit { top: calc(env(safe-area-inset-top, 0px) + 8px); right: calc(env(safe-area-inset-right, 0px) + 8px); }
	.pptxv-presentation-touch-prev { top: 50%; left: calc(env(safe-area-inset-left, 0px) + 8px); transform: translateY(-50%); }
	.pptxv-presentation-touch-next { top: 50%; right: calc(env(safe-area-inset-right, 0px) + 8px); transform: translateY(-50%); }
	.pptxv-presentation-touch-counter { position: fixed; z-index: 90; bottom: calc(env(safe-area-inset-bottom, 0px) + 8px); left: 50%; padding: 4px 12px; border-radius: 999px; background: rgb(0 0 0 / 55%); color: #fff; font: 12px ui-monospace, monospace; font-variant-numeric: tabular-nums; pointer-events: none; transform: translateX(-50%); }
}
`;
