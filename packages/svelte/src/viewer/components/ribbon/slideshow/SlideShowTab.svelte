<script lang="ts">
	/**
	 * SlideShowTab: the ribbon's Slide Show tab, at React's `SlideShowSection`
	 * control set (Start Slide Show / Present / Set Up / Options).
	 *
	 * Custom Show is a disabled placeholder here exactly as it is in React: the
	 * working custom-show picker lives in the ribbon's always-visible primary
	 * row (`RibbonPrimaryRow` -> `oncustomshows`), so a second live entry point
	 * on this tab would be a duplicate rather than a feature.
	 *
	 * The Options checkboxes are rendered from shared's `SLIDE_SHOW_OPTIONS`
	 * descriptors: the two with real OOXML backing (`p:showPr/@useTimings`,
	 * `@showNarration`) read and write `editor.presentationProperties` through
	 * the same `updatePresentationProperties` path the Set Up Slide Show dialog
	 * uses, so unticking Use Timings really stops timed auto-advance. The other
	 * two have no backing state anywhere and render disabled rather than
	 * pretending to toggle something.
	 */
	import type { SlideShowOptionDescriptor, SlideShowOptionId } from 'pptx-viewer-shared';
	import {
		SLIDE_SHOW_OPTIONS,
		readSlideShowOption,
		slideShowOptionChange,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import RibbonCommand from '../RibbonCommand.svelte';
	import RibbonCommandStack from '../RibbonCommandStack.svelte';
	import RibbonGroup from '../RibbonGroup.svelte';
	import RibbonToggle from '../RibbonToggle.svelte';

	const {
		editor,
		onfrombeginning,
		onfromcurrent,
		onbroadcast,
		onpresenter,
		onsetup,
		onrehearse,
		onsubtitles,
		oncustomshows,
		onhideslide,
		activeSlideHidden = false,
		subtitlesEnabled = false,
	}: {
		/** Owns the deck's presentation properties, which back the Options group. */
		editor?: EditorState;
		onfrombeginning: () => void;
		onfromcurrent: () => void;
		onbroadcast?: () => void;
		onpresenter: () => void;
		onsetup: () => void;
		onrehearse: () => void;
		onsubtitles: () => void;
		oncustomshows: () => void;
		/**
		 * PowerPoint's Hide Slide: mark the ACTIVE slide to be skipped during the
		 * show while it stays in the deck, the thumbnail rail and the sorter.
		 */
		onhideslide: () => void;
		/** Whether the active slide is hidden, for Hide Slide's pressed state. */
		activeSlideHidden?: boolean;
		subtitlesEnabled?: boolean;
	} = $props();
	const t = useTranslator();

	/** PowerPoint keeps Media Controls beside Subtitles, in the second stack. */
	const optionStacks: readonly (readonly SlideShowOptionDescriptor[])[] = [
		SLIDE_SHOW_OPTIONS.slice(0, 3),
		SLIDE_SHOW_OPTIONS.slice(3),
	];

	function optionChecked(option: SlideShowOptionDescriptor): boolean {
		return readSlideShowOption(editor?.presentationProperties, option.id);
	}

	function setOption(id: SlideShowOptionId, checked: boolean): void {
		const change = slideShowOptionChange(id, checked);
		if (!change || !editor) {
			return;
		}
		// Same commit path as SetUpSlideShowDialog's Advance Slides radios: merged
		// onto the current properties, because the setter replaces wholesale.
		editor.presentationMetadata.updatePresentationProperties({
			...editor.presentationProperties,
			...change,
		});
	}
</script>

<div class="pptx-svelte-slideshowtab">
	<RibbonGroup label={t('pptx.slideShow.start')}>
		<RibbonCommand
			label={t('pptx.slideShow.fromBeginning')}
			title={t('pptx.slideShow.fromBeginningTooltip')}
			onclick={onfrombeginning}
		>
			{#snippet icon()}<svg viewBox="0 0 20 20"><path d="m4 3 11 7-11 7zM16.5 3v14" /></svg>{/snippet}
		</RibbonCommand>
		<RibbonCommand
			label={t('pptx.slideShow.fromCurrent')}
			title={t('pptx.slideShow.fromCurrentTooltip')}
			onclick={onfromcurrent}
		>
			{#snippet icon()}<svg viewBox="0 0 20 20"><path d="m5 3 11 7-11 7z" /></svg>{/snippet}
		</RibbonCommand>
	</RibbonGroup>

	<RibbonGroup label={t('pptx.slideShow.present')}>
		<RibbonCommand
			label={t('pptx.slideShow.presenterView')}
			title={t('pptx.slideShow.presenterViewTooltip')}
			onclick={onpresenter}
		>
			{#snippet icon()}<svg viewBox="0 0 20 20"><rect x="2" y="3" width="16" height="11" rx="1" /><path d="M7 18h6M10 14v4" /></svg>{/snippet}
		</RibbonCommand>
		<RibbonCommand
			label={t('pptx.slideShow.customShow')}
			title={t('pptx.customShows.customShowTooltip')}
			onclick={oncustomshows}
		>
			{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M4 4h12v12H4zM7 8h6M7 11h6" /></svg>{/snippet}
		</RibbonCommand>
		{#if onbroadcast}
			<RibbonCommand
				label={t('pptx.slideShow.broadcast')}
				title={t('pptx.slideShow.broadcastTooltip')}
				onclick={onbroadcast}
			>
				{#snippet icon()}<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="1.5" /><path d="M7 7a4.2 4.2 0 0 0 0 6M13 7a4.2 4.2 0 0 1 0 6M4.5 4.5a7.8 7.8 0 0 0 0 11M15.5 4.5a7.8 7.8 0 0 1 0 11" /></svg>{/snippet}
			</RibbonCommand>
		{/if}
	</RibbonGroup>

	<RibbonGroup label={t('pptx.slideShow.setUpGroup')}>
		<RibbonCommand label={t('pptx.slideShow.rehearseCoach')} disabled>
			{#snippet icon()}<svg viewBox="0 0 20 20"><rect x="2" y="5" width="11" height="10" rx="2" /><path d="m13 10 5-3v6z" /></svg>{/snippet}
		</RibbonCommand>
		<RibbonCommand
			label={t('pptx.slideShow.setUp')}
			title={t('pptx.slideShow.setUpTooltip')}
			onclick={onsetup}
		>
			{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M3 5h14M6 10h8M8 15h4M6 3v4M12 8v4M10 13v4" /></svg>{/snippet}
		</RibbonCommand>
		<RibbonCommand
			label={t('pptx.slideShow.hideSlide')}
			active={activeSlideHidden}
			onclick={onhideslide}
		>
			{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M2.5 10S5.5 5 10 5s7.5 5 7.5 5-3 5-7.5 5-7.5-5-7.5-5z" /><path d="m4 4 12 12" /></svg>{/snippet}
		</RibbonCommand>
		<RibbonCommand
			label={t('pptx.slideShow.rehearseTimings')}
			title={t('pptx.slideShow.rehearseTimingsTooltip')}
			onclick={onrehearse}
		>
			{#snippet icon()}<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 2" /></svg>{/snippet}
		</RibbonCommand>
		<RibbonCommand label={t('pptx.titleBar.record')} onclick={onrehearse}>
			{#snippet icon()}<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" /></svg>{/snippet}
		</RibbonCommand>
	</RibbonGroup>

	<RibbonGroup label={t('pptx.slideShow.options')}>
		<RibbonCommandStack>
			{#each optionStacks[0] as option (option.id)}
				<RibbonToggle
					label={t(option.labelKey)}
					checked={optionChecked(option)}
					disabled={option.unsupported || !editor?.editable}
					onchange={(next) => setOption(option.id, next)}
				/>
			{/each}
		</RibbonCommandStack>
		<RibbonCommandStack>
			{#each optionStacks[1] as option (option.id)}
				<RibbonToggle
					label={t(option.labelKey)}
					checked={optionChecked(option)}
					disabled={option.unsupported || !editor?.editable}
					onchange={(next) => setOption(option.id, next)}
				/>
			{/each}
			<RibbonToggle
				label={t('pptx.slideShow.subtitles')}
				title={t('pptx.slideShow.subtitlesTooltip')}
				checked={subtitlesEnabled}
				onchange={() => onsubtitles()}
			/>
			<RibbonCommand compact label={t('pptx.slideShow.subtitleSettings')} onclick={onsubtitles}>
				{#snippet icon()}<svg viewBox="0 0 20 20"><rect x="2" y="4" width="16" height="12" rx="2" /><path d="M5 9h4M11 9h4M5 12h3M10 12h5" /></svg>{/snippet}
			</RibbonCommand>
		</RibbonCommandStack>
	</RibbonGroup>
</div>

<style>
	.pptx-svelte-slideshowtab {
		display: flex;
		align-items: stretch;
		flex-wrap: nowrap;
	}
</style>
