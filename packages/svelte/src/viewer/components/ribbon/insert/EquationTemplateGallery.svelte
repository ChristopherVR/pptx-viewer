<script lang="ts">
	/**
	 * EquationTemplateGallery: the equation editor's starter-formula tiles.
	 * Split out of `EquationEditorDialog` to keep that file within the repo's
	 * file-size budget.
	 *
	 * The catalogue (`EQUATION_TEMPLATES`) is shared across every binding; each
	 * tile's MathML is compiled once here, on mount, because the set is static.
	 * Every rendered string goes through `sanitizeMathMl` (inside
	 * `latexToMathMl`) before the `{@html ...}` binding.
	 */
	import { EQUATION_TEMPLATES } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import { latexToMathMl } from './equation-latex-preview';

	const {
		activeLatex,
		onselect,
	}: {
		/** The editor's current LaTeX; the matching tile shows as active. */
		activeLatex: string;
		onselect: (latex: string) => void;
	} = $props();
	const t = useTranslator();

	const TEMPLATE_MATHML = EQUATION_TEMPLATES.map((tmpl) => latexToMathMl(tmpl.latex));
</script>

<div class="templates">
	<span class="label">{t('pptx.equation.templates')}</span>
	<div class="grid">
		{#each EQUATION_TEMPLATES as tmpl, idx (tmpl.latex)}
			<button
				type="button"
				class="template"
				class:active={activeLatex === tmpl.latex}
				title={t(tmpl.i18nKey)}
				onclick={() => onselect(tmpl.latex)}
			>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<span class="math tile">{@html TEMPLATE_MATHML[idx]}</span>
				<span class="template-label">{t(tmpl.i18nKey)}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.templates {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.label {
		font-size: 11px;
		font-weight: 500;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.math {
		font-family: 'Cambria Math', 'STIX Two Math', serif;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 6px;
	}

	.template {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 7px;
		border: 1px solid var(--pptx-border, #3f3f52);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
	}

	.template:hover {
		background: var(--pptx-accent, #33334d);
	}

	.template.active {
		border-color: var(--pptx-primary, #c43b32);
		background: color-mix(in srgb, var(--pptx-primary, #c43b32) 14%, transparent);
	}

	.tile {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 28px;
		overflow: hidden;
		font-size: 13px;
	}

	.template-label {
		width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: center;
		font-size: 9px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}
</style>
