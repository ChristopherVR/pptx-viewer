/**
 * accessibility.service.ts: Angular port of the React `useAccessibility` hook
 * and the Vue `useAccessibility` composable.
 *
 * Exposes the detected accessibility issue list and a few derived summaries as
 * signals. Heavy lifting lives in the framework-agnostic
 * `accessibility-helpers` module (which delegates to `pptx-viewer-core`); this
 * service only wires the slide / options inputs into Angular signals.
 *
 * Provide it at the component level so its lifetime tracks the host viewer:
 * `@Component({ providers: [AccessibilityService] })`.
 *
 * @module accessibility.service
 */

import { Injectable, computed, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import type { AccessibilityCheckOptions, AccessibilityIssue, PptxSlide } from 'pptx-viewer-core';

import { collectAccessibilityIssues } from './accessibility-helpers';

@Injectable()
export class AccessibilityService {
	// -------------------------------------------------------------------------
	// Inputs (writable signals fed by the host)
	// -------------------------------------------------------------------------

	/** Parsed slides of the current presentation. */
	readonly slides = signal<PptxSlide[]>([]);

	/** Check configuration mirroring {@link AccessibilityCheckOptions}. */
	readonly options = signal<AccessibilityCheckOptions>({});

	// -------------------------------------------------------------------------
	// Derived state
	// -------------------------------------------------------------------------

	/** All detected issues, sorted by slide index then severity. */
	readonly issues: Signal<AccessibilityIssue[]> = computed(() =>
		collectAccessibilityIssues(this.slides(), this.options()),
	);

	/** Total number of detected issues. */
	readonly issueCount: Signal<number> = computed(() => this.issues().length);

	/** Number of `error`-severity issues. */
	readonly errorCount: Signal<number> = computed(
		() => this.issues().filter((issue) => issue.severity === 'error').length,
	);

	/** Number of `warning`-severity issues. */
	readonly warningCount: Signal<number> = computed(
		() => this.issues().filter((issue) => issue.severity === 'warning').length,
	);

	/** Number of `tip`-severity issues. */
	readonly tipCount: Signal<number> = computed(
		() => this.issues().filter((issue) => issue.severity === 'tip').length,
	);

	/** True when the presentation passes every check. */
	readonly isClean: Signal<boolean> = computed(() => this.issueCount() === 0);

	// -------------------------------------------------------------------------
	// Setters
	// -------------------------------------------------------------------------

	/** Replace the slides to check. */
	setSlides(slides: PptxSlide[]): void {
		this.slides.set(slides);
	}

	/** Replace the check options. */
	setOptions(options: AccessibilityCheckOptions): void {
		this.options.set(options);
	}
}
