<script setup lang="ts">
/**
 * ReviewSection — the Vue 3 port of React's `ReviewSection` from
 * `toolbar/DesignTransitionsReviewSection.tsx`. Renders the Review ribbon tab's
 * Comments (with slide comment-count badge), Spelling toggle and Compare
 * buttons. A faithful, mechanical port for visual + behavioral parity: class
 * strings are copied verbatim, callbacks arrive as function props.
 */
import { GitCompare, MessageSquare, SpellCheck } from 'lucide-vue-next';

import { cn } from '../../../utils';
import { ic, pill } from './ribbon-constants';

interface Props {
	canEdit: boolean;
	spellCheckEnabled: boolean;
	onSetSpellCheckEnabled: (enabled: boolean) => void;
	onToggleComments?: () => void;
	isCommentsPanelOpen?: boolean;
	slideCommentCount?: number;
	onCompare?: () => void;
}

const props = defineProps<Props>();
</script>

<template>
	<button
		v-if="props.onToggleComments"
		:class="cn(pill, props.isCommentsPanelOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		title="Toggle comments panel"
		@click="props.onToggleComments()"
	>
		<MessageSquare :class="ic" />
		Comments
		<span
			v-if="(props.slideCommentCount ?? 0) > 0"
			class="inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-amber-500 text-[10px] font-medium text-white px-1"
		>
			{{ props.slideCommentCount }}
		</span>
	</button>
	<button
		:class="cn(pill, props.spellCheckEnabled ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		title="Toggle spell check"
		@click="props.onSetSpellCheckEnabled(!props.spellCheckEnabled)"
	>
		<SpellCheck :class="ic" />
		Spelling
	</button>
	<button
		v-if="props.onCompare"
		:disabled="!props.canEdit"
		:class="pill"
		title="Compare with another presentation"
		@click="props.onCompare()"
	>
		<GitCompare :class="ic" />
		Compare
	</button>
</template>
