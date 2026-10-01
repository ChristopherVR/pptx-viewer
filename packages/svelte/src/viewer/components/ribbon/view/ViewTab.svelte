<script lang="ts">
	/**
	 * ViewTab: thin adapter for the shared `pptx-ui-ribbon-view`. The shared
	 * element owns the groups, icons, labels and pressed/disabled state; this
	 * component supplies viewer preferences and routes typed intents to the
	 * native handlers (preferences, view switches, EyeDropper, template mode).
	 *
	 * Guides toggles guide visibility only; Snap to shape is its own flag.
	 * Zoom in/out, Slide Show and the notes toggle live in the status bar.
	 */
	import type { RibbonViewIntent, RibbonViewRequestEvent, ViewerPreferences } from 'pptx-viewer-shared';
	import { updateViewerPreference } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { pickEyedropperFill } from './view-eyedropper';

	const {
		onzoomfit,
		editTemplateMode = false,
		onsettemplateediting,
		onentermasterview,
		onselectionpane,
		onslidesorter,
		onoutlineview,
		onreadingview,
		onnormal,
		editor,
		preferences,
		onpreferenceschange,
		showGuides,
		onshowguideschange,
		snapToShape,
		onsnapToShapechange,
		onaddguide,
	}: {
		onzoomfit: () => void;
		editTemplateMode?: boolean;
		onsettemplateediting?: (enabled: boolean) => void;
		onentermasterview?: () => void;
		onselectionpane: () => void;
		onslidesorter: () => void;
		/** Opens Outline View: the deck as one editable indented text document. */
		onoutlineview?: () => void;
		/** Opens Reading View: the deck at full window size, no Fullscreen API. */
		onreadingview?: () => void;
		/** Returns the viewer to the normal editing view (React's "Normal"). */
		onnormal?: () => void;
		editor: EditorState;
		preferences: ViewerPreferences;
		onpreferenceschange: (preferences: ViewerPreferences) => void;
		showGuides: boolean;
		onshowguideschange: (show: boolean) => void;
		snapToShape: boolean;
		onsnapToShapechange: (enabled: boolean) => void;
		onaddguide: (axis: 'h' | 'v') => void;
	} = $props();

	const t = useTranslator();
	const state = $derived({
		editable: editor.editable,
		showRulers: preferences.showRulers,
		showGrid: preferences.showGrid,
		showGuides,
		snapToGrid: preferences.snapToGrid,
		snapToShape,
		templateEditing: editTemplateMode,
		translate: t,
	});

	function request(event: RibbonViewRequestEvent): void {
		const intent: RibbonViewIntent = event.detail;
		if (intent.kind === 'guide') {
			onaddguide(intent.axis);
		} else if (intent.kind === 'option') {
			switch (intent.value) {
				case 'showGuides': onshowguideschange(intent.enabled); break;
				case 'snapToShape': onsnapToShapechange(intent.enabled); break;
				case 'templateEditing': onsettemplateediting?.(intent.enabled); break;
				default: onpreferenceschange(updateViewerPreference(preferences, intent.value, intent.enabled));
			}
		} else {
			switch (intent.value) {
				case 'normal': onnormal?.(); break;
				case 'slideSorter': onslidesorter(); break;
				case 'outline': onoutlineview?.(); break;
				case 'readingView': onreadingview?.(); break;
				case 'slideMaster': onentermasterview?.(); break;
				case 'selectionPane': onselectionpane(); break;
				case 'eyedropper': void pickEyedropperFill(editor); break;
				case 'zoomToFit': onzoomfit(); break;
			}
		}
	}
</script>

<pptx-ui-ribbon-view {state} onview-request={request}></pptx-ui-ribbon-view>
