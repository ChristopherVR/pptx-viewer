<script lang="ts">
	import { captionDisplayText, getSpeechRecognitionCtor, mergeCaptionResults, subtitleRecognitionLanguage, subtitleSettingsFromOptions } from 'pptx-viewer-shared';
	import type { SpeechSupportState } from 'pptx-viewer-shared';
	import { useTranslator } from '../../i18n/context';
	import { useViewerOptions } from '../state/viewer-options-context';

	const { enabled }: { enabled: boolean; locale?: string } = $props();
	const t = useTranslator();
	const options = useViewerOptions();
	let support = $state<SpeechSupportState>('unknown');
	let caption = $state('');
	$effect(() => {
		const language = subtitleRecognitionLanguage(subtitleSettingsFromOptions(options.options), navigator.language);
		caption = '';
		if (!enabled) { return; }
		const Ctor = getSpeechRecognitionCtor();
		if (!Ctor) { support = 'unsupported'; return; }
		support = 'supported';
		const recognition = new Ctor();
		let active = true;
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.lang = language;
		recognition.onresult = (event) => (caption = mergeCaptionResults(event.resultIndex, event.results));
		recognition.onend = () => { if (active) { try { recognition.start(); } catch {} } };
		try { recognition.start(); } catch { support = 'unsupported'; }
		return () => { active = false; recognition.stop(); };
	});
	const text = $derived(captionDisplayText(support, caption, t('pptx.subtitles.notSupported'), t('pptx.subtitles.listening')));
</script>

{#if enabled}<div class="bar" role="status" aria-live="polite">{text}</div>{/if}
<style>.bar{position:absolute;z-index:72;right:10%;bottom:28px;left:10%;padding:10px 18px;border-radius:8px;background:#000c;color:#fff;text-align:center;font-size:18px;line-height:1.4;pointer-events:none}</style>
