export const SUBTITLE_SETTINGS_STYLES = `
:host { display: inline-flex; }
dialog { box-sizing: border-box; width: min(440px, calc(100vw - 32px)); max-height: calc(100vh - 32px);
 margin: auto; padding: 24px; border: 1px solid var(--pptx-border, #374151); border-radius: 10px;
 background: var(--pptx-background, #181b20); color: var(--pptx-foreground, #f9fafb); font: 14px/1.5 system-ui; }
dialog::backdrop { background: #0008; }
h2 { margin: 0 0 12px; font-size: 18px; } p { margin: 0 0 20px; }
label { display: block; margin-bottom: 8px; }
pptx-ui-select { display: block; width: 100%; }
footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
footer button { padding: 8px 16px; min-height: 44px; border: 1px solid var(--pptx-border, #374151);
 border-radius: 6px; background: var(--pptx-secondary, #252830); color: inherit; font: inherit; cursor: pointer; }
footer button:last-child { background: var(--pptx-primary, #6366f1); color: var(--pptx-primary-foreground, #fff); }
footer button:focus-visible { outline: 2px solid var(--pptx-ring, #6366f1); outline-offset: 2px; }
@media (forced-colors: active) { dialog { background: Canvas; color: CanvasText; } footer button { color: ButtonText; } }
`;
