<script lang="ts">
	/**
	 * Thin adapter around the shared `pptx-ui-notes-toolbar`: it maps panel state
	 * onto the element and routes typed intents to the callbacks. The buttons,
	 * order, roving focus and the hyperlink popover live in the shared view.
	 */
	import type {
		NotesInlineCommand,
		NotesParagraphCommand,
		NotesToolbarRequestEvent,
		NotesToolbarViewState,
	} from 'pptx-viewer-shared';
	import { useTranslator } from '../../i18n/context';

	const { rich, disabled = false, oninline, onparagraph, onlink, onprint, ontogglemode }: {
		rich: boolean;
		disabled?: boolean;
		oninline: (command: NotesInlineCommand) => void;
		onparagraph: (command: NotesParagraphCommand) => void;
		onlink: (url: string, text: string) => void;
		onprint: () => void;
		ontogglemode: () => void;
	} = $props();
	const t = useTranslator();
	const state = $derived<NotesToolbarViewState>({
		rich,
		canFormat: rich,
		showPrint: true,
		disabled,
		translate: t,
	});
	function request(event: NotesToolbarRequestEvent): void {
		const intent = event.detail;
		if (intent.kind === 'inline') {oninline(intent.command);}
		else if (intent.kind === 'paragraph') {onparagraph(intent.command);}
		else if (intent.kind === 'link') {onlink(intent.url, intent.text);}
		else if (intent.kind === 'print') {onprint();}
		else {ontogglemode();}
	}
</script>

<pptx-ui-notes-toolbar class="pptx-svelte-notes-toolbar" {state} onnotes-request={request}></pptx-ui-notes-toolbar>
