export const THEME_EDITOR_STYLES = `
:host { display: block; position: fixed; z-index: 1090; box-sizing: border-box; width: 288px;
 color: var(--pptx-foreground, #e2e8f0); background: var(--pptx-card, #181c20);
 border-left: 1px solid var(--pptx-border, #33334d); box-shadow: -8px 0 24px #0002;
 font: 12px/1.4 var(--pptx-ui-font-family, system-ui, sans-serif); }
:host([inline]) { position: static; width: 100%; border: 0; box-shadow: none; }
:host([inline]) .close { display: none; }
* { box-sizing: border-box; }
.panel { display: flex; flex-direction: column; height: 100%; min-height: 0; }
header { display: flex; align-items: center; justify-content: space-between; padding: 10px; flex: none; }
h3 { margin: 0; font-size: 13px; font-weight: 600; }
.content { display: grid; gap: 10px; padding: 0 10px 10px; overflow-y: auto; min-height: 0; }
section { padding: 8px; border: 1px solid var(--pptx-border, #33334d); border-radius: 5px; }
h4, label > span { display: block; margin: 0 0 5px; color: var(--pptx-muted-foreground, #94a3b8); font-size: 10px; }
h4 { text-transform: uppercase; letter-spacing: .03em; font-weight: 500; }
input[type=text], pptx-ui-select { display: block; width: 100%; min-height: 28px; padding: 4px 6px;
 background: var(--pptx-background, #0e1114); border: 1px solid var(--pptx-border, #33334d);
 border-radius: 4px; color: inherit; font: inherit; }
button { color: inherit; font: inherit; background: var(--pptx-secondary, #20252b);
 border: 1px solid var(--pptx-border, #33334d); border-radius: 4px; padding: 5px 7px; cursor: pointer; }
button:hover { background: var(--pptx-accent, #33334d); }
button:disabled, input:disabled { opacity: .45; cursor: default; }
button:focus-visible, input:focus-visible, pptx-ui-select:focus-within { outline: 2px solid var(--pptx-ring, #ec6b3d); outline-offset: 2px; }
.close { border: 0; background: transparent; min-width: 28px; min-height: 28px; }
.presets, .colors { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.preset { text-align: left; font-size: 10px; min-height: 42px; }
.preset[aria-pressed=true] { border-color: var(--pptx-primary, #ec6b3d); }
.swatches { display: flex; height: 12px; overflow: hidden; border-radius: 2px; margin-bottom: 4px; }
.swatches span { flex: 1; }
.colors label { min-width: 0; }
.colors label > span { font-size: 9px; }
.color-row { display: flex; gap: 4px; }
input[type=color] { width: 28px; height: 28px; padding: 0; flex: none; border: 1px solid var(--pptx-border, #33334d); background: transparent; }
.color-row input[type=text] { min-width: 0; font: 10px monospace; }
.font-fields { display: grid; gap: 8px; }
.preview { padding: 8px; border-radius: 4px; display: grid; gap: 4px; margin-top: 8px; }
.actions { display: flex; gap: 6px; padding: 8px 10px; border-top: 1px solid var(--pptx-border, #33334d); flex: none; }
.apply { flex: 1; background: var(--pptx-primary, #ec6b3d); color: var(--pptx-primary-foreground, #fff); border-color: transparent; }
@media (pointer: coarse), (max-width: 767px) { button, input[type=text], pptx-ui-select, .close { min-height: 44px; } }
@media (forced-colors: active) { :host, section, button, input { border-color: CanvasText; }
 button:focus-visible, input:focus-visible { outline-color: Highlight; } }
`;
