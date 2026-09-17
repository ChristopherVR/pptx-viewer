<script lang="ts">
	import { PowerPointViewer } from 'pptx-svelte-viewer';
	import { onMount } from 'svelte';

	import { createHostOwnedDemo } from '../../shared/host-owned-collaboration';
	import type { HostOwnedDemo } from '../../shared/host-owned-collaboration';
	import type { HostOwnedShellHandle } from '../../shared/host-owned-shell-controls';
	import HostOwnedHeadlessEditor from './HostOwnedHeadlessEditor.svelte';

	const headless = new URLSearchParams(location.search).get('headless') === '1';
	let host = $state.raw<HostOwnedDemo | null>(null);
	let mounted = $state(true);
	let error = $state('');
	let viewer = $state<{ getContent: () => Promise<Uint8Array> }>();
	let customShell = $state<HostOwnedShellHandle>();
	onMount(() => {
		let disposed = false;
		let current: HostOwnedDemo | undefined;
		void createHostOwnedDemo(import.meta.env.VITE_COLLAB_SERVER_URL?.trim()).then((session) => {
			if (disposed) { session.dispose(); return; }
			current = session;
			host = session;
			session.attachControls(
				(value) => { mounted = value; },
				async () => (headless ? customShell?.getContent() : viewer?.getContent()),
				headless ? { setScale: (scale) => customShell?.setScale(scale) } : undefined,
			);
			return undefined;
		}).catch((reason: unknown) => { error = String(reason); });
		return () => { disposed = true; current?.dispose(); };
	});
</script>

<main style:position="fixed" style:inset={`${headless ? 104 : 64}px 0 0`}>
	{#if error}<p role="alert">{error}</p>{/if}
	{#if host && mounted}
		{#if headless}
			<HostOwnedHeadlessEditor bind:this={customShell} {host} />
		{:else}
			<PowerPointViewer bind:this={viewer} source={host.source} fileName={host.fileName} collaboration={host.config} editable={host.editable} />
		{/if}
	{/if}
</main>
