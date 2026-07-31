<script lang="ts">
	/**
	 * ViewShowGroup: the View tab's "Show" group (rulers / grid / guides / snap
	 * toggles beside the selection-pane, eyedropper and guide commands), split
	 * out of `ViewTab.svelte` to keep both files inside the 300-LOC budget.
	 *
	 * "Guides" and "Snap to shape" are one control each, for the one thing each
	 * of them names. They used to be crossed: Guides drove shape snapping and
	 * Snap to shape was a permanently disabled placeholder, which is a label
	 * describing a feature that lives on a differently-named control. Guide
	 * visibility and shape snapping are genuinely separate settings (you can
	 * want the guides drawn without every drag magnetising to a neighbour), and
	 * every binding already carries both flags.
	 */
	import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
	import type { ViewerPreferences } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import RibbonCommand from '../RibbonCommand.svelte';
	import RibbonCommandStack from '../RibbonCommandStack.svelte';
	import RibbonToggle from '../RibbonToggle.svelte';

	const {
		editor,
		preferences,
		ontogglepreference,
		showGuides,
		snapToShape,
		onguideschange,
		onsnaptoshapechange,
		onaddguide,
		onselectionpane,
	}: {
		editor: EditorState;
		preferences: ViewerPreferences;
		ontogglepreference: (key: 'showGrid' | 'showRulers' | 'snapToGrid') => void;
		showGuides: boolean;
		snapToShape: boolean;
		/** Shows or hides the guide overlay; snapping is its own control. */
		onguideschange: (show: boolean) => void;
		onsnaptoshapechange: (enabled: boolean) => void;
		onaddguide: (axis: 'h' | 'v') => void;
		onselectionpane: () => void;
	} = $props();
	const t = useTranslator();

	/**
	 * Recolour the selection from a screen pixel via the browser's EyeDropper.
	 *
	 * Enabled purely on editability (React's rule) rather than on there being a
	 * selection: the picker is worth opening to read a colour before the user
	 * has committed to a target, and the patch below is a no-op without one.
	 */
	async function eyedropper(): Promise<void> {
		const Picker = (
			window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }
		).EyeDropper;
		if (!Picker) {
			return;
		}
		const { sRGBHex } = await new Picker().open();
		const el = editor.selectedElement;
		if (!el || !('shapeStyle' in el)) {
			return;
		}
		editor.patchSelected({
			shapeStyle: { ...el.shapeStyle, fillMode: 'solid', fillColor: sRGBHex } as ShapeStyle,
		} as Partial<PptxElement>);
	}
</script>

<RibbonCommandStack>
	<RibbonToggle
		label={t('pptx.ruler.rulers')}
		checked={preferences.showRulers}
		onchange={() => ontogglepreference('showRulers')}
	/>
	<RibbonToggle
		label={t('pptx.grid.grid')}
		checked={preferences.showGrid}
		onchange={() => ontogglepreference('showGrid')}
	/>
	<RibbonToggle
		label={t('pptx.view.guides')}
		checked={showGuides}
		onchange={(next) => onguideschange(next)}
	/>
	<RibbonToggle
		label="Snap to grid"
		checked={preferences.snapToGrid}
		onchange={() => ontogglepreference('snapToGrid')}
	/>
</RibbonCommandStack>

<RibbonCommandStack>
	<RibbonCommand
		compact
		label={t('pptx.view.selection')}
		title={t('pptx.ribbon.toggleSelectionPane')}
		onclick={onselectionpane}
	>
		{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M4 5h12M4 10h12M4 15h8" /></svg>{/snippet}
	</RibbonCommand>
	<RibbonCommand
		compact
		label={t('pptx.ribbon.eyedropper')}
		title={t('pptx.ribbon.eyedropperTitle')}
		disabled={!editor.editable}
		onclick={() => void eyedropper()}
	>
		{#snippet icon()}<svg viewBox="0 0 20 20"><path d="m13 3 4 4-1.5 1.5-4-4zM11 6 4 13v3h3l7-7z" /></svg>{/snippet}
	</RibbonCommand>
	<RibbonCommand
		compact
		label={t('pptx.view.snapToShape')}
		title={t('pptx.view.snapToShape')}
		active={snapToShape}
		onclick={() => onsnaptoshapechange(!snapToShape)}
	>
		{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M3 7h14M3 13h14M7 3v14M13 3v14" /></svg>{/snippet}
	</RibbonCommand>
	<RibbonCommand compact label="H Guide" onclick={() => onaddguide('h')}>
		{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M2 10h16" /></svg>{/snippet}
	</RibbonCommand>
	<RibbonCommand compact label="V Guide" onclick={() => onaddguide('v')}>
		{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M10 2v16" /></svg>{/snippet}
	</RibbonCommand>
</RibbonCommandStack>
