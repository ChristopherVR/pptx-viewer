<script lang="ts">
    import { SLIDE_SHOW_COMMAND_GROUPS, SLIDE_SHOW_OPTIONS } from 'pptx-viewer-shared';
    import type { RibbonCommandRequestEvent, RibbonControlId, SlideShowOptionsChangeEvent } from 'pptx-viewer-shared';
    import { useTranslator } from '../../../../i18n/context';
    import type { EditorState } from '../../../editor/editor-state.svelte';
    import SubtitleSettingsControl from './SubtitleSettingsControl.svelte';

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
    const optionLabels = $derived(Object.fromEntries(SLIDE_SHOW_OPTIONS.map(option => [option.id, t(option.labelKey)])));
    function commitOptions(event: Event): void {
        if (!editor?.editable) {return;}
        editor.presentationMetadata.updatePresentationProperties({ ...editor.presentationProperties, ...(event as SlideShowOptionsChangeEvent).detail });
    }
    function requestCommand(event: Event): void {
        const actions: Partial<Record<RibbonControlId, (() => void) | undefined>> = {
            'slideShow.startSlideShow.fromBeginning': onfrombeginning,
            'slideShow.startSlideShow.fromCurrent': onfromcurrent,
            'slideShow.present.presenterView': onpresenter,
            'slideShow.startSlideShow.customShow': oncustomshows,
            'slideShow.present.broadcast': onbroadcast,
            'slideShow.setUp.setUpSlideShow': onsetup,
            'slideShow.setUp.hideSlide': onhideslide,
            'slideShow.setUp.rehearseTimings': onrehearse,
            'slideShow.setUp.record': onrehearse,
        };
        actions[(event as RibbonCommandRequestEvent).detail.id]?.();
    }
</script>

<div class="pptx-svelte-slideshowtab">
    {#each SLIDE_SHOW_COMMAND_GROUPS as group (group.id)}
        <pptx-ui-ribbon-group label={t(group.labelKey)} data-ribbon-group={group.id}>
            {#each group.commands as command (command.id)}
                {#if command.id !== 'slideShow.present.broadcast' || onbroadcast}
                    <pptx-ui-ribbon-command label={t(command.labelKey)} icon={command.icon}
                        data-ribbon-control={command.id} title={t(command.tooltipKey ?? command.labelKey)}
                        disabled={command.unsupported ? '' : undefined}
                        active={command.id === 'slideShow.setUp.hideSlide' && activeSlideHidden ? '' : undefined}
                        pressed={command.id === 'slideShow.setUp.hideSlide' ? String(activeSlideHidden) : undefined}
                        oncommand-request={requestCommand}></pptx-ui-ribbon-command>
                {/if}
            {/each}
        </pptx-ui-ribbon-group>
    {/each}
    <pptx-ui-ribbon-group label={t('pptx.slideShow.options')}>
        <pptx-ui-slide-show-options presentationProperties={editor?.presentationProperties} labels={optionLabels}
            disabled={!editor?.editable} onshow-options-change={commitOptions}>
            <div class="captions" data-ribbon-group="slideShow.captions">
                <pptx-ui-ribbon-toggle data-ribbon-control="slideShow.captions.subtitles" label={t('pptx.slideShow.subtitles')}
                    title={t('pptx.slideShow.subtitlesTooltip')} checked={subtitlesEnabled ? '' : undefined} ontoggle-request={() => onsubtitles()}></pptx-ui-ribbon-toggle>
                <SubtitleSettingsControl />
            </div>
        </pptx-ui-slide-show-options>
    </pptx-ui-ribbon-group>
</div>

<style>
    .pptx-svelte-slideshowtab { display: flex; align-items: stretch; flex-wrap: nowrap; }
    .captions { display: contents; }
</style>
