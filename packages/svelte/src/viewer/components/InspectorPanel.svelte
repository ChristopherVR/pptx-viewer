<script lang="ts">
	/**
	 * InspectorPanel: collapsible right-hand property panel for the selected
	 * element. Numeric X / Y / W / H / rotation inputs are two-way: the displayed
	 * values are `$derived` from the live {@link EditorState} (so drag/resize and
	 * selection updates flow in), and committing an input routes through
	 * `applyElementPatch` so every edit is history-integrated. Fill/stroke colour
	 * controls appear for shape-like elements. All reads use the shared inspector
	 * helpers; when nothing is selected the panel shows a hint.
	 */
	import type { PptxElement } from 'pptx-viewer-core';
	import { hasShapeProperties } from 'pptx-viewer-core';
	import { fillColorOf, strokeColorOf } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import type { EditorState } from '../editor/editor-state.svelte';
	import { setFillColorPatch, setStrokeColorPatch } from '../editor';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	// eslint-disable-next-line prefer-const
	let collapsed = $state(false);

	const el = $derived(editor.selectedElement);
	const isShape = $derived(!!el && hasShapeProperties(el));
	const fill = $derived(el && isShape ? fillColorOf(el) : '#ffffff');
	const stroke = $derived(el && isShape ? strokeColorOf(el) : '#000000');

	type GeomField = 'x' | 'y' | 'width' | 'height' | 'rotation';

	function commit(field: GeomField, value: string): void {
		const n = Number(value);
		if (!el || !Number.isFinite(n)) {
			return;
		}
		const v = field === 'width' || field === 'height' ? Math.max(1, n) : n;
		editor.applyElementPatch(el.id, { [field]: v } as Partial<PptxElement>);
	}
	function setFill(value: string): void {
		if (el) {
			editor.patchSelected(setFillColorPatch(el, value));
		}
	}
	function setStroke(value: string): void {
		if (el) {
			editor.patchSelected(setStrokeColorPatch(el, value));
		}
	}
</script>

<aside class="pptx-svelte-inspector" class:pptx-svelte-inspector-collapsed={collapsed}>
	<button
		type="button"
		class="pptx-svelte-inspector-header"
		aria-expanded={!collapsed}
		onclick={() => (collapsed = !collapsed)}
	>
		<span>{t('pptx.inspector.properties')}</span>
		<svg
			viewBox="0 0 16 16"
			aria-hidden="true"
			class:pptx-svelte-inspector-chev-collapsed={collapsed}
		>
			<path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	</button>

	{#if !collapsed}
		<div class="pptx-svelte-inspector-body">
			{#if el}
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
						<input type="number" min="1" value={Math.round(el.width)} onchange={(e) => commit('width', e.currentTarget.value)} />
					</label>
					<label>
						<span>{t('pptx.inspector.h')}</span>
						<input type="number" min="1" value={Math.round(el.height)} onchange={(e) => commit('height', e.currentTarget.value)} />
					</label>
					<label>
						<span>{t('pptx.inspector.rotation')}</span>
						<input type="number" value={Math.round(el.rotation ?? 0)} onchange={(e) => commit('rotation', e.currentTarget.value)} />
					</label>
				</div>

				{#if isShape}
					<div class="pptx-svelte-inspector-section">
						<label class="pptx-svelte-inspector-color">
							<span>{t('pptx.inspector.fill')}</span>
							<input type="color" value={/^#/.test(fill) ? fill : '#ffffff'} onchange={(e) => setFill(e.currentTarget.value)} />
						</label>
						<label class="pptx-svelte-inspector-color">
							<span>{t('pptx.inspector.stroke')}</span>
							<input type="color" value={/^#/.test(stroke) ? stroke : '#000000'} onchange={(e) => setStroke(e.currentTarget.value)} />
						</label>
					</div>
				{/if}
			{:else}
				<p class="pptx-svelte-inspector-empty">{t('pptx.inspector.noSlideSelected')}</p>
			{/if}
		</div>
	{/if}
</aside>

<style>
	.pptx-svelte-inspector {
		display: flex;
		flex-direction: column;
		width: 200px;
		flex: none;
		border-left: 1px solid var(--pptx-border, #33334d);
		background: var(--pptx-card, #1e1e2e);
		color: var(--pptx-card-foreground, #e2e8f0);
		font-family: system-ui, sans-serif;
		font-size: 12px;
		overflow-y: auto;
	}

	.pptx-svelte-inspector-collapsed {
		width: auto;
	}

	.pptx-svelte-inspector-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 8px 12px;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-weight: 600;
	}

	.pptx-svelte-inspector-header svg {
		width: 14px;
		height: 14px;
		transition: transform 0.15s ease;
	}

	.pptx-svelte-inspector-chev-collapsed {
		transform: rotate(-90deg);
	}

	.pptx-svelte-inspector-body {
		padding: 0 12px 12px;
	}

	.pptx-svelte-inspector-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.pptx-svelte-inspector-grid label,
	.pptx-svelte-inspector-color {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.pptx-svelte-inspector-grid span,
	.pptx-svelte-inspector-color span {
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

	.pptx-svelte-inspector-section {
		display: flex;
		gap: 12px;
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--pptx-border, #33334d);
	}

	.pptx-svelte-inspector-color input[type='color'] {
		width: 40px;
		height: 26px;
		padding: 0;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
	}

	.pptx-svelte-inspector-empty {
		margin: 8px 0 0;
		color: var(--pptx-muted-foreground, #94a3b8);
	}
</style>
