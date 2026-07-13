export const MOBILE_SHEET_CSS = `
.pptxv-mobile-actions { display: none; }
@media (max-width: 720px) {
	.pptxv-mobile-actions { display: contents; }
	.pptxv-mobile-actions > nav { position: absolute; z-index: 50; right: 0; bottom: 0; left: 0; display: flex; min-height: 64px; padding-bottom: env(safe-area-inset-bottom); border-top: 1px solid var(--pptx-border); background: var(--pptx-card); }
	.pptxv-mobile-actions > nav button { flex: 1; min-width: 44px; border: 0; background: transparent; color: var(--pptx-muted-foreground); font-size: 10px; touch-action: manipulation; }
	.pptxv-mobile-actions > nav button[aria-pressed='true'] { color: var(--pptx-primary); }
	.pptxv-mobile-sheet-host { position: absolute; z-index: 48; inset: 0 0 64px; display: flex; align-items: end; }
	.pptxv-mobile-sheet-host[hidden] { display: none; }
	.pptxv-mobile-sheet-backdrop { position: absolute; inset: 0; width: 100%; border: 0; background: rgb(0 0 0 / 40%); }
	.pptxv-mobile-sheet { position: relative; display: flex; flex-direction: column; width: 100%; max-height: min(70dvh, 620px); border: 1px solid var(--pptx-border); border-bottom: 0; border-radius: 16px 16px 0 0; background: var(--pptx-background); box-shadow: 0 -12px 36px rgb(0 0 0 / 35%); transition: transform 150ms ease-out; }
	.pptxv-mobile-sheet-header { display: grid; justify-items: center; gap: 5px; padding: 8px 16px 10px; border-bottom: 1px solid var(--pptx-border); cursor: grab; touch-action: none; }
	.pptxv-mobile-sheet-handle { width: 40px; height: 4px; border-radius: 2px; background: var(--pptx-muted-foreground); opacity: .45; }
	.pptxv-mobile-sheet-body { display: flex; flex-wrap: wrap; gap: 8px; overflow: auto; padding: 12px; overscroll-behavior: contain; }
	.pptxv-mobile-sheet-body > button { min-height: 44px; padding: 8px 12px; border: 1px solid var(--pptx-border); border-radius: 8px; background: var(--pptx-muted); color: inherit; }
	.pptxv-mobile-slide-list { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; width: 100%; }
	.pptxv-mobile-slide-list button { min-height: 44px; border: 1px solid var(--pptx-border); border-radius: 8px; background: var(--pptx-muted); color: inherit; }
	.pptxv-mobile-slide-list button.is-active { border-color: var(--pptx-primary); color: var(--pptx-primary); }
	.pptxv-mobile-sheet .pptxv-inspector { display: flex; width: 100%; max-height: 55dvh; border: 0; }
	.pptxv-mobile-nav { bottom: calc(72px + env(safe-area-inset-bottom)); }
}
`;
