export const MOBILE_SHEET_CSS = `
.pptxv-mobile-toolbar, .pptxv-mobile-actions { display: none; }
@media (max-width: 767px), (max-width: 1023px) and (max-height: 520px) {
	.pptxv-ribbon { display: none; }
	.pptxv-mobile-toolbar { position: relative; z-index: 20; display: flex; flex: none; align-items: center; gap: 4px; min-height: 52px; padding: max(env(safe-area-inset-top), 0px) 8px 4px; border-bottom: 1px solid var(--pptx-border); background: color-mix(in srgb, var(--pptx-muted) 55%, var(--pptx-card)); }
	.pptxv-mobile-toolbar-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--pptx-foreground); touch-action: manipulation; }
	.pptxv-mobile-toolbar-btn:hover:not(:disabled) { background: var(--pptx-accent); }
	.pptxv-mobile-toolbar-btn:disabled { opacity: .4; }
	.pptxv-mobile-toolbar-btn svg { width: 20px; height: 20px; }
	.pptxv-mobile-toolbar-spacer { flex: 1; }
	.pptxv-mobile-present { color: var(--pptx-primary); }
	.pptxv-mobile-toolbar-collaboration { display: flex; }
	.pptxv-mobile-toolbar-collaboration[hidden], .pptxv-mobile-toolbar-collaboration:empty { display: none; }
	.pptxv-mobile-toolbar-ai { display: flex; }
	.pptxv-mobile-toolbar-ai[hidden], .pptxv-mobile-toolbar-ai:empty { display: none; }
	.pptxv-mobile-toolbar-ai .pptxv-ai-toggle.is-active { color: var(--pptx-primary); background: transparent; }
	.pptxv-mobile-share { min-width: 44px; background: var(--pptx-primary); color: var(--pptx-primary-foreground); }
	.pptxv-mobile-actions { display: contents; }
	.pptxv-mobile-actions > nav { position: relative; z-index: 50; display: flex; flex: none; min-height: 64px; padding-bottom: env(safe-area-inset-bottom); border-top: 1px solid var(--pptx-border); background: var(--pptx-card); }
	.pptxv-mobile-actions > nav button { position: relative; display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-width: 44px; border: 0; background: transparent; color: var(--pptx-muted-foreground); font-size: 10px; touch-action: manipulation; }
	.pptxv-mobile-actions > nav button svg { width: 20px; height: 20px; }
	.pptxv-mobile-actions > nav button[aria-pressed='true'] { color: var(--pptx-primary); }
	.pptxv-mobile-sheet-host { position: absolute; z-index: 48; inset: 0 0 64px; display: flex; align-items: end; }
	.pptxv-mobile-sheet-host[hidden] { display: none; }
	.pptxv-mobile-sheet-backdrop { position: absolute; inset: 0; width: 100%; border: 0; background: rgb(0 0 0 / 40%); }
	.pptxv-mobile-sheet { position: relative; display: flex; flex-direction: column; width: 100%; max-height: min(70dvh, 620px); border: 1px solid var(--pptx-border); border-bottom: 0; border-radius: 16px 16px 0 0; background: var(--pptx-background); box-shadow: 0 -12px 36px rgb(0 0 0 / 35%); transition: transform 150ms ease-out; }
	.pptxv-mobile-sheet-header { display: grid; justify-items: center; gap: 5px; padding: 8px 16px 10px; border-bottom: 1px solid var(--pptx-border); cursor: grab; touch-action: none; }
	.pptxv-mobile-sheet-handle { width: 40px; height: 4px; border-radius: 2px; background: var(--pptx-muted-foreground); opacity: .45; }
	.pptxv-mobile-sheet-body { display: flex; flex-wrap: wrap; gap: 8px; overflow: auto; padding: 12px; overscroll-behavior: contain; }
	.pptxv-mobile-sheet-body > button { min-height: 44px; padding: 8px 12px; border: 1px solid var(--pptx-border); border-radius: 8px; background: var(--pptx-muted); color: inherit; }
	/* A vertical list of real thumbnails, the way React's mobile Slides sheet
	   shows them; the five-column grid of title pills it replaced could not show
	   the slides at all. */
	.pptxv-mobile-slide-list { display: flex; flex-direction: column; gap: 8px; width: 100%; max-height: 46dvh; overflow-y: auto; }
	.pptxv-mobile-comment { display: grid; gap: 6px; padding: 8px 0; border-bottom: 1px solid var(--pptx-border); }
	.pptxv-mobile-comment textarea, .pptxv-mobile-comment-add textarea { box-sizing: border-box; width: 100%; min-height: 58px; padding: 8px; border: 1px solid var(--pptx-border); border-radius: var(--pptx-radius); background: var(--pptx-background); color: var(--pptx-foreground); font: inherit; }
	.pptxv-mobile-comment-actions { display: flex; flex-wrap: wrap; gap: 6px; }
	.pptxv-mobile-comment-actions button, .pptxv-mobile-comment-add button { min-height: 36px; padding: 6px 10px; border: 1px solid var(--pptx-border); border-radius: var(--pptx-radius); background: var(--pptx-muted); color: var(--pptx-foreground); }
	.pptxv-mobile-comment-add { display: grid; gap: 6px; padding-top: 10px; }
	.pptxv-mobile-slide-list button { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 6px; border: 1px solid var(--pptx-border); border-radius: 8px; background: var(--pptx-muted); color: inherit; text-align: left; }
	.pptxv-mobile-slide-list button.is-active { border-color: var(--pptx-primary); color: var(--pptx-primary); }
	.pptxv-mobile-slide-num { min-width: 18px; color: var(--pptx-muted-foreground); font-size: 11px; text-align: right; }
	.pptxv-mobile-slide-list button.is-active .pptxv-mobile-slide-num { color: var(--pptx-primary); }
	/* The thumbnail is a scaled stage: it must clip and never stretch. */
	.pptxv-mobile-slide-frame { display: block; flex: none; overflow: hidden; border: 1px solid var(--pptx-border); border-radius: 4px; background: #fff; }
	.pptxv-mobile-slide-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.pptxv-mobile-sheet .pptxv-inspector { display: flex; width: 100%; max-height: 55dvh; border: 0; }
	.pptxv.pptxv-presenting .pptxv-mobile-toolbar,
	.pptxv.pptxv-presenting .pptxv-mobile-actions > nav,
	.pptxv.pptxv-presenting .pptxv-mobile-sheet-host { display: none; }
}
`;
