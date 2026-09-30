import type {
	PptxUiSlideShowOptionsElement,
	RibbonCommandRequestEvent,
	RibbonControlId,
	SlideShowOptionsChangeEvent,
	ToolbarActionId,
} from 'pptx-viewer-shared';
import { isActionHidden, SLIDE_SHOW_COMMAND_GROUPS, SLIDE_SHOW_OPTIONS } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { wrapRibbonGroup } from '../ribbon-tagging';
import type { RibbonSlideShowHandlers } from '../ribbon-types';

export interface SlideShowTab {
	el: HTMLElement;
	setSubtitlesVisible(visible: boolean): void;
	/** Reflect the active slide's `hidden` flag on the Hide Slide toggle. */
	setHideSlideActive(active: boolean): void;
	/** Re-read the Options checkboxes from the deck's show settings. */
	syncOptions(): void;
}

/** DOM adapter: shared components own ribbon layout and activation. */
export function createSlideShowTab(
	doc: Document,
	t: Translator,
	handlers: RibbonSlideShowHandlers,
	hiddenActions?: readonly ToolbarActionId[],
): SlideShowTab {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');
	const actions: Partial<Record<RibbonControlId, () => void>> = {
		'slideShow.startSlideShow.fromBeginning': handlers.startFromBeginning,
		'slideShow.startSlideShow.fromCurrent': handlers.startFromCurrent,
		'slideShow.present.presenterView': handlers.openPresenterView,
		'slideShow.startSlideShow.customShow': handlers.openCustomShows,
		'slideShow.present.broadcast': handlers.openBroadcast,
		'slideShow.setUp.setUpSlideShow': handlers.openSetUp,
		'slideShow.setUp.hideSlide': handlers.toggleHideSlide,
		'slideShow.setUp.rehearseTimings': handlers.startRehearsal,
		'slideShow.setUp.record': handlers.startRehearsal,
	};
	const commands = new Map<RibbonControlId, HTMLElement>();
	for (const descriptor of SLIDE_SHOW_COMMAND_GROUPS) {
		const group = doc.createElement('pptx-ui-ribbon-group');
		group.setAttribute('label', t(descriptor.labelKey));
		group.setAttribute('data-ribbon-group', descriptor.id);
		for (const command of descriptor.commands) {
			if (
				command.id === 'slideShow.present.broadcast' &&
				isActionHidden('broadcast', hiddenActions)
			) {
				continue;
			}
			const button = doc.createElement('pptx-ui-ribbon-command');
			button.setAttribute('data-ribbon-control', command.id);
			button.setAttribute('label', t(command.labelKey));
			button.setAttribute('icon', command.icon);
			button.title = t(command.tooltipKey ?? command.labelKey);
			button.toggleAttribute('disabled', Boolean(command.unsupported));
			if (command.id === 'slideShow.setUp.hideSlide') {
				button.setAttribute('pressed', 'false');
			}
			button.addEventListener('command-request', (event) =>
				actions[(event as RibbonCommandRequestEvent).detail.id]?.(),
			);
			commands.set(command.id, button);
			group.append(button);
		}
		el.append(group);
	}
	const optionsGroup = doc.createElement('pptx-ui-ribbon-group');
	optionsGroup.setAttribute('label', t('pptx.slideShow.options'));
	const options = doc.createElement('pptx-ui-slide-show-options') as PptxUiSlideShowOptionsElement;
	options.labels = Object.fromEntries(
		SLIDE_SHOW_OPTIONS.map((option) => [option.id, t(option.labelKey)]),
	);
	const syncOptions = (): void => {
		options.presentationProperties = handlers.showOptions();
	};
	options.addEventListener('show-options-change', (event) => {
		handlers.updateShowOptions((event as SlideShowOptionsChangeEvent).detail);
		syncOptions();
	});
	syncOptions();
	const subtitles = doc.createElement('pptx-ui-ribbon-toggle');
	subtitles.setAttribute('data-ribbon-control', 'slideShow.captions.subtitles');
	subtitles.setAttribute('label', t('pptx.slideShow.subtitles'));
	subtitles.title = t('pptx.slideShow.subtitlesTooltip');
	subtitles.addEventListener('toggle-request', () => handlers.toggleSubtitles());
	const subtitleSettings = doc.createElement('pptx-ui-ribbon-command');
	subtitleSettings.setAttribute('data-ribbon-control', 'slideShow.captions.subtitleSettings');
	subtitleSettings.setAttribute('label', t('pptx.slideShow.subtitleSettings'));
	subtitleSettings.setAttribute('icon', 'captions');
	subtitleSettings.setAttribute('compact', '');
	subtitleSettings.addEventListener('command-request', () => handlers.openSubtitleSettings());
	options.append(wrapRibbonGroup(doc, 'slideShow.captions', subtitles, subtitleSettings));
	optionsGroup.append(options);
	el.append(optionsGroup);
	return {
		el,
		syncOptions,
		setSubtitlesVisible: (visible) => subtitles.toggleAttribute('checked', visible),
		setHideSlideActive: (active) => {
			const button = commands.get('slideShow.setUp.hideSlide')!;
			button.toggleAttribute('active', active);
			button.setAttribute('pressed', String(active));
		},
	};
}
