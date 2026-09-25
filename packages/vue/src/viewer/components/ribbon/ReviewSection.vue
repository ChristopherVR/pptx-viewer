<script setup lang="ts">
/**
 * ReviewSection: the Vue 3 port of React's `toolbar/ReviewSection.tsx`.
 *
 * Proofing (Spelling, Thesaurus), Accessibility, Language (Translate, Language),
 * Changes (Mark All Read, Compare), Comments (Comments, Delete, Previous, Next,
 * Show Comments) and Protect (Read Only, Restrict Permission, Hide Ink).
 *
 * Entries the reference renders inert pending a backing feature are rendered
 * inert here too rather than omitted: a tab that is merely shorter is the way
 * this binding drifts without any layout spec noticing.
 */
import {
	BookOpen,
	ChevronLeft,
	ChevronRight,
	Copy,
	EyeOff,
	GitCompare,
	Globe,
	Languages,
	LockKeyhole,
	MessageSquare,
	MessageSquarePlus,
	ShieldCheck,
	SpellCheck,
	Trash2,
} from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { ic, pill, SEP } from './ribbon-constants';

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
</script>

<template>
	<!-- Proofing -->
	<button
		data-ribbon-group="review.proofing"
		data-ribbon-control="review.proofing.spelling"
		:class="cn(pill, props.spellCheckEnabled ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		:title="t('pptx.review.toggleSpellCheck')"
		@click="props.onSetSpellCheckEnabled(!props.spellCheckEnabled)"
	>
		<SpellCheck :class="ic" />
		{{ t('pptx.review.spelling') }}
	</button>
	<button
		disabled
		:class="pill"
		data-ribbon-group="review.proofing"
		data-ribbon-control="review.proofing.thesaurus"
	>
		<BookOpen :class="ic" />
		{{ t('pptx.review.thesaurus') }}
	</button>

	<div :class="SEP" />

	<!-- Accessibility -->
	<button
		v-if="props.onOpenAccessibilityCheck"
		data-ribbon-group="review.accessibility"
		data-ribbon-control="review.accessibility.check"
		:class="pill"
		:title="t('pptx.review.accessibilityCheckTooltip')"
		@click="props.onOpenAccessibilityCheck()"
	>
		<ShieldCheck :class="ic" />
		{{ t('pptx.review.accessibilityCheck') }}
	</button>

	<div :class="SEP" />

	<!-- Language -->
	<button
		disabled
		:class="pill"
		data-ribbon-group="review.language"
		data-ribbon-control="review.language.translate"
	>
		<Languages :class="ic" />
		{{ t('pptx.review.translate') }}
	</button>
	<button
		v-if="props.onSetLanguage"
		data-ribbon-group="review.language"
		:class="pill"
		:title="t('pptx.review.languageTooltip')"
		@click="props.onSetLanguage()"
	>
		<Globe :class="ic" />
		{{ t('pptx.review.language') }}
	</button>

	<div :class="SEP" />

	<!-- Changes -->
	<button
		disabled
		:class="pill"
		data-ribbon-group="review.compare"
		data-ribbon-control="review.compare.markAllRead"
	>
		<Copy :class="ic" />
		{{ t('pptx.review.markAllRead') }}
	</button>
	<button
		v-if="props.onCompare"
		data-ribbon-group="review.compare"
		data-ribbon-control="review.compare.compare"
		:disabled="!props.canEdit"
		:class="pill"
		:title="t('pptx.ribbon.compareTitle')"
		@click="props.onCompare()"
	>
		<GitCompare :class="ic" />
		{{ t('pptx.ribbon.compare') }}
	</button>

	<div :class="SEP" />

	<!-- Comments -->
	<button
		v-if="props.onToggleComments"
		data-ribbon-group="review.comments"
		:class="cn(pill, props.isCommentsPanelOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		:title="t('pptx.review.toggleComments')"
		@click="props.onToggleComments()"
	>
		<MessageSquarePlus :class="ic" />
		{{ t('pptx.toolbar.comments') }}
		<span
			v-if="(props.slideCommentCount ?? 0) > 0"
			class="inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-amber-500 text-[10px] font-medium text-white px-1"
		>
			{{ props.slideCommentCount }}
		</span>
	</button>
	<button
		disabled
		:class="pill"
		data-ribbon-group="review.comments"
		data-ribbon-control="review.comments.delete"
	>
		<Trash2 :class="ic" />
		{{ t('pptx.common.delete') }}
	</button>
	<button
		disabled
		:class="pill"
		data-ribbon-group="review.comments"
		data-ribbon-control="review.comments.previous"
	>
		<ChevronLeft :class="ic" />
		{{ t('pptx.common.previous') }}
	</button>
	<button
		disabled
		:class="pill"
		data-ribbon-group="review.comments"
		data-ribbon-control="review.comments.next"
	>
		<ChevronRight :class="ic" />
		{{ t('pptx.common.next') }}
	</button>
	<button
		:class="pill"
		data-ribbon-group="review.comments"
		data-ribbon-control="review.comments.showComments"
		@click="props.onToggleComments?.()"
	>
		<MessageSquare :class="ic" />
		{{ t('pptx.review.showComments') }}
	</button>

	<div :class="SEP" />

	<!-- Protect -->
	<button
		disabled
		:class="pill"
		data-ribbon-group="review.protect"
		data-ribbon-control="review.protect.readOnly"
	>
		<LockKeyhole :class="ic" />
		{{ t('pptx.review.readOnly') }}
	</button>
	<button
		disabled
		:class="pill"
		data-ribbon-group="review.protect"
		data-ribbon-control="review.protect.restrictPermission"
	>
		<ShieldCheck :class="ic" />
		{{ t('pptx.review.restrictPermission') }}
	</button>
	<button
		disabled
		:class="pill"
		data-ribbon-group="review.ink"
		data-ribbon-control="review.ink.hideInk"
	>
		<EyeOff :class="ic" />
		{{ t('pptx.review.hideInk') }}
	</button>
</template>
