<script lang="ts">
	/**
	 * DialogFooter: thin adapter around the shared `pptx-ui-dialog-footer`, the
	 * Cancel / OK / primary row at the bottom of a dialog. The dialog shell, its
	 * backdrop and dismissal stay in the dialog component; this routes the
	 * activated action id.
	 */
	import type { DialogFooterAction, DialogFooterRequestEvent } from 'pptx-viewer-shared';

	const { actions, onaction }: {
		actions: readonly DialogFooterAction[];
		onaction: (id: string) => void;
	} = $props();
</script>

<pptx-ui-dialog-footer
	state={{ actions }}
	ondialog-footer-request={(event: DialogFooterRequestEvent) => onaction(event.detail.id)}
></pptx-ui-dialog-footer>
