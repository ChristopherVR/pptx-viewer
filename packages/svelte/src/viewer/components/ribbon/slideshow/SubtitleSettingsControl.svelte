<script lang="ts">
	import { subtitleSettingsFromOptions, subtitleSettingsLabels, updateSubtitleSettings } from 'pptx-viewer-shared';
	import type { SubtitleSettingsChangeEvent } from 'pptx-viewer-shared';
	import { useTranslator } from '../../../../i18n/context';
	import { useViewerOptions } from '../../../state/viewer-options-context';

	const t = useTranslator();
	const options = useViewerOptions();
	function commit(event: Event): void {
		updateSubtitleSettings(options, (event as SubtitleSettingsChangeEvent).detail);
	}
</script>

<pptx-ui-subtitle-settings data-ribbon-control="slideShow.captions.subtitleSettings"
	settings={subtitleSettingsFromOptions(options.options)} labels={subtitleSettingsLabels(t)}
	languageDisabled={options.isLocked('accessibility', 'subtitleLanguage')}
	onsubtitle-settings-change={commit}
></pptx-ui-subtitle-settings>
