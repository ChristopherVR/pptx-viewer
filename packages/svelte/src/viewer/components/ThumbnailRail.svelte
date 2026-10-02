<script lang="ts">
	/**
	 * ThumbnailRail: vertical slide-thumbnail sidebar. Each thumbnail renders
	 * the real `SlideStage` at miniature scale, so thumbnails always match the
	 * main canvas.
	 */
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import {
		computeVirtualRange,
		groupSlidesBySection,
		HIDDEN_SLIDE_DIM_OPACITY,
		HIDDEN_SLIDE_LABEL_KEY,
		HIDDEN_SLIDE_SLASH_GRADIENT,
		hiddenSlideCue,
		sectionAddAfterSlideIndex,
		SLIDE_VIRTUALIZATION_THRESHOLD,
		EDITOR_SLIDE_RAIL_WIDTH,
		EDITOR_THUMBNAIL_WIDTH,
		editorThumbnailHeight,
		editorThumbnailStep,
	} from 'pptx-viewer-shared';
	import type { SectionContextMenuCommandId } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import SectionContextMenu from './SectionContextMenu.svelte';
	import SlideStage from './SlideStage.svelte';
	import ThumbnailContextMenu from './ThumbnailContextMenu.svelte';
	import { ThumbnailRailMenu } from './thumbnail-rail-menu.svelte';
	import type { ThumbnailRailProps } from './props';
	import './thumbnail-rail.css';

	const {
		slides, canvasSize, mediaDataUrls, current, onselect, editable = false, onmove, onaddslide,
		sections = [], onsectiontoggle, onsectionrename, onsectiondelete, onsectionmove,
		onaddslideafter, onduplicateslides, ondeleteslides, ontogglehideslides, onopenlayoutforslide, onaddsectionat,
	}: ThumbnailRailProps = $props();

	const t = useTranslator();
	const railMenu = new ThumbnailRailMenu();
	const orderedIds = $derived(slides.map((s) => s.id));

	function onThumbClick(event: MouseEvent, index: number): void {
		const slide = slides[index];
		if (slide) {
			railMenu.onClick(event, slide.id, orderedIds);
		}
		onselect(index);
	}

	function onThumbContextMenu(event: MouseEvent, index: number): void {
		if (!editable) {
			return;
		}
		event.preventDefault();
		railMenu.openContextMenu(event.clientX, event.clientY, index, orderedIds);
	}

	/** PowerPoint's Enter on a focused thumbnail inserts a new slide after it. */
	function onRailKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter' && editable) {
			event.preventDefault();
			onaddslideafter?.(current);
		}
	}

	const THUMB_WIDTH = EDITOR_THUMBNAIL_WIDTH;
	const thumbScale = $derived(canvasSize.width > 0 ? THUMB_WIDTH / canvasSize.width : 0.1);
	const thumbHeight = $derived(editorThumbnailHeight(canvasSize.width, canvasSize.height));
	const itemHeight = $derived(editorThumbnailStep(canvasSize.width, canvasSize.height));
	const sectionGroups = $derived(groupSlidesBySection(sections, slides));
	const hasSections = $derived(sections.length > 0);
	const shouldVirtualize = $derived(!hasSections && slides.length >= SLIDE_VIRTUALIZATION_THRESHOLD);
	let draggedIndex = $state<number | null>(null);
	// eslint-disable-next-line prefer-const
	let railEl = $state<HTMLElement>();
	let scrollTop = $state(0);
	let viewportHeight = $state(600);
	const virtualRange = $derived(
		computeVirtualRange(slides.length, itemHeight, scrollTop, viewportHeight),
	);
	const renderedSlides = $derived.by(() => {
		const start = shouldVirtualize ? virtualRange.startIndex : 0;
		const end = shouldVirtualize ? virtualRange.endIndex : slides.length - 1;
		return slides.slice(start, end + 1).map((slide, offset) => ({ slide, index: start + offset }));
	});

	function onScroll(): void {
		if (!railEl) {return;}
		scrollTop = railEl.scrollTop;
		viewportHeight = railEl.clientHeight || 600;
	}

	$effect(() => {
		if (!shouldVirtualize || !railEl) {return;}
		const top = current * itemHeight;
		const bottom = top + itemHeight;
		if (top < railEl.scrollTop) {railEl.scrollTop = top;}
		else if (bottom > railEl.scrollTop + viewportHeight) {
			railEl.scrollTop = Math.max(0, bottom - viewportHeight);
		}
		onScroll();
	});

	function onDragStart(index: number, event: DragEvent): void {
		draggedIndex = index;
		event.dataTransfer?.setData('text/plain', String(index));
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
		}
	}

	function onDrop(index: number, event: DragEvent): void {
		event.preventDefault();
		if (draggedIndex !== null) {onmove?.(draggedIndex, index);}
		draggedIndex = null;
	}

	// Section header: right-click menu (shared command list) and inline rename.
	let sectionMenu = $state<{ x: number; y: number; sectionId: string } | null>(null);
	let renamingId = $state<string | null>(null);
	let renameValue = $state('');
	let renameInput = $state<HTMLInputElement>();

	function onSectionContextMenu(event: MouseEvent, sectionId: string): void {
		if (!editable) {return;}
		event.preventDefault();
		sectionMenu = { x: event.clientX, y: event.clientY, sectionId };
	}

	function startRename(sectionId: string, currentName: string): void {
		if (!editable) {return;}
		renamingId = sectionId;
		renameValue = currentName;
		queueMicrotask(() => { renameInput?.focus(); renameInput?.select(); });
	}

	function commitRename(): void {
		const id = renamingId;
		if (id === null) {return;}
		const name = renameValue.trim();
		renamingId = null;
		if (name.length > 0) {onsectionrename?.(id, name);}
	}

	function onRenameKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			commitRename();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			renamingId = null;
		}
		event.stopPropagation();
	}

	function runSectionCommand(id: SectionContextMenuCommandId): void {
		const menu = sectionMenu;
		sectionMenu = null;
		const index = sectionGroups.findIndex((group) => group.section?.id === menu?.sectionId);
		const group = sectionGroups[index];
		if (!menu || !group?.section) {return;}
		switch (id) {
			case 'rename': startRename(menu.sectionId, group.section.name); break;
			case 'delete': onsectiondelete?.(menu.sectionId); break;
			case 'move-up': onsectionmove?.(menu.sectionId, 'up'); break;
			case 'move-down': onsectionmove?.(menu.sectionId, 'down'); break;
			case 'add-after':
				onaddsectionat?.(sectionAddAfterSlideIndex(group.slideIndexes[group.slideIndexes.length - 1], slides.length));
				break;
			default: break;
		}
	}
</script>

{#snippet thumbnail(slide: (typeof slides)[number], index: number)}
	<!--
		A slide the author hid is still LISTED here, because hiding only removes it
		from the show. Without a cue the rail gave a user no way to tell that a
		slide will be skipped, so it gets all three shared signals: the dim, the
		diagonal slash across its number (a shape, since colour alone is not an
		accessible signal), and a "Hidden" description that assistive tech
		announces after the unchanged "Go to slide {{n}}" name.
	-->
	{@const cue = hiddenSlideCue(slide.hidden, 'rail', index)}
	<button
		type="button"
		class="pptx-svelte-thumb" data-pptx-chrome="slide-row"
		class:pptx-svelte-thumb-active={index === current}
		class:pptx-svelte-thumb-selected={railMenu.isSelected(slide.id) && index !== current}
		aria-label={t('pptx.slidesPanel.goToSlide', { n: index + 1 })}
		aria-current={index === current ? 'true' : undefined}
		aria-describedby={cue.labelId}
		data-pptx-slide-hidden={cue.marker}
		draggable={editable}
		class:pptx-svelte-thumb-dragging={draggedIndex === index}
		class:pptx-svelte-thumb-drop-target={draggedIndex !== null && draggedIndex !== index}
		onclick={(event) => onThumbClick(event, index)}
		oncontextmenu={(event) => onThumbContextMenu(event, index)}
		ondragstart={(event) => onDragStart(index, event)}
		ondragend={() => { draggedIndex = null; }}
		ondragover={editable ? (event) => event.preventDefault() : undefined}
		ondrop={editable ? (event) => onDrop(index, event) : undefined}
	>
		<span
			class="pptx-svelte-thumb-number" data-pptx-chrome="slide-number"
			style={cue.hidden ? `background-image: ${HIDDEN_SLIDE_SLASH_GRADIENT}` : undefined}
			>{index + 1}</span
		>
		<span class="pptx-svelte-thumb-frame" data-pptx-chrome="slide-frame" style={`width: ${THUMB_WIDTH}px; height: ${thumbHeight}px`}>
			<span class="pptx-svelte-thumb-stage" style={cue.hidden ? `opacity: ${HIDDEN_SLIDE_DIM_OPACITY}` : undefined}>
				<SlideStage {slide} {canvasSize} {mediaDataUrls} scale={thumbScale} />
			</span>
			{#if cue.hidden}
				<span class="pptx-svelte-thumb-hidden" id={cue.labelId}>
					<EyeOff size={12} aria-hidden="true" />
					<span class="pptx-svelte-sr-only">{t(HIDDEN_SLIDE_LABEL_KEY)}</span>
				</span>
			{/if}
		</span>
	</button>
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -- Enter here only catches the keydown bubbled up from a focused (interactive) thumbnail button -->
<nav data-pptx-chrome="slides" style={`width:${EDITOR_SLIDE_RAIL_WIDTH}px`} class="pptx-svelte-thumbs" aria-label={t('pptx.sections.slides')} onkeydown={onRailKeydown}>
	<div bind:this={railEl} bind:clientHeight={viewportHeight} class="pptx-svelte-thumbs-scroll" data-pptx-chrome="slide-list" onscroll={onScroll}>
	{#if hasSections}
		{#each sectionGroups as group, groupIndex (group.section?.id ?? 'ungrouped')}
			<section class="pptx-svelte-section" data-section-id={group.section?.id}>
				<header class="pptx-svelte-section-header" data-pptx-chrome="section-header" oncontextmenu={(event) => group.section && onSectionContextMenu(event, group.section.id)}>
					<button type="button" class="pptx-svelte-section-toggle" onclick={() => group.section && onsectiontoggle?.(group.section.id)} ondblclick={() => group.section && startRename(group.section.id, group.section.name)} aria-expanded={!group.section?.collapsed}>
						<span class="pptx-svelte-section-caret" class:is-collapsed={group.section?.collapsed}><ChevronDown size={12} aria-hidden="true" /></span>
						<!-- `p15:sectionPr/@clr`: parsed and round-tripped by core, but
						     shown by React alone until this. -->
						{#if group.section?.color}<span class="pptx-svelte-section-color" data-pptx-section-color={group.section.color} style={`background:${group.section.color}`}></span>{/if}
						{#if group.section && renamingId === group.section.id}
							<input bind:this={renameInput} class="pptx-svelte-section-rename" type="text" bind:value={renameValue} onkeydown={onRenameKeydown} onclick={(event) => event.stopPropagation()} onblur={commitRename} />
						{:else}
							<strong>{group.section?.name ?? t('pptx.slides.ungroupedSlides')}</strong>
							<small>{group.slides.length}</small>
						{/if}
					</button>
				</header>
				{#if !group.section?.collapsed}
					<div class="pptx-svelte-section-slides">
						{#each group.slides as slide, offset (slide.id)}
							{@render thumbnail(slide, group.slideIndexes[offset])}
						{/each}
					</div>
				{/if}
			</section>
		{/each}
	{:else}
	<div class="pptx-svelte-thumbs-space" data-virtualized={shouldVirtualize ? 'true' : undefined} style={shouldVirtualize ? `height:${virtualRange.totalHeight}px` : undefined}>
	<div class="pptx-svelte-thumbs-window" data-pptx-chrome="slide-window" style={shouldVirtualize ? `position:absolute;inset-inline:0;top:${virtualRange.offsetY}px` : undefined}>
	{#each renderedSlides as { slide, index } (slide.id)}
		{@render thumbnail(slide, index)}
	{/each}
	</div>
	</div>
	{/if}
	</div>
	{#if editable && onaddslide}
		<!-- React SlidesPaneSidebar parity: "+ Add Slide" pinned below the list. -->
		<div class="pptx-svelte-thumbs-add" data-pptx-chrome="slide-footer">
			<button type="button" onclick={onaddslide}>
				<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
				{t('pptx.sections.addSlide')}
			</button>
		</div>
	{/if}
</nav>

{#if sectionMenu}
	<SectionContextMenu x={sectionMenu.x} y={sectionMenu.y} sectionIndex={sectionGroups.filter((group) => group.section).findIndex((group) => group.section?.id === sectionMenu?.sectionId)} totalSections={sectionGroups.filter((group) => group.section).length} onrun={runSectionCommand} onclose={() => (sectionMenu = null)} />
{/if}

{#if railMenu.contextMenu}
	<ThumbnailContextMenu
		menu={railMenu}
		{slides}
		actions={{
			addSlideAfter: onaddslideafter,
			duplicateSlides: onduplicateslides,
			deleteSlides: ondeleteslides,
			openLayoutForSlide: onopenlayoutforslide,
			toggleHideSlides: ontogglehideslides,
			addSectionAt: onaddsectionat,
		}}
	/>
{/if}
