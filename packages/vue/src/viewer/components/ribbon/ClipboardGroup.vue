<script setup lang="ts">
/**
 * ClipboardGroup: the Home tab's Clipboard group (Paste, Cut, Copy, Format
 * Painter) with the brief copied / cut feedback flash. Split out of
 * `HomeSection.vue` to keep that file short.
 */
import { ClipboardPaste, Copy, Paintbrush, Scissors } from 'lucide-vue-next';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { gB, gL, grp, ic } from './ribbon-constants';
import type { ElementClipboardPayload } from './ribbon-types';

interface Props {
	canEdit: boolean;
	/** Cut and Copy act on the selection, so with nothing selected they are disabled. */
	hasSelection: boolean;
	clipboardPayload: ElementClipboardPayload | null;
	formatPainterActive?: boolean;
	canActivateFormatPainter?: boolean;
	onCopy: () => void;
	onCut: () => void;
	onPaste: () => void;
	onToggleFormatPainter?: () => void;
}

const props = defineProps<Props>();
const { t } = useI18n();

const copiedFeedback = ref(false);
const cutFeedback = ref(false);

function handleCut(): void {
	props.onCut();
	cutFeedback.value = true;
	setTimeout(() => {
		cutFeedback.value = false;
	}, 600);
}

function handleCopy(): void {
	props.onCopy();
	copiedFeedback.value = true;
	setTimeout(() => {
		copiedFeedback.value = false;
	}, 600);
}
</script>

<template>
	<div class="flex flex-col items-center gap-0.5" data-ribbon-group="home.clipboard">
		<div :class="grp">
			<button
				type="button"
				data-ribbon-control="home.clipboard.paste"
				:disabled="!props.clipboardPayload || !props.canEdit"
				:class="gB"
				:title="t('pptx.arrange.paste')"
				@click="props.onPaste()"
			>
				<ClipboardPaste :class="ic" />
			</button>
			<button
				type="button"
				data-ribbon-control="home.clipboard.cut"
				:disabled="!props.canEdit || !hasSelection"
				:class="cn(gB, cutFeedback && 'bg-green-600/20 text-green-400')"
				:title="t('pptx.arrange.cut')"
				@click="handleCut()"
			>
				<Scissors :class="ic" />
			</button>
			<button
				type="button"
				data-ribbon-control="home.clipboard.copy"
				:disabled="!hasSelection"
				:class="cn(gB, copiedFeedback && 'bg-green-600/20 text-green-400')"
				:title="t('pptx.arrange.copy')"
				@click="handleCopy()"
			>
				<Copy :class="ic" />
			</button>
			<button
				v-if="props.onToggleFormatPainter"
				type="button"
				:disabled="
					!props.canEdit || (props.canActivateFormatPainter === false && !props.formatPainterActive)
				"
				data-testid="format-painter-toggle"
				data-ribbon-control="home.clipboard.formatPainter"
				:data-active="props.formatPainterActive ? 'true' : 'false'"
				:class="
					cn(gL, props.formatPainterActive ? 'bg-amber-600 hover:bg-amber-500 text-amber-50' : '')
				"
				:title="t('pptx.arrange.formatPainter')"
				@click="props.onToggleFormatPainter()"
			>
				<Paintbrush :class="ic" />
			</button>
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">{{
			t('pptx.ribbon.clipboard')
		}}</span>
	</div>
</template>
