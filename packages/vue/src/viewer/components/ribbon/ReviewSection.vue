<script setup lang="ts">
import { buildReviewRibbon } from 'pptx-viewer-shared';
import type { RibbonCommandRequestEvent } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

interface Props {
	canEdit: boolean;
	spellCheckEnabled: boolean;
	onSetSpellCheckEnabled: (enabled: boolean) => void;
	onToggleComments?: () => void;
	isCommentsPanelOpen?: boolean;
	slideCommentCount?: number;
	onCompare?: () => void;
	onOpenAccessibilityCheck?: () => void;
	onSetLanguage?: () => void;
}

const props = defineProps<Props>();

const { t } = useI18n();
const groups = computed(() =>
	buildReviewRibbon(t, {
		editable: props.canEdit,
		spellCheck: props.spellCheckEnabled,
		canAccessibility: Boolean(props.onOpenAccessibilityCheck),
		canLanguage: Boolean(props.onSetLanguage),
		canCompare: Boolean(props.onCompare),
		canComments: Boolean(props.onToggleComments),
		commentsOpen: props.isCommentsPanelOpen,
		commentCount: props.slideCommentCount,
	}),
);
function request(event: Event): void {
	switch ((event as RibbonCommandRequestEvent).detail.id) {
		case 'review.proofing.spelling':
			props.onSetSpellCheckEnabled(!props.spellCheckEnabled);
			break;
		case 'review.accessibility.check':
			props.onOpenAccessibilityCheck?.();
			break;
		case 'review.language.language':
			props.onSetLanguage?.();
			break;
		case 'review.compare.compare':
			if (props.canEdit) {
				props.onCompare?.();
			}
			break;
		case 'review.comments.newComment':
		case 'review.comments.showComments':
			props.onToggleComments?.();
			break;
	}
}
</script>
<template><pptx-ui-ribbon-section :groups.prop="groups" @command-request="request" /></template>
