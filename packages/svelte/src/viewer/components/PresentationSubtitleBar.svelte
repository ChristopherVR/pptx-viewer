<script lang="ts">
	import { captionDisplayText, getSpeechRecognitionCtor, mergeCaptionResults } from 'pptx-viewer-shared';
	import type { SpeechRecognitionLite, SpeechSupportState } from 'pptx-viewer-shared';
	import { onMount } from 'svelte'; import { useTranslator } from '../../i18n/context';
	const { enabled, locale }: { enabled: boolean; locale: string } = $props(); const t = useTranslator();
	let support = $state<SpeechSupportState>('unknown'); let caption = $state(''); let recognition: SpeechRecognitionLite | null = null;
	onMount(() => { const Ctor = getSpeechRecognitionCtor(); if (!Ctor) { support = 'unsupported'; return; } support = 'supported'; recognition = new Ctor(); recognition.continuous = true; recognition.interimResults = true; recognition.lang = locale; recognition.onresult = (event) => (caption = mergeCaptionResults(event.resultIndex, event.results)); recognition.onend = () => { if (enabled) try { recognition?.start(); } catch {} }; return () => recognition?.stop(); });
	$effect(() => { if (!recognition) return; if (enabled) { try { recognition.start(); } catch {} } else { recognition.stop(); caption = ''; } });
	const text = $derived(captionDisplayText(support, caption, t('pptx.subtitles.notSupported'), t('pptx.subtitles.listening')));
</script>
{#if enabled}<div class="bar" role="status" aria-live="polite">{text}</div>{/if}
<style>.bar{position:absolute;z-index:72;right:10%;bottom:28px;left:10%;padding:10px 18px;border-radius:8px;background:#000c;color:#fff;text-align:center;font-size:18px;line-height:1.4;pointer-events:none}</style>
