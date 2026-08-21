<script lang="ts">
	/**
	 * PositionSection: the universal X / Y / W / H / rotation numeric grid,
	 * shown for every selected element regardless of type. Extracted from the
	 * original monolithic InspectorPanel so the panel can grow element-type-aware
	 * sections without blowing the file-size budget.
	 */
	import type { PptxElement } from 'pptx-viewer-core';
	import { elementLockTogglePatch, isElementLocked } from 'pptx-viewer-shared';
	import Lock from '@lucide/svelte/icons/lock';
	import LockOpen from '@lucide/svelte/icons/lock-open';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';

	const { editor, el }: { editor: EditorState; el: PptxElement } = $props();
	const t = useTranslator();

	type GeomField = 'x' | 'y' | 'width' | 'height' | 'rotation';

	function commit(field: GeomField, value: string): void {
		const n = Number(value);
		if (!Number.isFinite(n)) {
			return;
		}
		const v = field === 'width' || field === 'height' ? Math.max(1, n) : n;
		editor.applyElementPatch(el.id, { [field]: v } as Partial<PptxElement>);
	}

	// Shared decides both what reads as "locked" and what the toggle writes, so
	// the button's state can never drift from what the canvas enforces.
	const isLocked = $derived(isElementLocked(el));

	function toggleLock(): void {
		editor.applyElementPatch(el.id, { locks: elementLockTogglePatch(!isLocked) } as Partial<PptxElement>);
	}
</script>

<div class="pptx-svelte-inspector-lock-row">
	<span>{t('pptx.inspector.element')}</span>
	<button
		type="button"
		class="pptx-svelte-inspector-lock-btn"
		onclick={toggleLock}
		title={isLocked ? t('pptx.inspector.unlock') : t('pptx.inspector.lock')}
		aria-pressed={isLocked}
	>
		{#if isLocked}
			<Lock size={14} color="var(--pptx-amber, #f59e0b)" aria-hidden="true" />
		{:else}
			<LockOpen size={14} aria-hidden="true" />
		{/if}
	</button>
</div>
<div class="pptx-svelte-inspector-grid">
	<label>
		<span>{t('pptx.inspector.x')}</span>
		<input type="number" value={Math.round(el.x)} onchange={(e) => commit('x', e.currentTarget.value)} />
	</label>
	<label>
		<span>{t('pptx.inspector.y')}</span>
		<input type="number" value={Math.round(el.y)} onchange={(e) => commit('y', e.currentTarget.value)} />
	</label>
	<label>
		<span>{t('pptx.inspector.w')}</span>
		<input
			type="number"
			min="1"
			value={Math.round(el.width)}
			onchange={(e) => commit('width', e.currentTarget.value)}
		/>
	</label>
	<label>
		<span>{t('pptx.inspector.h')}</span>
		<input
			type="number"
			min="1"
			value={Math.round(el.height)}
			onchange={(e) => commit('height', e.currentTarget.value)}
		/>
	</label>
	<label>
		<span>{t('pptx.inspector.rotation')}</span>
		<input
			type="number"
			value={Math.round(el.rotation ?? 0)}
			onchange={(e) => commit('rotation', e.currentTarget.value)}
		/>
	</label>
</div>

<style>
	.pptx-svelte-inspector-lock-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 6px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-inspector-lock-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 4px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.pptx-svelte-inspector-lock-btn:hover {
		background: var(--pptx-accent, #1e1e2e);
	}

	.pptx-svelte-inspector-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.pptx-svelte-inspector-grid label {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.pptx-svelte-inspector-grid span {
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-inspector-grid input {
		width: 100%;
		height: 26px;
		box-sizing: border-box;
		padding: 0 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
	}
</style>
