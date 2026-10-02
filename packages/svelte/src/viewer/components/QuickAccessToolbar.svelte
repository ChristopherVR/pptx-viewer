<script lang="ts">
	/**
	 * Quick Access Toolbar "below the Ribbon" row (File > Options > Quick Access
	 * Toolbar > position `'below'`): the shared `pptx-ui-title-bar` in its
	 * `belowRibbon` placement, which renders only the configured extras and hides
	 * itself when there are none. Save/Undo/Redo stay in the title bar.
	 */
	import type { TitleBarEventDetails } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import { useViewerCustomization } from '../state/viewer-customization.svelte';
	import { useViewerOptions } from '../state/viewer-options-context';
	import { titleBarViewState } from './title-bar-adapter';

	const { onexec }: { onexec: (commandId: string) => void } = $props();
	const t = useTranslator();
	const customization = useViewerCustomization();
	const optionsState = useViewerOptions();
	const state = $derived(
		titleBarViewState({
			editable: true,
			isDirty: false,
			autosaveEnabled: true,
			canUndo: false,
			canRedo: false,
			quickAccess: optionsState.options.quickAccess,
			quickAccessAllowed: customization.isPanelVisible('quickAccessToolbar'),
			screenTip: (label) => optionsState.screenTip(label),
			translate: t,
		}),
	);
</script>

<pptx-ui-title-bar
	placement="belowRibbon"
	{state}
	onquick-command={(event: Event) =>
		onexec((event as CustomEvent<TitleBarEventDetails['quick-command']>).detail.id)}
></pptx-ui-title-bar>
