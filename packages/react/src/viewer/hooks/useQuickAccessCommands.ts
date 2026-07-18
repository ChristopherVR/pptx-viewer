import { useCallback, useMemo } from 'react';

/**
 * Maps Quick Access Toolbar catalog ids (`QUICK_ACCESS_COMMAND_CATALOG`)
 * onto the viewer's existing handlers. Consumed by `ViewerToolbarSection`,
 * which passes the resulting callbacks to `QuickAccessToolbar`.
 */

export interface UseQuickAccessCommandsInput {
	onSave: () => void;
	onUndo: () => void;
	onRedo: () => void;
	canUndo: boolean;
	canRedo: boolean;
	/** Jump to slide 1 and start the slide show. */
	onPresentFromStart: () => void;
	onPrint: () => void;
	onExportPdf: () => void;
	onNewSlide: () => void;
	onToggleSpellCheck: () => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
}

export interface UseQuickAccessCommandsResult {
	runQuickAccessCommand: (id: string) => void;
	isQuickAccessCommandDisabled: (id: string) => boolean;
}

export function useQuickAccessCommands(
	input: UseQuickAccessCommandsInput,
): UseQuickAccessCommandsResult {
	const handlers = useMemo<Record<string, () => void>>(
		() => ({
			save: input.onSave,
			undo: input.onUndo,
			redo: input.onRedo,
			presentFromStart: input.onPresentFromStart,
			print: input.onPrint,
			exportPdf: input.onExportPdf,
			newSlide: input.onNewSlide,
			spellCheck: input.onToggleSpellCheck,
			zoomIn: input.onZoomIn,
			zoomOut: input.onZoomOut,
		}),
		[
			input.onSave,
			input.onUndo,
			input.onRedo,
			input.onPresentFromStart,
			input.onPrint,
			input.onExportPdf,
			input.onNewSlide,
			input.onToggleSpellCheck,
			input.onZoomIn,
			input.onZoomOut,
		],
	);

	const runQuickAccessCommand = useCallback(
		(id: string) => {
			handlers[id]?.();
		},
		[handlers],
	);

	const isQuickAccessCommandDisabled = useCallback(
		(id: string) => (id === 'undo' ? !input.canUndo : id === 'redo' ? !input.canRedo : false),
		[input.canUndo, input.canRedo],
	);

	return { runQuickAccessCommand, isQuickAccessCommandDisabled };
}
