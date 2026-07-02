<script setup lang="ts">
import {
	Bold,
	IndentDecrease,
	IndentIncrease,
	Italic,
	Link,
	List,
	ListOrdered,
	Printer,
	Strikethrough,
	Underline,
} from 'lucide-vue-next';
import type { NotesInlineCommand } from 'pptx-viewer-shared';
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * NotesToolbar: the formatting toolbar for the rich speaker-notes editor.
 *
 * Mirrors React's `NotesToolbar` (bold/italic/underline/strikethrough, bullet
 * and numbered lists, indent/outdent, hyperlink popover, print, and the
 * rich/plain toggle). Purely presentational: every control emits an intent and
 * the parent `NotesPanel` runs it through the shared notes helpers. The
 * hyperlink popover is owned here so the panel stays focused on the editor.
 */
const props = defineProps<{
	isRichEnabled: boolean;
	showLinkPopover: boolean;
	savedSelectionText: string;
}>();

const emit = defineEmits<{
	inline: [command: NotesInlineCommand];
	toggleBullet: [];
	toggleNumbered: [];
	indent: [];
	outdent: [];
	linkButtonClick: [];
	insertLink: [url: string, displayText: string];
	closeLinkPopover: [];
	print: [];
	toggleRich: [];
}>();

const { t } = useI18n();

const linkUrl = ref('');
const linkText = ref('');
const urlInputRef = ref<HTMLInputElement | null>(null);

// Seed the display-text field from the captured selection each time the popover
// opens, and focus the URL input.
watch(
	() => props.showLinkPopover,
	(open) => {
		if (open) {
			linkUrl.value = '';
			linkText.value = props.savedSelectionText;
			void Promise.resolve().then(() => urlInputRef.value?.focus());
		}
	},
);

function submitLink(): void {
	if (linkUrl.value.trim().length === 0) {
		return;
	}
	emit('insertLink', linkUrl.value, linkText.value);
}

const GROUP =
	'inline-flex items-center rounded bg-muted text-xs overflow-hidden border border-border/60 relative';
const BTN = 'px-2 py-1 hover:bg-accent text-foreground';
const BTN_L = `${BTN} border-l border-border/60`;
const SEP = 'w-px h-4 bg-border mx-0.5';
</script>

<template>
	<div class="pptx-vue-notes-toolbar mb-1 flex items-center justify-between gap-2">
		<div :class="GROUP">
			<button
				type="button"
				:class="BTN"
				:title="t('pptx.notesToolbar.bold')"
				@click="emit('inline', 'bold')"
			>
				<Bold class="w-3.5 h-3.5" />
			</button>
			<button
				type="button"
				:class="BTN_L"
				:title="t('pptx.notesToolbar.italic')"
				@click="emit('inline', 'italic')"
			>
				<Italic class="w-3.5 h-3.5" />
			</button>
			<button
				type="button"
				:class="BTN_L"
				:title="t('pptx.notesToolbar.underline')"
				@click="emit('inline', 'underline')"
			>
				<Underline class="w-3.5 h-3.5" />
			</button>
			<button
				type="button"
				:class="BTN_L"
				:title="t('pptx.notesToolbar.strikethrough')"
				@click="emit('inline', 'strikeThrough')"
			>
				<Strikethrough class="w-3.5 h-3.5" />
			</button>

			<span :class="SEP" aria-hidden="true" />

			<button
				type="button"
				:class="BTN"
				:title="t('pptx.notesToolbar.bulletedList')"
				@click="emit('toggleBullet')"
			>
				<List class="w-3.5 h-3.5" />
			</button>
			<button
				type="button"
				:class="BTN_L"
				:title="t('pptx.notesToolbar.numberedList')"
				@click="emit('toggleNumbered')"
			>
				<ListOrdered class="w-3.5 h-3.5" />
			</button>

			<span :class="SEP" aria-hidden="true" />

			<button
				type="button"
				:class="BTN"
				:title="t('pptx.notesToolbar.increaseIndent')"
				@click="emit('indent')"
			>
				<IndentIncrease class="w-3.5 h-3.5" />
			</button>
			<button
				type="button"
				:class="BTN_L"
				:title="t('pptx.notesToolbar.decreaseIndent')"
				@click="emit('outdent')"
			>
				<IndentDecrease class="w-3.5 h-3.5" />
			</button>

			<span :class="SEP" aria-hidden="true" />

			<button
				type="button"
				:class="BTN"
				:title="t('pptx.notesToolbar.insertLink')"
				@click="emit('linkButtonClick')"
			>
				<Link class="w-3.5 h-3.5" />
			</button>
			<button
				type="button"
				:class="BTN_L"
				:title="t('pptx.notesToolbar.printNotes')"
				@click="emit('print')"
			>
				<Printer class="w-3.5 h-3.5" />
			</button>

			<!-- Hyperlink popover -->
			<div
				v-if="showLinkPopover"
				class="pptx-vue-notes-link-popover absolute bottom-full left-0 mb-1 z-10 w-72 rounded-lg border border-border bg-muted p-3 shadow-lg"
			>
				<form class="space-y-2" @submit.prevent="submitLink">
					<div>
						<label class="mb-0.5 block text-[10px] text-muted-foreground">{{
							t('pptx.notesToolbar.linkUrl')
						}}</label>
						<input
							ref="urlInputRef"
							v-model="linkUrl"
							type="text"
							placeholder="https://..."
							class="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
						/>
					</div>
					<div>
						<label class="mb-0.5 block text-[10px] text-muted-foreground">{{
							t('pptx.notesToolbar.displayText')
						}}</label>
						<input
							v-model="linkText"
							type="text"
							:placeholder="t('pptx.notesToolbar.displayText')"
							class="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
						/>
					</div>
					<div class="flex justify-end gap-2">
						<button
							type="button"
							class="px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
							@click="emit('closeLinkPopover')"
						>
							{{ t('pptx.share.cancel') }}
						</button>
						<button
							type="submit"
							class="rounded bg-primary px-2 py-1 text-[10px] text-white hover:bg-primary/80"
						>
							{{ t('pptx.notesToolbar.insertLink') }}
						</button>
					</div>
				</form>
			</div>
		</div>

		<button
			type="button"
			class="rounded border border-border/60 bg-muted px-2 py-1 text-[10px] text-foreground hover:bg-accent"
			:title="
				isRichEnabled ? t('pptx.notesToolbar.switchToPlain') : t('pptx.notesToolbar.switchToRich')
			"
			@click="emit('toggleRich')"
		>
			{{ isRichEnabled ? t('pptx.notesToolbar.plain') : t('pptx.notesToolbar.rich') }}
		</button>
	</div>
</template>
