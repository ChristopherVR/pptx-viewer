import type { PrintSettings } from '../../export/print-document';
import { AUTOSAVE_MIN_INTERVAL_SECONDS } from '../autosave-store';
import type { ToolbarTabDefinition } from '../toolbar-actions';
import { TOOLBAR_TABS } from '../toolbar-actions';
import type { ImageResolutionPreset, ViewerOptions } from './viewer-options';

/**
 * Pure helpers that translate File > Options values into the behaviors the
 * bindings actually wire: history depth, autosave cadence, tooltips, ribbon
 * visibility, print defaults, image export quality, and protected view.
 */

/** Maximum undo steps for `EditorHistory({ maxDepth })`. */
export function resolveHistoryDepth(options: ViewerOptions): number {
	const steps = Math.round(options.advanced.maximumUndoSteps);
	return Math.min(150, Math.max(3, Number.isFinite(steps) ? steps : 100));
}

/** AutoRecover cadence in seconds, honoring the shared minimum. */
export function resolveAutosaveIntervalSeconds(options: ViewerOptions): number {
	const seconds = Math.round(options.save.autoRecoverIntervalMinutes * 60);
	return Math.max(AUTOSAVE_MIN_INTERVAL_SECONDS, Number.isFinite(seconds) ? seconds : 120);
}

/**
 * Tooltip text for a chrome control under the current ScreenTip style:
 * `off` suppresses tooltips entirely, `plain` drops the description, and
 * shortcut hints append only while Accessibility > shortcut keys is on.
 */
export function resolveScreenTip(
	options: ViewerOptions,
	label: string,
	description?: string,
	shortcut?: string,
): string | undefined {
	const style = options.general.screenTipStyle;
	if (style === 'off') {
		return undefined;
	}
	let tip = label;
	if (style === 'descriptions' && description) {
		tip = `${tip}: ${description}`;
	}
	if (shortcut && options.accessibility.showShortcutKeysInScreenTips) {
		tip = `${tip} (${shortcut})`;
	}
	return tip;
}

/** Ribbon tabs after Customize Ribbon hiding; the File tab always survives. */
export function resolveVisibleRibbonTabs(
	options: ViewerOptions,
	tabs: readonly ToolbarTabDefinition[] = TOOLBAR_TABS,
): ToolbarTabDefinition[] {
	const hidden = new Set(options.ribbon.hiddenTabIds);
	hidden.delete('file');
	return tabs.filter((tab) => !hidden.has(tab.id));
}

/**
 * Seed for print dialogs when "use the following print settings" is chosen;
 * `undefined` keeps each dialog's own most-recent settings (PowerPoint's
 * "Use the most recently used print settings").
 */
export function resolveDefaultPrintSettings(
	options: ViewerOptions,
): Partial<PrintSettings> | undefined {
	if (options.advanced.printUseMostRecentSettings) {
		return undefined;
	}
	return {
		printWhat: options.advanced.printWhat,
		colorMode: options.advanced.printColorMode,
		frameSlides: options.advanced.printFrameSlides,
	};
}

/** Target raster density in ppi for image export; `undefined` = lossless/high fidelity. */
export function resolveImageResolutionPpi(preset: ImageResolutionPreset): number | undefined {
	switch (preset) {
		case 'ppi330':
			return 330;
		case 'ppi220':
			return 220;
		case 'ppi150':
			return 150;
		case 'ppi96':
			return 96;
		default:
			return undefined;
	}
}

/** Raster scale multiplier relative to the standard 96 ppi CSS pixel grid. */
export function resolveImageResolutionScale(options: ViewerOptions): number {
	if (options.advanced.doNotCompressImages) {
		return 1;
	}
	const ppi = resolveImageResolutionPpi(options.advanced.imageDefaultResolution);
	return ppi === undefined ? 1 : Math.max(0.25, Math.min(4, ppi / 96));
}

/** Whether the viewer should open documents read-only until editing is enabled. */
export function shouldOpenInProtectedView(options: ViewerOptions): boolean {
	return options.trust.openInProtectedView;
}

/** Whether following an external hyperlink should ask for confirmation first. */
export function shouldConfirmExternalHyperlink(options: ViewerOptions, href: string): boolean {
	if (!options.trust.confirmExternalHyperlinks) {
		return false;
	}
	return /^https?:/i.test(href);
}

/** CSS class list for the viewer root reflecting display-affecting options. */
export function resolveOptionRootClasses(options: ViewerOptions, prefix: string): string[] {
	const classes: string[] = [];
	if (options.accessibility.reducedMotion) {
		classes.push(`${prefix}-reduced-motion`);
	}
	if (options.advanced.disableHardwareAcceleration) {
		classes.push(`${prefix}-no-hw-accel`);
	}
	if (options.general.displayOptimization === 'compatibility') {
		classes.push(`${prefix}-compat-display`);
	}
	return classes;
}

/** Play the Accessibility > "feedback with sound" cue for a completed action. */
export function playFeedbackSound(options: ViewerOptions): void {
	if (!options.accessibility.feedbackWithSound || typeof window === 'undefined') {
		return;
	}
	const AudioContextCtor = window.AudioContext;
	if (!AudioContextCtor) {
		return;
	}
	try {
		const context = new AudioContextCtor();
		const oscillator = context.createOscillator();
		const gain = context.createGain();
		const modern = options.accessibility.soundScheme === 'modern';
		oscillator.frequency.value = modern ? 880 : 660;
		oscillator.type = modern ? 'sine' : 'square';
		gain.gain.setValueAtTime(0.04, context.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.15);
		oscillator.connect(gain).connect(context.destination);
		oscillator.start();
		oscillator.stop(context.currentTime + 0.16);
		oscillator.onended = () => {
			void context.close();
		};
	} catch {
		// Audio unavailable (autoplay policy, headless env): stay silent.
	}
}
