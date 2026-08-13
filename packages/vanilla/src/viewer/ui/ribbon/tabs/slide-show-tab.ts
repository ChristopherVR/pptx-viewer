import type { SlideShowOptionDescriptor, ToolbarActionId } from 'pptx-viewer-shared';
import {
	isActionHidden,
	readSlideShowOption,
	slideShowOptionChange,
	SLIDE_SHOW_OPTIONS,
} from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import type { RibbonSlideShowHandlers } from '../ribbon-types';

export interface SlideShowTab {
	el: HTMLElement;
	setSubtitlesVisible(visible: boolean): void;
	/** Reflect the active slide's `hidden` flag on the Hide Slide toggle. */
	setHideSlideActive(active: boolean): void;
	/** Re-read the Options checkboxes from the deck's show settings. */
	syncOptions(): void;
}

/** One Options checkbox plus the shared descriptor that decided how it behaves. */
interface OptionToggle {
	el: HTMLLabelElement;
	descriptor: SlideShowOptionDescriptor;
	input: HTMLInputElement;
}

/**
 * A show option rendered as a labelled checkbox, mirroring React's
 * `RibbonToggle`.
 *
 * The shared `SLIDE_SHOW_OPTIONS` descriptor decides everything: an
 * `unsupported` entry (Keep Slides Updated, Show Media Controls) renders
 * disabled and unchecked because no binding has any state behind it, and the
 * other two read and write the deck's real `p:showPr` flags. These checkboxes
 * previously had no change listener at all, so all four were inert and "Use
 * Timings" claimed to be on whether or not the deck said so.
 */
function optionToggle(
	doc: Document,
	t: Translator,
	descriptor: SlideShowOptionDescriptor,
	handlers: Pick<RibbonSlideShowHandlers, 'showOptions' | 'updateShowOptions'>,
): OptionToggle {
	const label = t(descriptor.labelKey);
	const el = createEl(doc, 'label', 'pptxv-show-option');
	const input = doc.createElement('input');
	input.type = 'checkbox';
	input.disabled = descriptor.unsupported;
	input.setAttribute('aria-label', label);
	if (!descriptor.unsupported) {
		input.addEventListener('change', () => {
			const change = slideShowOptionChange(descriptor.id, input.checked);
			if (change) {
				handlers.updateShowOptions(change);
			}
		});
	}
	el.append(input, doc.createTextNode(label));
	return { el, descriptor, input };
}

/**
 * The Slide Show ribbon tab: Start, Present, Set Up and Options, matching
 * React's `SlideShowSection`.
 *
 * The commands with no implementation in any binding (Rehearse with Coach, and
 * the two Options entries the shared descriptor list marks `unsupported`) ship
 * disabled rather than absent, so the tab reads the same everywhere and a user
 * is never told a feature is missing in one binding only. The Options cluster
 * itself is rendered from the shared `SLIDE_SHOW_OPTIONS` and reads/writes the
 * deck's real show settings, so unticking Use Timings actually stops the
 * auto-advance (`presentation-auto-advance.ts` reads `advanceMode`).
 * Custom Shows is the one deliberate divergence: React
 * disables it, this binding has a working dialog for it, and disabling a
 * feature that works to match a placeholder would be the wrong trade.
 */
export function createSlideShowTab(
	doc: Document,
	t: Translator,
	handlers: RibbonSlideShowHandlers,
	hiddenActions?: readonly ToolbarActionId[],
): SlideShowTab {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');
	const fromBeginning = makeButton(doc, {
		label: t('pptx.slideShow.fromBeginning'),
		text: t('pptx.slideShow.fromBeginning'),
		icon: 'play',
		onClick: handlers.startFromBeginning,
	});
	fromBeginning.btn.title = t('pptx.slideShow.fromBeginningTooltip');
	const fromCurrent = makeButton(doc, {
		label: t('pptx.slideShow.fromCurrent'),
		text: t('pptx.slideShow.fromCurrent'),
		icon: 'presentation',
		onClick: handlers.startFromCurrent,
	});
	fromCurrent.btn.title = t('pptx.slideShow.fromCurrentTooltip');
	const presenter = makeButton(doc, {
		label: t('pptx.slideShow.presenterView'),
		text: t('pptx.slideShow.presenterView'),
		icon: 'presentation',
		onClick: handlers.openPresenterView,
	});
	presenter.btn.title = t('pptx.slideShow.presenterViewTooltip');
	const customShow = makeButton(doc, {
		label: t('pptx.slideShow.customShow'),
		text: t('pptx.customShows.title'),
		onClick: handlers.openCustomShows,
	});
	const broadcast = isActionHidden('broadcast', hiddenActions)
		? null
		: makeButton(doc, {
				label: t('pptx.slideShow.broadcast'),
				text: t('pptx.slideShow.broadcast'),
				icon: 'broadcast',
				onClick: handlers.openBroadcast,
			});
	if (broadcast) {
		broadcast.btn.title = t('pptx.slideShow.broadcastTooltip');
	}
	const rehearseCoach = makeButton(doc, {
		label: t('pptx.slideShow.rehearseCoach'),
		text: t('pptx.slideShow.rehearseCoach'),
		onClick: () => {},
	});
	rehearseCoach.setDisabled(true);
	const setUp = makeButton(doc, {
		label: t('pptx.slideShow.setUp'),
		text: t('pptx.slideShow.setUp'),
		onClick: handlers.openSetUp,
	});
	setUp.btn.title = t('pptx.slideShow.setUpTooltip');
	// PowerPoint's Hide Slide: skip the ACTIVE slide during the show while
	// leaving it in the deck, the thumbnail rail and the sorter.
	const hideSlide = makeButton(doc, {
		label: t('pptx.slideShow.hideSlide'),
		text: t('pptx.slideShow.hideSlide'),
		onClick: () => handlers.toggleHideSlide(),
	});
	hideSlide.btn.setAttribute('aria-pressed', 'false');
	const rehearse = makeButton(doc, {
		label: t('pptx.slideShow.rehearseTimings'),
		text: t('pptx.slideShow.rehearseTimings'),
		onClick: handlers.startRehearsal,
	});
	rehearse.btn.title = t('pptx.slideShow.rehearseTimingsTooltip');
	const record = makeButton(doc, {
		label: t('pptx.titleBar.record'),
		text: t('pptx.titleBar.record'),
		onClick: handlers.startRehearsal,
	});
	const subtitles = makeButton(doc, {
		label: t('pptx.slideShow.subtitles'),
		text: t('pptx.slideShow.subtitles'),
		onClick: handlers.toggleSubtitles,
	});
	subtitles.btn.title = t('pptx.slideShow.subtitlesTooltip');
	const subtitleSettings = makeButton(doc, {
		label: t('pptx.slideShow.subtitleSettings'),
		text: t('pptx.slideShow.subtitleSettings'),
		onClick: handlers.openSubtitleSettings,
	});

	const options = createEl(doc, 'div', 'pptxv-show-options');
	const optionToggles = SLIDE_SHOW_OPTIONS.map((descriptor) =>
		optionToggle(doc, t, descriptor, handlers),
	);
	options.append(...optionToggles.map((toggle) => toggle.el));
	/** Pull the two supported flags back off the deck (shared `readSlideShowOption`). */
	const syncOptions = (): void => {
		const properties = handlers.showOptions();
		for (const toggle of optionToggles) {
			toggle.input.checked = toggle.descriptor.unsupported
				? false
				: readSlideShowOption(properties, toggle.descriptor.id);
		}
	};
	syncOptions();

	el.append(
		fromBeginning.btn,
		fromCurrent.btn,
		presenter.btn,
		customShow.btn,
		...(broadcast ? [broadcast.btn] : []),
		rehearseCoach.btn,
		setUp.btn,
		hideSlide.btn,
		rehearse.btn,
		record.btn,
		options,
		subtitles.btn,
		subtitleSettings.btn,
	);
	return {
		el,
		syncOptions,
		setSubtitlesVisible: (visible) => subtitles.setActive(visible),
		setHideSlideActive: (active) => {
			hideSlide.setActive(active);
			hideSlide.btn.setAttribute('aria-pressed', String(active));
		},
	};
}
