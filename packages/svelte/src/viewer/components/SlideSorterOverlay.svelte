<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import X from '@lucide/svelte/icons/x';
	import type { PptxSlide } from 'pptx-viewer-core'; import { HIDDEN_SLIDE_DIM_OPACITY, HIDDEN_SLIDE_LABEL_KEY, HIDDEN_SLIDE_SLASH_GRADIENT, hiddenSlideCue, isEditorTextInputTarget, mapSlideSorterKey, applySorterAction, createSlideSorterState, selectSorterSlide, sorterSelectionIndexes, sorterMenuContext, sorterGridColumns } from 'pptx-viewer-shared'; import type { CanvasSize, SlideSorterKeyActionName, SlideSorterContextMenuCommandId } from 'pptx-viewer-shared'; import { useTranslator } from '../../i18n/context'; import SlideSorterContextMenu from './SlideSorterContextMenu.svelte'; import SlideStage from './SlideStage.svelte';

	const { slides, canvasSize, mediaDataUrls, current, canEdit = false, onselect, onmove, ondelete, onduplicate, ontogglehidden, onclose }: { slides: PptxSlide[]; canvasSize: CanvasSize; mediaDataUrls: Map<string,string>; current: number; canEdit?: boolean; onselect: (index:number)=>void; onmove:(from:number,to:number)=>void; ondelete?:(index:number)=>void; onduplicate?:(index:number)=>void; ontogglehidden?:(index:number)=>void; onclose:()=>void } = $props(); const t=useTranslator(); let sorter = $state(createSlideSorterState(slides, current)); const scale=$derived(180 * sorter.zoom / 100 / canvasSize.width);

	/**
	 * Right-click context menu: the shared sorter command list (Copy, Paste,
	 * Duplicate, Hide/Show, Delete), rendered by `SlideSorterContextMenu.svelte`.
	 * It targets the right-clicked slide, not just `current`.
	 */
	let contextMenu = $state<{ x: number; y: number; index: number } | null>(null);

	function oncontextmenu(event: MouseEvent, index: number): void {
		if (!canEdit) {
			return;
		}
		event.preventDefault();
		sorter = selectSorterSlide(sorter, slides, index, {}, true);
		contextMenu = { x: event.clientX, y: event.clientY, index };
	}

	function closeContextMenu(): void {
		contextMenu = null;
	}

	function runAction(action: SlideSorterKeyActionName | 'toggle-hidden'): void {
		const result = applySorterAction(sorter, slides, action, current);
		sorter = result.state;
		if (result.close) {onclose();}
		for (const index of result.indexes) {
			if (result.operation === 'duplicate') {onduplicate?.(index);}
			if (result.operation === 'delete') {ondelete?.(index);}
			if (result.operation === 'toggle-hidden') {ontogglehidden?.(index);}
		}
	}
	function runMenuCommand(id: SlideSorterContextMenuCommandId): void {
		closeContextMenu(); runAction(id);
	}
	function onkeydown(event: KeyboardEvent): void {

		closeContextMenu();
		const { action } = mapSlideSorterKey(event, { canEdit,
			hasMultiSelection: sorterSelectionIndexes(sorter, slides).length > 1,
			isTextInputTarget: isEditorTextInputTarget(event.target) });
		if (!action) {return;}
		event.preventDefault(); event.stopPropagation(); runAction(action);
	}
</script>
<svelte:window {onkeydown} />
<div class="overlay"><header><h2>{t('pptx.view.slideSorter')}</h2><button aria-label={t('pptx.slideSorter.close')} onclick={onclose}><X size={16} aria-hidden="true" /></button></header><main style={`grid-template-columns: repeat(${sorterGridColumns(sorter.zoom)}, minmax(0, 1fr))`}>{#each slides as slide,index}{@const cue = hiddenSlideCue(slide.hidden, 'sorter', index)}<article data-pptx-chrome="sorter-tile" class:active={sorter.selectedIds.includes(slide.id)} data-pptx-selected={sorter.selectedIds.includes(slide.id)} data-pptx-slide-hidden={cue.marker} oncontextmenu={(event) => oncontextmenu(event, index)}><button class="preview" style={`width: ${180 * sorter.zoom / 100}px; height: ${canvasSize.height * scale}px; opacity: ${cue.hidden ? HIDDEN_SLIDE_DIM_OPACITY : 1}`} aria-label={t('pptx.compare.slideNumber', { number: index + 1 })} aria-describedby={cue.labelId} onclick={(event) => { sorter = selectSorterSlide(sorter, slides, index, event); }} ondblclick={() => { onselect(index); onclose(); }}><SlideStage {slide} {canvasSize} {mediaDataUrls} {scale} presenting={false} /></button><footer><span class="meta"><span class="num" style={cue.hidden ? `background-image: ${HIDDEN_SLIDE_SLASH_GRADIENT}` : undefined}>{index+1}</span>{#if cue.hidden}<span class="hidden-label" id={cue.labelId}>{t(HIDDEN_SLIDE_LABEL_KEY)}</span>{/if}</span><button aria-label={t('pptx.animations.moveEarlier')} disabled={index===0} onclick={() => onmove(index,index-1)}><ChevronLeft size={14} aria-hidden="true" /></button><button aria-label={t('pptx.animations.moveLater')} disabled={index===slides.length-1} onclick={() => onmove(index,index+1)}><ChevronRight size={14} aria-hidden="true" /></button></footer></article>{/each}</main><label>{t('pptx.slideSorter.zoom')} <input type="range" min="50" max="200" step="10" bind:value={sorter.zoom} aria-label={t('pptx.slideSorter.zoom')} />{sorter.zoom}%</label>{#if contextMenu}<SlideSorterContextMenu x={contextMenu.x} y={contextMenu.y} context={sorterMenuContext(sorter, slides)} onrun={runMenuCommand} onclose={closeContextMenu} />{/if}</div>
<style>.overlay{position:absolute;inset:0;z-index:70;overflow:auto;background:var(--pptx-background,#11111b)}header{position:sticky;z-index:2;top:0;display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid var(--pptx-border,#3f3f52);background:var(--pptx-card,#1e1e2e)}h2{margin:0;font-size:14px}header button{display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;color:inherit}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:18px;padding:24px}article{display:grid;justify-content:center;gap:6px;padding:9px;border:2px solid transparent;border-radius:8px;background:var(--pptx-card,#1e1e2e)}article.active{border-color:var(--pptx-primary,#c43b32)}.preview{width:180px;height:calc(180px * 9 / 16);overflow:hidden;border:0;padding:0;background:#fff;text-align:left}article footer{display:flex;align-items:center;gap:5px;font-size:11px}article footer .meta{display:flex;flex:1;align-items:center;gap:5px}article footer .num{display:inline-block;padding:0 3px}article footer .hidden-label{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:var(--pptx-muted-foreground,#94a3b8)}article footer button{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--pptx-border,#3f3f52);border-radius:4px;background:var(--pptx-muted,#2a2a3d);color:inherit}article footer button:disabled{opacity:.4}</style>
