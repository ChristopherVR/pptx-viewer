import type { ToolbarActionId } from 'pptx-viewer-shared';
import { isActionHidden } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import type { RibbonSlideShowHandlers } from '../ribbon-types';

export interface SlideShowTab {
	el: HTMLElement;
	setSubtitlesVisible(visible: boolean): void;
}

/** Compact Slide Show tab using only established viewer actions. */
export function createSlideShowTab(
	doc: Document,
	t: Translator,
	handlers: RibbonSlideShowHandlers,
	hiddenActions?: readonly ToolbarActionId[],
): SlideShowTab {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');
	const fromBeginning = makeButton(doc, {
		label: t('pptx.slideShow.fromBeginningTooltip'),
		text: t('pptx.slideShow.fromBeginning'),
		icon: 'play',
		onClick: handlers.startFromBeginning,
	});
	const fromCurrent = makeButton(doc, {
		label: t('pptx.slideShow.fromCurrentTooltip'),
		text: t('pptx.slideShow.fromCurrent'),
		icon: 'presentation',
		onClick: handlers.startFromCurrent,
	});
	const broadcast = isActionHidden('broadcast', hiddenActions)
		? null
		: makeButton(doc, {
				label: t('pptx.slideShow.broadcastTooltip'),
				text: t('pptx.slideShow.broadcast'),
				icon: 'broadcast',
				onClick: handlers.openBroadcast,
			});
	const presenter = makeButton(doc, {
		label: t('pptx.slideShow.presenterViewTooltip'),
		text: t('pptx.slideShow.presenterView'),
		icon: 'presentation',
		onClick: handlers.openPresenterView,
	});
	const setUp = makeButton(doc, {
		label: t('pptx.slideShow.setUpTooltip'),
		text: t('pptx.slideShow.setUp'),
		onClick: handlers.openSetUp,
	});
	const rehearse = makeButton(doc, {
		label: t('pptx.slideShow.rehearseTimingsTooltip'),
		text: t('pptx.slideShow.rehearseTimings'),
		onClick: handlers.startRehearsal,
	});
	const customShows = makeButton(doc, {
		label: t('pptx.customShows.title'),
		text: t('pptx.customShows.title'),
		onClick: handlers.openCustomShows,
	});
	const subtitles = makeButton(doc, {
		label: t('pptx.slideShow.subtitles'),
		text: t('pptx.slideShow.subtitles'),
		onClick: handlers.toggleSubtitles,
	});
	const subtitleSettings = makeButton(doc, {
		label: t('pptx.slideShow.subtitleSettings'),
		text: t('pptx.slideShow.subtitleSettings'),
		onClick: handlers.openSubtitleSettings,
	});
	el.append(
		fromBeginning.btn,
		fromCurrent.btn,
		presenter.btn,
		setUp.btn,
		rehearse.btn,
		customShows.btn,
		...(broadcast ? [broadcast.btn] : []),
		subtitles.btn,
		subtitleSettings.btn,
	);
	return {
		el,
		setSubtitlesVisible: (visible) => subtitles.setActive(visible),
	};
}
