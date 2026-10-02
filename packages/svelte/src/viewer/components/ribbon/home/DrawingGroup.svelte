<script lang="ts">
	/**
	 * DrawingGroup: the Home tab's Drawing controls. The Shapes, Arrange, Shape
	 * Fill and Shape Outline triggers are the shared
	 * `pptx-ui-ribbon-home-drawing` strip; the Shapes gallery, the Arrange z-order
	 * menu and the two colour popovers stay native and hang from those triggers.
	 * The Quick Styles (Shape Styles) and Shape Effects galleries are shared
	 * descriptors (`FIXED_TAB_GALLERIES`) rendered by `RibbonGallery`.
	 */
	import { hasShapeProperties } from 'pptx-viewer-core';
	import { SHAPE_PRESET_DEFS, drawingHomeControls, homeSnapshotTranslator } from 'pptx-viewer-shared';
	import type { PptxUiRibbonHomeElement, RibbonHomeRequestEvent } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import type { ZOrderDirection } from '../../../editor';
	import { newPresetShapeElement } from '../../../editor';
	import ShapeFormatGroup from '../../ShapeFormatGroup.svelte';
	import { anchoredPopup } from '../anchored-popup';
	import { fixedGalleryPlacement } from '../galleries/fixed-placements';
	import RibbonGallery from '../galleries/RibbonGallery.svelte';
	import { glyphClassToTransform, isStrokeGlyph, shapeGlyphPath } from '../insert/shape-glyphs';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	/** React's gallery shows the first dozen presets; the rest live on Insert. */
	const TOP_SHAPES = SHAPE_PRESET_DEFS.slice(0, 12);

	const ARRANGE_ACTIONS: ReadonlyArray<{ key: string; direction: ZOrderDirection }> = [
		{ key: 'pptx.contextMenu.bringForward', direction: 'forward' },
		{ key: 'pptx.contextMenu.sendBackward', direction: 'backward' },
		{ key: 'pptx.contextMenu.bringToFront', direction: 'front' },
		{ key: 'pptx.contextMenu.sendToBack', direction: 'back' },
	];

	let openMenu = $state<'shapes' | 'arrange' | null>(null);
	let fillOpen = $state(false);
	let outlineOpen = $state(false);
	// eslint-disable-next-line prefer-const
	let root: HTMLElement | undefined = $state();
	// eslint-disable-next-line prefer-const
	let strip: PptxUiRibbonHomeElement | undefined = $state();
	let anchor: HTMLElement | undefined = $state();
	let fillAnchor: HTMLElement | undefined = $state();
	let outlineAnchor: HTMLElement | undefined = $state();

	const hasSelection = $derived(Boolean(editor.selectedElementId));
	const hasShape = $derived(
		editor.selectedElement !== undefined && hasShapeProperties(editor.selectedElement),
	);
	const QUICK_STYLES = fixedGalleryPlacement('home.drawing.quickStyles');
	const SHAPE_EFFECTS = fixedGalleryPlacement('home.drawing.shapeEffects');

	// Fill and Outline need a selected shape (not merely a selection), and obey
	// read-only mode like every other trigger.
	const view = $derived.by(() => {
		const controls = drawingHomeControls({
			editable: editor.editable,
			hasSelection,
			open: {
				shapes: openMenu === 'shapes',
				arrange: openMenu === 'arrange',
				fill: fillOpen,
				outline: outlineOpen,
			},
		});
		const noShape = !editor.editable || !hasShape;
		return {
			controls: {
				...controls,
				'home.drawing.shapeFill': { ...controls['home.drawing.shapeFill'], disabled: noShape },
				'home.drawing.shapeOutline': { ...controls['home.drawing.shapeOutline'], disabled: noShape },
			},
			translate: homeSnapshotTranslator(['drawing'], t),
		};
	});

	function closeAll(): void {
		openMenu = null;
		fillOpen = false;
		outlineOpen = false;
	}

	function onFocusOut(event: FocusEvent): void {
		if (!(event.relatedTarget instanceof Node) || !root?.contains(event.relatedTarget)) {
			closeAll();
		}
	}

	// The shared triggers keep focus in the slide, so close on an outside press too.
	$effect(() => {
		if (openMenu === null && !fillOpen && !outlineOpen) {
			return;
		}
		const close = (event: PointerEvent): void => {
			if (!(event.target instanceof Node) || !root?.contains(event.target)) {
				closeAll();
			}
		};
		document.addEventListener('pointerdown', close, true);
		return () => document.removeEventListener('pointerdown', close, true);
	});

	function request(event: RibbonHomeRequestEvent): void {
		const id = event.detail.id;
		const wasShapes = openMenu === 'shapes';
		const wasArrange = openMenu === 'arrange';
		const wasFill = fillOpen;
		const wasOutline = outlineOpen;
		closeAll();
		switch (id) {
			case 'home.drawing.shapes':
				anchor = strip?.anchor(id);
				openMenu = wasShapes ? null : 'shapes';
				break;
			case 'home.drawing.arrange':
				anchor = strip?.anchor(id);
				openMenu = wasArrange ? null : 'arrange';
				break;
			case 'home.drawing.shapeFill':
				fillAnchor = strip?.anchor(id);
				fillOpen = !wasFill;
				break;
			case 'home.drawing.shapeOutline':
				outlineAnchor = strip?.anchor(id);
				outlineOpen = !wasOutline;
		}
	}
</script>

<div class="pptx-svelte-drawgrp" bind:this={root} onfocusout={onFocusOut}>
	<pptx-ui-ribbon-home-drawing bind:this={strip} state={view} onhome-request={request}></pptx-ui-ribbon-home-drawing>
	<ShapeFormatGroup
		{editor}
		section="popovers"
		{fillAnchor}
		{outlineAnchor}
		bind:fillOpen
		bind:outlineOpen
	/>
	{#if openMenu === 'shapes'}
		<div class="pptx-svelte-drawgrp-grid" role="menu" use:anchoredPopup={{ anchor }}>
			{#each TOP_SHAPES as preset (preset.type)}
				<button
					type="button"
					role="menuitem"
					aria-label={t(preset.i18nKey)}
					title={t(preset.i18nKey)}
					onclick={() => {
						openMenu = null;
						editor.insertElement(newPresetShapeElement(preset.type));
					}}
				>
					<svg viewBox="0 0 16 16" aria-hidden="true" style={`transform:${glyphClassToTransform(preset.glyphClass)}`}>
						{#if isStrokeGlyph(preset.glyph)}
							<path d={shapeGlyphPath(preset.glyph)} fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
						{:else}
							<path d={shapeGlyphPath(preset.glyph)} fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" />
						{/if}
					</svg>
				</button>
			{/each}
		</div>
	{/if}
	{#if openMenu === 'arrange'}
		<div class="pptx-svelte-drawgrp-pop" role="menu" use:anchoredPopup={{ anchor }}>
			{#each ARRANGE_ACTIONS as action (action.key)}
				<button
					type="button"
					role="menuitem"
					onclick={() => {
						openMenu = null;
						editor.reorderSelected(action.direction);
					}}
				>{t(action.key)}</button>
			{/each}
		</div>
	{/if}

	<RibbonGallery placement={QUICK_STYLES} />
	<RibbonGallery placement={SHAPE_EFFECTS} />
</div>

<style>
	.pptx-svelte-drawgrp {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}

	.pptx-svelte-drawgrp button {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 26px;
		padding: 0 7px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 11.5px;
		white-space: nowrap;
	}

	.pptx-svelte-drawgrp button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-drawgrp button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-drawgrp svg {
		width: 14px;
		height: 14px;
	}

	.pptx-svelte-drawgrp-grid {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 50;
		margin-top: 4px;
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 3px;
		width: 220px;
		padding: 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 2px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
		box-shadow: 0 10px 15px -3px rgb(0 0 0 / 35%), 0 4px 6px -4px rgb(0 0 0 / 35%);
	}

	.pptx-svelte-drawgrp-grid button {
		width: 30px;
		height: 30px;
		padding: 0;
		justify-content: center;
	}

	.pptx-svelte-drawgrp-pop {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 50;
		margin-top: 4px;
		display: flex;
		min-width: 150px;
		flex-direction: column;
		padding: 4px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 2px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
		box-shadow: 0 10px 15px -3px rgb(0 0 0 / 35%), 0 4px 6px -4px rgb(0 0 0 / 35%);
	}

	.pptx-svelte-drawgrp-pop button {
		width: 100%;
		padding: 6px 10px;
		text-align: left;
	}
</style>
