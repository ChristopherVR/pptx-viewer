export const MASTER_VIEW_CSS = `
.pptxv-master-sidebar {
	display: flex;
	flex: none;
	flex-direction: column;
	width: 224px;
	min-height: 0;
	border-right: 1px solid var(--pptx-border);
	background: color-mix(in srgb, var(--pptx-card) 92%, transparent);
}
.pptxv-master-sidebar[hidden] { display: none; }
.pptxv-master-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; }
.pptxv-master-title { color: var(--pptx-muted-foreground); font-size: 10px; letter-spacing: 0.07em; text-transform: uppercase; }
.pptxv-master-collapse { width: 24px; height: 24px; border: 0; border-radius: 4px; background: transparent; color: var(--pptx-muted-foreground); cursor: pointer; font-size: 20px; line-height: 1; }
.pptxv-master-collapse:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-master-collapse:focus-visible, .pptxv-master-tab:focus-visible, .pptxv-master-count:focus-visible, .pptxv-master-thumb:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: -2px; }
.pptxv-master-tabs { display: flex; padding: 0 4px; border-bottom: 1px solid var(--pptx-border); }
.pptxv-master-tab { flex: 1; padding: 6px 2px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--pptx-muted-foreground); cursor: pointer; font: inherit; font-size: 10px; }
.pptxv-master-tab.is-active { border-bottom-color: #f59e0b; color: #f59e0b; font-weight: 600; }
.pptxv-master-body { display: flex; flex: 1; flex-direction: column; gap: 8px; min-height: 0; overflow-y: auto; padding: 6px; }
/* "flex: none" is load-bearing here: the rail is a column flex container, so
   every thumb is a flex item and shrinks by default. With a dozen layouts that
   crushed each 72px preview frame down to 8px, which went unnoticed while the
   frames were empty. (No backticks in this file: it is one template literal.) */
.pptxv-master-thumb { display: flex; flex: none; flex-direction: column; gap: 4px; padding: 5px; border: 1px solid transparent; border-radius: 5px; background: transparent; color: var(--pptx-foreground); cursor: pointer; text-align: left; }
.pptxv-master-thumb.is-layout { margin-left: 14px; }
.pptxv-master-thumb:hover { background: var(--pptx-accent); }
.pptxv-master-thumb.is-active { border-color: var(--pptx-primary); background: color-mix(in srgb, var(--pptx-primary) 10%, transparent); }
.pptxv-master-thumb-name { overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.pptxv-master-thumb-frame { position: relative; display: block; overflow: hidden; border: 1px solid var(--pptx-border); border-radius: 3px; background: #fff; }
.pptxv-master-card { padding: 8px; border: 1px solid var(--pptx-border); border-radius: 6px; background: color-mix(in srgb, var(--pptx-muted) 55%, transparent); }
.pptxv-master-card-label { margin-bottom: 6px; color: var(--pptx-muted-foreground); font-size: 10px; }
.pptxv-master-background { width: 100%; height: 32px; border: 1px solid var(--pptx-border); border-radius: 4px; }
.pptxv-master-placeholder { display: flex; align-items: center; gap: 7px; margin-top: 4px; padding: 5px 6px; border-radius: 4px; background: color-mix(in srgb, var(--pptx-background) 65%, transparent); font-size: 10px; }
.pptxv-master-dot { width: 8px; height: 8px; flex: none; border-radius: 50%; background: rgb(34 197 94 / 0.65); }
.pptxv-master-dot.is-handout { background: rgb(168 85 247 / 0.65); }
.pptxv-master-empty { padding: 16px 8px; color: var(--pptx-muted-foreground); font-size: 11px; text-align: center; }
.pptxv-master-counts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.pptxv-master-count { padding: 6px; border: 0; border-radius: 4px; background: var(--pptx-accent); color: var(--pptx-muted-foreground); cursor: pointer; font: inherit; font-size: 11px; }
.pptxv-master-count.is-active { background: var(--pptx-primary); color: var(--pptx-primary-foreground); }
.pptxv-master-page { position: relative; overflow: hidden; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; box-shadow: 0 8px 24px rgb(0 0 0 / 0.18); }
.pptxv-master-canvas-empty { display: grid; width: 100%; height: 100%; place-items: center; color: var(--pptx-muted-foreground); }
.pptxv-notes-region { position: absolute; display: flex; overflow: hidden; align-items: center; justify-content: center; border: 1px dashed rgb(156 163 175 / 0.45); color: rgb(107 114 128 / 0.8); font-size: 10px; text-align: center; }
.pptxv-notes-region.is-sldImg { border-color: rgb(59 130 246 / 0.55); background: rgb(59 130 246 / 0.05); color: rgb(59 130 246 / 0.75); }
.pptxv-notes-region.is-body { border-color: rgb(34 197 94 / 0.55); background: rgb(34 197 94 / 0.05); color: rgb(34 197 94 / 0.75); }
.pptxv-handout-slot { position: absolute; display: flex; overflow: hidden; align-items: center; justify-content: center; border: 1px dashed rgb(96 165 250 / 0.55); background: rgb(239 246 255 / 0.35); color: rgb(96 165 250 / 0.7); font-size: 10px; font-weight: 500; }
.pptxv-handout-corner { position: absolute; padding: 1px 4px; border-color: rgb(209 213 219 / 0.5); border-style: dashed; color: rgb(107 114 128 / 0.55); font-size: 8px; }
.pptxv-handout-corner.is-top-left { top: 0; left: 0; border-right-width: 1px; border-bottom-width: 1px; }
.pptxv-handout-corner.is-top-right { top: 0; right: 0; border-bottom-width: 1px; border-left-width: 1px; }
.pptxv-handout-corner.is-bottom-left { bottom: 0; left: 0; border-top-width: 1px; border-right-width: 1px; }
.pptxv-handout-corner.is-bottom-right { right: 0; bottom: 0; border-top-width: 1px; border-left-width: 1px; }
@media (max-width: 767px), (max-width: 1023px) and (max-height: 520px) { .pptxv-master-sidebar { display: none; } }
.pptxv.pptxv-presenting .pptxv-master-sidebar { display: none; }
`;
