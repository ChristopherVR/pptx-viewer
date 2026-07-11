// See react.ts for why the picker/new-presentation pattern is what it is.
// The Svelte binding compiles its styles into the components and bundles an
// English dictionary, so no stylesheet import or i18n wiring is needed here.
export const SVELTE_APP_SVELTE = `<script lang="ts">
	import { PptxHandler } from 'pptx-viewer-core';
	import { PowerPointViewer } from 'pptx-svelte-viewer';

	let content = $state<Uint8Array | null>(null);

	function onPick(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => (content = new Uint8Array(reader.result as ArrayBuffer));
		reader.readAsArrayBuffer(file);
	}

	async function newPresentation() {
		const { handler, data } = await PptxHandler.createBlank({
			title: 'Untitled Presentation',
			initialSlideCount: 1,
		});
		content = await handler.save(data.slides);
	}
</script>

{#if content}
	<div style="height: 100vh">
		<PowerPointViewer source={content} editable />
	</div>
{:else}
	<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; height: 100vh; font-family: system-ui, sans-serif">
		<h1 style="margin: 0; font-size: 24px; font-weight: 500; color: #e5e7eb">Open a Presentation</h1>
		<label style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px; border: 1px solid #4b5563; background: #1f2937; color: #f3f4f6; cursor: pointer; font-size: 14px">
			Choose .pptx file
			<input type="file" accept=".pptx" style="display: none" onchange={onPick} />
		</label>
		<span style="color: #6b7280; font-size: 13px">or</span>
		<button style="padding: 10px 20px; border-radius: 8px; border: none; background: #2563eb; color: #fff; cursor: pointer; font-size: 14px; font-weight: 500" onclick={() => void newPresentation()}>New Presentation</button>
	</div>
{/if}
`;
