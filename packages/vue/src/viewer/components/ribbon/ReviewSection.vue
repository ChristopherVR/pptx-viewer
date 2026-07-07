<script setup lang="ts">
import { GitCompare, Globe, MessageSquare, ShieldCheck, SpellCheck } from 'lucide-vue-next';
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
	<button
		v-if="props.onToggleComments"
		:class="cn(pill, props.isCommentsPanelOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		:title="t('pptx.review.toggleComments')"
		@click="props.onToggleComments()"
	>
		<MessageSquare :class="ic" />
		{{ t('pptx.toolbar.comments') }}
		<span
			v-if="(props.slideCommentCount ?? 0) > 0"
			class="inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-amber-500 text-[10px] font-medium text-white px-1"
		>
			{{ props.slideCommentCount }}
		</span>
	</button>
	<button
		:class="cn(pill, props.spellCheckEnabled ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		:title="t('pptx.review.toggleSpellCheck')"
		@click="props.onSetSpellCheckEnabled(!props.spellCheckEnabled)"
	>
		<SpellCheck :class="ic" />
		{{ t('pptx.review.spelling') }}
	</button>
	<button
		v-if="props.onCompare"
		:disabled="!props.canEdit"
		:class="pill"
		:title="t('pptx.ribbon.compareTitle')"
		@click="props.onCompare()"
	>
		<GitCompare :class="ic" />
		{{ t('pptx.ribbon.compare') }}
	</button>

	<div :class="SEP" />

	<button
		v-if="props.onSetLanguage"
		:class="pill"
		:title="t('pptx.review.languageTooltip')"
		@click="props.onSetLanguage()"
	>
		<Globe :class="ic" />
		{{ t('pptx.review.language') }}
	</button>
	<button
		v-if="props.onOpenAccessibilityCheck"
		:class="pill"
		:title="t('pptx.review.accessibilityCheckTooltip')"
		@click="props.onOpenAccessibilityCheck()"
	>
		<ShieldCheck :class="ic" />
		{{ t('pptx.review.accessibilityCheck') }}
	</button>
</template>
