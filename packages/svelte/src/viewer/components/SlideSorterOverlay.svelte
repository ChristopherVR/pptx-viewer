<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import X from '@lucide/svelte/icons/x';
	import type { PptxSlide } from 'pptx-viewer-core'; import { HIDDEN_SLIDE_DIM_OPACITY, HIDDEN_SLIDE_LABEL_KEY, HIDDEN_SLIDE_SLASH_GRADIENT, hiddenSlideCue, isEditorTextInputTarget, mapSlideSorterKey } from 'pptx-viewer-shared'; import type { CanvasSize } from 'pptx-viewer-shared'; import { useTranslator } from '../../i18n/context'; import SlideStage from './SlideStage.svelte';

	const { slides, canvasSize, mediaDataUrls, current, canEdit = false, onselect, onmove, ondelete, onduplicate, ontogglehidden, onclose }: { slides: PptxSlide[]; canvasSize: CanvasSize; mediaDataUrls: Map<string,string>; current: number; canEdit?: boolean; onselect: (index:number)=>void; onmove:(from:number,to:number)=>void; ondelete?:(index:number)=>void; onduplicate?:(index:number)=>void; ontogglehidden?:(index:number)=>void; onclose:()=>void } = $props(); const t=useTranslator(); const scale=$derived(180/canvasSize.width);

	/**
	 * Right-click context menu (duplicate / hide-show / delete a slide), the
	 * Svelte port of Vue's `SlideSorter.vue` `ContextMenu` wiring. Previously
	 * this overlay had no mouse path to any of the three: delete/duplicate
	 * only fired via keyboard and only ever targeted `current`, never an
	 * arbitrary right-clicked slide, and hide/show had no path here at all.
	 */
	let contextMenu = $state<{ x: number; y: number; index: number } | null>(null);

	function oncontextmenu(event: MouseEvent, index: number): void {
		if (!canEdit) {
			return;
		}
		event.preventDefault();
		contextMenu = { x: event.clientX, y: event.clientY, index };
	}

	function closeContextMenu(): void {
		contextMenu = null;
	}

	function menuDuplicate(): void {
		if (contextMenu) {
			onduplicate?.(contextMenu.index);
		}
		closeContextMenu();
	}

	function menuToggleHidden(): void {
		if (contextMenu) {
			ontogglehidden?.(contextMenu.index);
		}
		closeContextMenu();
	}

	function menuDelete(): void {
		if (contextMenu) {
			ondelete?.(contextMenu.index);
		}
		closeContextMenu();
	}

	// The sorter keymap is shared (`mapSlideSorterKey`), so this overlay answers
	// the same keys as the other four bindings' sorters. Svelte had no sorter
	// keyboard at all before: Escape did not even close it. Only the commands
	// this overlay can perform are dispatched; it has no slide clipboard, no
	// multi-selection and no thumbnail zoom, so those chords reach the host.
	function onkeydown(event: KeyboardEvent): void {
		if (contextMenu) {
			closeContextMenu();
		}
		const { action } = mapSlideSorterKey(event, { canEdit, isTextInputTarget: isEditorTextInputTarget(event.target) });
		if (action === 'close') { event.stopPropagation(); onclose(); return; }
		if (action === 'delete') { event.preventDefault(); ondelete?.(current); return; }
		if (action === 'duplicate') { event.preventDefault(); onduplicate?.(current); }
	}
</script>
<svelte:window {onkeydown} />
<div class="overlay"><header><h2>{t('pptx.view.slideSorter')}</h2><button aria-label={t('pptx.slideSorter.close')} onclick={onclose}><X size={16} aria-hidden="true" /></button></header><main>{#each slides as slide,index}{@const cue = hiddenSlideCue(slide.hidden, 'sorter', index)}<article class:active={current===index} data-pptx-slide-hidden={cue.marker} oncontextmenu={(event) => oncontextmenu(event, index)}><button class="preview" style={cue.hidden ? `opacity: ${HIDDEN_SLIDE_DIM_OPACITY}` : undefined} aria-label={t('pptx.compare.slideNumber', { number: index + 1 })} aria-describedby={cue.labelId} onclick={() => { onselect(index); onclose(); }}><SlideStage {slide} {canvasSize} {mediaDataUrls} {scale} presenting={false} /></button><footer><span class="meta"><span class="num" style={cue.hidden ? `background-image: ${HIDDEN_SLIDE_SLASH_GRADIENT}` : undefined}>{index+1}</span>{#if cue.hidden}<span class="hidden-label" id={cue.labelId}>{t(HIDDEN_SLIDE_LABEL_KEY)}</span>{/if}</span><button aria-label={t('pptx.animations.moveEarlier')} disabled={index===0} onclick={() => onmove(index,index-1)}><ChevronLeft size={14} aria-hidden="true" /></button><button aria-label={t('pptx.animations.moveLater')} disabled={index===slides.length-1} onclick={() => onmove(index,index+1)}><ChevronRight size={14} aria-hidden="true" /></button></footer></article>{/each}</main>{#if contextMenu}{@const hidden = slides[contextMenu.index]?.hidden ?? false}<button class="menu-backdrop" aria-label={t('pptx.overflow.closeMenu')} onclick={closeContextMenu} oncontextmenu={(event) => { event.preventDefault(); closeContextMenu(); }}></button><div class="context-menu" style={`left:${contextMenu.x}px;top:${contextMenu.y}px`} role="menu"><button role="menuitem" onclick={menuDuplicate}>{t('pptx.slideMenu.duplicate')}</button><button role="menuitem" onclick={menuToggleHidden}>{hidden ? t('pptx.slideMenu.show') : t('pptx.slideMenu.hide')}</button><div class="sep"></div><button role="menuitem" class="danger" onclick={menuDelete}>{t('pptx.slideMenu.delete')}</button></div>{/if}</div>
<style>.overlay{position:absolute;inset:0;z-index:70;overflow:auto;background:var(--pptx-background,#11111b)}header{position:sticky;z-index:2;top:0;display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid var(--pptx-border,#3f3f52);background:var(--pptx-card,#1e1e2e)}h2{margin:0;font-size:14px}header button{display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;color:inherit}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:18px;padding:24px}article{display:grid;justify-content:center;gap:6px;padding:9px;border:2px solid transparent;border-radius:8px;background:var(--pptx-card,#1e1e2e)}article.active{border-color:var(--pptx-primary,#c43b32)}.preview{width:180px;height:calc(180px * 9 / 16);overflow:hidden;border:0;padding:0;background:#fff;text-align:left}article footer{display:flex;align-items:center;gap:5px;font-size:11px}article footer .meta{display:flex;flex:1;align-items:center;gap:5px}article footer .num{display:inline-block;padding:0 3px}article footer .hidden-label{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:var(--pptx-muted-foreground,#94a3b8)}article footer button{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--pptx-border,#3f3f52);border-radius:4px;background:var(--pptx-muted,#2a2a3d);color:inherit}article footer button:disabled{opacity:.4}.menu-backdrop{position:fixed;inset:0;z-index:79;border:0;padding:0;background:transparent;cursor:default}.context-menu{position:fixed;z-index:80;min-width:160px;padding:4px;border:1px solid var(--pptx-border,#3f3f52);border-radius:6px;background:var(--pptx-card,#1e1e2e);box-shadow:0 8px 24px rgba(0,0,0,.4)}.context-menu button{display:block;width:100%;padding:6px 10px;border:0;border-radius:4px;background:transparent;color:inherit;text-align:left;font-size:12px;cursor:pointer}.context-menu button:hover{background:var(--pptx-muted,#2a2a3d)}.context-menu button.danger{color:#f87171}.context-menu .sep{margin:4px 2px;border-top:1px solid var(--pptx-border,#3f3f52)}</style>
