// See react.ts for why the picker/new-presentation pattern is what it is.
// The Svelte binding compiles its styles into the components and bundles an
// English dictionary, so no stylesheet import or i18n wiring is needed here.
// Layout classes (.stage, .dropzone, etc.) come from MINIMAL_APP_CSS written
// to src/app.css by the scaffold recipe.
export const SVELTE_APP_SVELTE = `<script lang="ts">
	import { PptxHandler } from 'pptx-viewer-core';
	import type { CollaborationConfig } from 'pptx-svelte-viewer';
	import { PowerPointViewer } from 'pptx-svelte-viewer';

	/**
	 * The presentation formats this viewer can open: OOXML and the legacy binary
	 * PowerPoint format, which pptx-viewer-core converts on load. Kept as an
	 * explicit check because a drop event carries no accept filtering.
	 */
	function isPresentation(file: File | undefined): file is File {
		const name = file?.name.toLowerCase() ?? '';
		return name.endsWith('.pptx') || name.endsWith('.ppt');
	}

	let content = $state<Uint8Array | null>(null);
	let over = $state(false);
	let collab = $state<CollaborationConfig | undefined>();

	async function loadFile(file: File) {
		content = new Uint8Array(await file.arrayBuffer());
	}

	function onDrop(e: DragEvent) {
		over = false;
		const file = e.dataTransfer?.files?.[0];
		if (isPresentation(file)) void loadFile(file);
	}

	function onPick(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) void loadFile(file);
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
	<div style="height: 100dvh">
		<PowerPointViewer
			source={content}
			editable
			collaboration={collab}
			onstartcollaboration={(cfg) => { collab = cfg; }}
			onstopcollaboration={() => { collab = undefined; }}
		/>
	</div>
{:else}
	<div
		class="stage"
		ondragover={(e) => { e.preventDefault(); over = true; }}
		ondragleave={() => { over = false; }}
		ondrop={(e) => { e.preventDefault(); onDrop(e); }}
		onclick={() => document.getElementById('file-input')?.click()}
		role="button"
		tabindex="0"
	>
		<div class="dropzone" class:over>
			<h1>Open a Presentation</h1>
			<p>Drag &amp; drop a .pptx or .ppt file here, or</p>
			<label class="pick-label" onclick={(e) => e.stopPropagation()}>
				Choose a file
				<input id="file-input" type="file" accept=".pptx,.ppt" style="display: none" onchange={onPick} />
			</label>
			<span class="or-sep">or</span>
			<button class="new-btn" onclick={(e) => { e.stopPropagation(); void newPresentation(); }}>
				New Presentation
			</button>
		</div>
	</div>
{/if}
`;
