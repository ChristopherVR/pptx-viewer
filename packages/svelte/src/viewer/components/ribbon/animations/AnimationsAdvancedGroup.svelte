<script lang="ts">
	/**
	 * AnimationsAdvancedGroup: the Animations tab's "Advanced Animation" and
	 * "Timing" groups, split out of `AnimationsTab.svelte` so neither file
	 * outgrows the 300-LOC budget.
	 *
	 * Exit Effects is a shortcut onto the same
	 * `EditorState.animationOps.addAnimation` the gallery uses, so it adds a
	 * real effect rather than opening a dialog nobody built; Effect Options and
	 * Trigger open the inspector's Animation panel, which is where per-effect
	 * timing and trigger editing already lives.
	 *
	 * Path Animation applies the DEFAULT motion path (Lines: Right) instead. It
	 * used to add a Fly In entrance, which is not a path at all: the button
	 * promised geometry and delivered a preset, so nothing was ever drawn on the
	 * canvas to drag.
	 *
	 * Animation Painter, and the Start/Duration timing fields, are disabled
	 * placeholders in React as well: copying an animation between elements and
	 * editing timing from the ribbon (rather than from the inspector) are not
	 * built in any binding. They render disabled instead of vanishing, for the
	 * reason spelled out in `RecordTab.svelte`.
	 */
	import { DEFAULT_MOTION_PATH_PRESET_ID } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import type { ChromeUiState } from '../../../state/chrome-ui.svelte';
	import RibbonCommand from '../RibbonCommand.svelte';
	import RibbonCommandStack from '../RibbonCommandStack.svelte';
	import RibbonGroup from '../RibbonGroup.svelte';

	const {
		editor,
		chromeUi,
		disabled,
	}: { editor: EditorState; chromeUi?: ChromeUiState; disabled: boolean } = $props();
	const t = useTranslator();

	/** Reveal the inspector's Animation panel, the home of per-effect options. */
	function openAnimationPanel(): void {
		chromeUi?.setInspectorTab('properties');
		if (chromeUi && !chromeUi.inspectorOpen) {
			chromeUi.toggleInspector();
		}
	}
</script>

<RibbonGroup label={t('pptx.animations.advanced')}>
	<RibbonCommand
		label={t('pptx.animations.exitEffects')}
		{disabled}
		onclick={() => editor.animationOps.addAnimation('exit', 'fadeOut')}
	>
		{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M10 2.5 12 7.8l5.5.4-4.2 3.6 1.3 5.3L10 14.4 5.4 17.1l1.3-5.3L2.5 8.2 8 7.8z" /></svg>{/snippet}
	</RibbonCommand>
	<RibbonCommand
		label={t('pptx.animations.pathAnimation')}
		{disabled}
		onclick={() => editor.animationOps.applyMotionPath(DEFAULT_MOTION_PATH_PRESET_ID)}
	>
		{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M3 10h11M11 6.5 14.5 10 11 13.5" /></svg>{/snippet}
	</RibbonCommand>
	<RibbonCommandStack>
		<RibbonCommand compact label={t('pptx.animations.effectOptions')} {disabled} onclick={openAnimationPanel}>
			{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M10 3v3M10 14v3M3 10h3M14 10h3M5.4 5.4l2 2M12.6 12.6l2 2M14.6 5.4l-2 2M7.4 12.6l-2 2" /></svg>{/snippet}
		</RibbonCommand>
		<RibbonCommand
			compact
			label={t('pptx.animations.animationPanel')}
			active={chromeUi?.inspectorOpen}
			onclick={openAnimationPanel}
		>
			{#snippet icon()}<svg viewBox="0 0 20 20"><rect x="2.5" y="3.5" width="15" height="13" rx="1" /><path d="M12.5 3.5v13" /></svg>{/snippet}
		</RibbonCommand>
	</RibbonCommandStack>
	<RibbonCommandStack>
		<RibbonCommand compact label={t('pptx.animations.trigger')} {disabled} onclick={openAnimationPanel}>
			{#snippet icon()}<svg viewBox="0 0 20 20"><path d="m5 3 4 12 2-4.5L15.5 9z" /></svg>{/snippet}
		</RibbonCommand>
		<RibbonCommand compact label={t('pptx.animations.painter')} disabled>
			{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M4 8V4h9v4zM8 8v3h5v6H8" /></svg>{/snippet}
		</RibbonCommand>
	</RibbonCommandStack>
	<RibbonCommand
		label={t('pptx.animations.remove')}
		title={t('pptx.animation.remove')}
		{disabled}
		onclick={() => editor.animationOps.removeAnimation()}
	>
		{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M4 6h12M8 6V4h4v2M6 6l.8 10h6.4L14 6" /></svg>{/snippet}
	</RibbonCommand>
</RibbonGroup>

<RibbonGroup label={t('pptx.animations.timing')}>
	<div class="pptx-svelte-animtiming">
		<label for="pptx-svelte-animation-start">{t('pptx.animations.start')}</label>
		<select id="pptx-svelte-animation-start" disabled>
			<option>{t('pptx.animations.onClick')}</option>
			<option>{t('pptx.animations.withPrevious')}</option>
			<option>{t('pptx.animations.afterPrevious')}</option>
		</select>
		<!-- The caption beside the box is a plain `<span>`, not a `<label for>`,
		     so the field carries its own `aria-label` rather than reading as an
		     anonymous number box (React does the same). -->
		<span class="pptx-svelte-animtiming-caption">
			<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 2" /></svg>
			{t('pptx.animations.duration')}
		</span>
		<input
			type="number"
			min="0"
			step="0.1"
			value="0.5"
			aria-label={t('pptx.animations.duration')}
			disabled
		/>
	</div>
</RibbonGroup>

<style>
	.pptx-svelte-animtiming {
		display: grid;
		grid-template-columns: 48px 88px;
		align-items: center;
		gap: 4px;
		font-size: 10px;
	}

	.pptx-svelte-animtiming-caption {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}

	.pptx-svelte-animtiming-caption svg {
		width: 12px;
		height: 12px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
	}

	.pptx-svelte-animtiming select,
	.pptx-svelte-animtiming input {
		height: 22px;
		padding: 0 4px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 4px;
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		font: inherit;
		font-size: 10px;
	}

	.pptx-svelte-animtiming select:disabled,
	.pptx-svelte-animtiming input:disabled {
		opacity: 0.4;
	}
</style>
