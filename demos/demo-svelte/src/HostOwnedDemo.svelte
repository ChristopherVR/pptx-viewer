<script lang="ts">
	import { PowerPointViewer } from 'pptx-svelte-viewer';
	import { onMount } from 'svelte';

	import { createHostOwnedDemo } from '../../shared/host-owned-collaboration';
	import type { HostOwnedDemo } from '../../shared/host-owned-collaboration';

	let host = $state.raw<HostOwnedDemo | null>(null);
	let mounted = $state(true);
	let error = $state('');
	let viewer = $state<{ getContent: () => Promise<Uint8Array> }>();
	onMount(() => {
		let disposed = false;
		let current: HostOwnedDemo | undefined;
		void createHostOwnedDemo(import.meta.env.VITE_COLLAB_SERVER_URL?.trim()).then((session) => {
			if (disposed) { session.dispose(); return; }
			current = session;
			host = session;
			session.attachControls((value) => { mounted = value; }, async () => viewer?.getContent());
			return undefined;
		}).catch((reason: unknown) => { error = String(reason); });
		return () => { disposed = true; current?.dispose(); };
	});
</script>

<main style="position: fixed; inset: 64px 0 0">
	{#if error}<p role="alert">{error}</p>{/if}
	{#if host && mounted}
		<PowerPointViewer bind:this={viewer} source={host.source} fileName={host.fileName} collaboration={host.config} editable={host.editable} />
	{/if}
</main>
