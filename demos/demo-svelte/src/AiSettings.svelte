<script lang="ts">
	/**
	 * Landing-screen AI settings card for the Svelte demo. Collects the
	 * OpenAI-compatible base URL, API key, and model id and persists each to
	 * `localStorage` on input. The values take effect the next time a deck is
	 * opened (see App.svelte's `buildViewerAiConfig()` call).
	 */
	import { readAiSettings, writeAiSetting } from './ai-config';

	const settings = readAiSettings();
</script>

<section class="demo-ai-card">
	<h2 class="demo-ai-title">AI assistant (optional)</h2>
	<p class="demo-ai-note">
		Enter an OpenAI-compatible endpoint to enable the in-viewer AI assistant. The key stays in this
		browser and is only used for demo requests. Open a deck after saving to apply.
	</p>
	<label class="demo-ai-field">
		<span>Base URL</span>
		<input
			type="text"
			value={settings.baseURL}
			autocomplete="off"
			spellcheck="false"
			oninput={(e) => writeAiSetting('baseURL', e.currentTarget.value)}
		/>
	</label>
	<label class="demo-ai-field">
		<span>API key</span>
		<input
			type="password"
			value={settings.apiKey}
			autocomplete="off"
			spellcheck="false"
			oninput={(e) => writeAiSetting('apiKey', e.currentTarget.value)}
		/>
	</label>
	<label class="demo-ai-field">
		<span>Model</span>
		<input
			type="text"
			value={settings.model}
			autocomplete="off"
			spellcheck="false"
			oninput={(e) => writeAiSetting('model', e.currentTarget.value)}
		/>
	</label>
</section>

<style>
	.demo-ai-card {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: min(420px, 90vw);
		margin-top: 20px;
		padding: 16px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 10px;
		background: var(--pptx-card, #1a1a2e);
		text-align: left;
	}

	.demo-ai-title {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--pptx-card-foreground, #e2e8f0);
	}

	.demo-ai-note {
		margin: 0;
		font-size: 12px;
		line-height: 1.5;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.demo-ai-field {
		display: flex;
		flex-direction: column;
		gap: 3px;
		font-size: 12px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.demo-ai-field input {
		padding: 6px 8px;
		border: 1px solid var(--pptx-input, #33334d);
		border-radius: 6px;
		background: var(--pptx-background, #11111b);
		color: var(--pptx-card-foreground, #e2e8f0);
		font: inherit;
		font-size: 13px;
	}

	.demo-ai-field input:focus {
		outline: none;
		border-color: var(--pptx-ring, #818cf8);
	}
</style>
