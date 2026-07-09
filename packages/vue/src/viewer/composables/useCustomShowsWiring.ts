import type { PptxCustomShow, PptxSlide } from 'pptx-viewer-core';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useCustomShows } from './useCustomShows';
import type { UseCustomShowsResult } from './useCustomShows';

export interface UseCustomShowsWiringInput {
	customShows: Ref<PptxCustomShow[]>;
	slides: Ref<PptxSlide[]>;
	activeSlideIndex: Ref<number>;
	activeSlide: ComputedRef<PptxSlide | undefined>;
	pushHistory: () => void;
}

export interface UseCustomShowsWiringResult {
	showCustomShows: Ref<boolean>;
	activeCustomShowId: Ref<string | null>;
	customShowOps: UseCustomShowsResult;
	isCurrentSlideInActiveShow: ComputedRef<boolean>;
	onCreateCustomShow: (name: string) => void;
	onDeleteCustomShow: (showId: string) => void;
	onRenameActiveCustomShow: () => void;
	onDeleteActiveCustomShow: () => void;
	onToggleCurrentSlideInActiveShow: () => void;
}

/**
 * useCustomShowsWiring: Slide Show ▸ Custom Shows panel and ribbon toggle
 * state, layered on top of the underlying `useCustomShows` CRUD composable.
 * Owns which show is "active" for the ribbon's create/rename/delete/toggle
 * actions. Extracted verbatim from `PowerPointViewer.vue`.
 */
export function useCustomShowsWiring(input: UseCustomShowsWiringInput): UseCustomShowsWiringResult {
	const { customShows, slides, activeSlideIndex, activeSlide, pushHistory } = input;
	const { t } = useI18n();

	const showCustomShows = ref(false);
	const activeCustomShowId = ref<string | null>(null);
	const customShowOps = useCustomShows({ customShows, slides, activeSlideIndex, pushHistory });

	function onCreateCustomShow(name: string): void {
		activeCustomShowId.value = customShowOps.createCustomShow(name);
	}
	function onDeleteCustomShow(showId: string): void {
		customShowOps.deleteCustomShow(showId);
		if (activeCustomShowId.value === showId) {
			activeCustomShowId.value = null;
		}
	}

	/** The active slide's relationship id (custom shows reference slides by rId). */
	const activeSlideRId = computed(() => (activeSlide.value as { rId?: string } | undefined)?.rId);
	/** Whether the active slide is part of the active custom show (ribbon toggle state). */
	const isCurrentSlideInActiveShow = computed(() => {
		const id = activeCustomShowId.value;
		const rId = activeSlideRId.value;
		if (id === null || rId === undefined) {
			return false;
		}
		return customShows.value.find((s) => s.id === id)?.slideRIds.includes(rId) ?? false;
	});
	/** Rename the active custom show (Slide Show ribbon). */
	function onRenameActiveCustomShow(): void {
		const id = activeCustomShowId.value;
		if (id === null) {
			return;
		}
		const show = customShows.value.find((s) => s.id === id);
		const next = window.prompt(t('pptx.customShows.renamePrompt'), show?.name ?? '')?.trim();
		if (next) {
			customShowOps.renameCustomShow(id, next);
		}
	}
	/** Delete the active custom show after confirmation (Slide Show ribbon). */
	function onDeleteActiveCustomShow(): void {
		const id = activeCustomShowId.value;
		if (id === null) {
			return;
		}
		const show = customShows.value.find((s) => s.id === id);
		if (window.confirm(t('pptx.customShows.deleteConfirm', { name: show?.name ?? '' }))) {
			onDeleteCustomShow(id);
		}
	}
	/** Add/remove the active slide from the active custom show (Slide Show ribbon). */
	function onToggleCurrentSlideInActiveShow(): void {
		const id = activeCustomShowId.value;
		const rId = activeSlideRId.value;
		if (id === null || rId === undefined) {
			return;
		}
		customShowOps.toggleSlideInShow(id, rId);
	}

	return {
		showCustomShows,
		activeCustomShowId,
		customShowOps,
		isCurrentSlideInActiveShow,
		onCreateCustomShow,
		onDeleteCustomShow,
		onRenameActiveCustomShow,
		onDeleteActiveCustomShow,
		onToggleCurrentSlideInActiveShow,
	};
}
