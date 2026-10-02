/**
 * A command the title bar's "Tell me what you want to do" search can run.
 *
 * The search box, filtering, result list and keyboard handling live in the shared
 * `pptx-ui-title-bar`; the vanilla binding only supplies this short local list
 * and runs the chosen entry (see `title-bar.ts`).
 */
export interface CommandSearchCommand {
	/** Existing `pptx.*` translation key for the visible label. */
	labelKey: string;
	run(): void;
}
