<script lang="ts">
	/**
	 * Generic File > Options pane: the tab's headline plus its schema-driven
	 * sections of controls, with a `special` snippet slot for the bespoke
	 * blocks (theme picker, clear-cache) and a `children` snippet rendered
	 * after the sections (custom panes such as Quick Access).
	 */
	import type { Snippet } from 'svelte';
	import type {
		ViewerOptions,
		ViewerOptionsGroupId,
		ViewerOptionsSection,
		ViewerOptionsTabDefinition,
	} from 'pptx-viewer-shared';
	import { useTranslator } from '../../../i18n/context';
	import OptionsControlRow from './OptionsControlRow.svelte';

	const {
		tab,
		options,
		onchange,
		special,
		children,
	}: {
		tab: ViewerOptionsTabDefinition;
		options: ViewerOptions;
		onchange: (group: ViewerOptionsGroupId, key: string, value: boolean | number | string) => void;
		special?: Snippet<[ViewerOptionsSection]>;
		children?: Snippet;
	} = $props();
	const t = useTranslator();
</script>

<div class="pane">
	<p class="headline">{t(tab.descriptionKey)}</p>
	{#each tab.sections as section (section.id)}
		<section>
			<h3>{t(section.titleKey)}</h3>
			{#if section.descriptionKey}<p class="hint">{t(section.descriptionKey)}</p>{/if}
			{#each section.controls as control (`${control.group}.${control.key}`)}
				<OptionsControlRow {control} {options} {onchange} />
			{/each}
			{#if section.special}{@render special?.(section)}{/if}
		</section>
	{/each}
	{@render children?.()}
</div>

<style>
	.pane { display: flex; flex-direction: column; gap: 18px; }
	.headline { margin: 0; color: var(--pptx-foreground, #e2e8f0); font-size: 12.5px; font-weight: 600; }
	section h3 { margin: 0 0 4px; border-bottom: 1px solid color-mix(in srgb, var(--pptx-border, #3f3f52) 60%, transparent); padding-bottom: 4px; color: var(--pptx-muted-foreground, #94a3b8); font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
	.hint { margin: 0 0 8px; color: var(--pptx-muted-foreground, #94a3b8); font-size: 11px; }
</style>
