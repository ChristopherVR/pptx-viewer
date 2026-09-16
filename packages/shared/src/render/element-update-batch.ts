import { cloneElement } from 'pptx-viewer-core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import type { ViewerMode } from '../types';

/** A shallow property patch for a top-level element on an ordinary slide. */
export interface ElementUpdate {
	slideId: string;
	elementId: string;
	patch: Partial<PptxElement>;
}

export interface ElementUpdateOptions {
	/** Optional description for the undo entry. */
	label?: string;
}

export interface ElementUpdateTarget {
	canEdit: boolean;
	mode: ViewerMode;
	loaded: boolean;
	editTemplateMode: boolean;
}

/** Check the editing context before any pending text or document state is touched. */
export function assertElementUpdateTarget(target: ElementUpdateTarget): void {
	if (!target.loaded || !target.canEdit || target.mode !== 'edit' || target.editTemplateMode) {
		throw new Error('Element batches require a loaded, editable ordinary slide view.');
	}
}

/** Detach caller-owned patches before a binding waits for its render to settle. */
export function cloneElementUpdates(updates: readonly ElementUpdate[]): ElementUpdate[] {
	if (!Array.isArray(updates)) {
		throw new TypeError('Element updates must be an array.');
	}
	return structuredClone(updates);
}

function validatePatch(patch: Partial<PptxElement>): void {
	if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
		throw new TypeError('An element patch must be an object.');
	}
	for (const key of ['id', 'type', '__proto__', 'constructor', 'prototype']) {
		if (Object.hasOwn(patch, key)) {
			throw new TypeError(`An element batch cannot patch ${key}.`);
		}
	}
	for (const key of ['x', 'y', 'width', 'height', 'rotation'] as const) {
		if (Object.hasOwn(patch, key)) {
			const value = patch[key];
			if (typeof value !== 'number' || !Number.isFinite(value)) {
				throw new TypeError(`Element ${key} must be a finite number.`);
			}
			if ((key === 'width' || key === 'height') && value < 0) {
				throw new RangeError(`Element ${key} cannot be negative.`);
			}
		}
	}
}

/** Property insertion order is not a document change, including inside patches. */
function comparableElement(element: PptxElement): string {
	return JSON.stringify(element, (_key, value: unknown) => {
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
		}
		return value;
	});
}

/**
 * Prepare the entire batch without mutating the document. Duplicate targets
 * apply in input order. Return null for an empty batch or no net change.
 * Nested properties follow updateElement's shallow replacement semantics.
 */
export function prepareElementUpdateBatch(
	slides: readonly PptxSlide[],
	updates: readonly ElementUpdate[],
): PptxSlide[] | null {
	const changes = new Map<number, Map<number, PptxElement>>();
	for (const update of updates) {
		if (!update || typeof update.slideId !== 'string' || typeof update.elementId !== 'string') {
			throw new TypeError('Each update requires a slideId and elementId.');
		}
		validatePatch(update.patch);
		const slideIndexes = slides.flatMap((slide, index) =>
			slide.id === update.slideId ? [index] : [],
		);
		if (slideIndexes.length !== 1) {
			throw new Error(`Slide not found or ambiguous: ${update.slideId}`);
		}
		const slideIndex = slideIndexes[0];
		const elements = slides[slideIndex].elements;
		const elementIndexes = elements.flatMap((element, index) =>
			element.id === update.elementId ? [index] : [],
		);
		if (elementIndexes.length !== 1) {
			throw new Error(`Element not found or ambiguous: ${update.slideId}/${update.elementId}`);
		}
		const elementIndex = elementIndexes[0];
		const slideChanges = changes.get(slideIndex) ?? new Map<number, PptxElement>();
		const previous = slideChanges.get(elementIndex) ?? elements[elementIndex];
		slideChanges.set(elementIndex, cloneElement({ ...previous, ...update.patch } as PptxElement));
		changes.set(slideIndex, slideChanges);
	}
	let changed = false;
	const next = slides.map((slide, index) => {
		const patches = changes.get(index);
		if (!patches) {
			return slide;
		}
		let slideChanged = false;
		const elements = slide.elements.map((element, elementIndex) => {
			const patched = patches.get(elementIndex);
			if (!patched || comparableElement(element) === comparableElement(patched)) {
				return element;
			}
			slideChanged = true;
			return patched;
		});
		if (!slideChanged) {
			return slide;
		}
		changed = true;
		return { ...slide, elements, isDirty: true };
	});
	return changed ? next : null;
}

export interface ElementUpdateHost {
	getTarget(): ElementUpdateTarget;
	hasActivePointerInteraction(): boolean;
	getSlides(): readonly PptxSlide[];
	commitPendingText(): void;
	commitSlides(slides: PptxSlide[], label?: string): void;
}

/** Synchronous commit adapter for bindings with explicit pre-edit history. */
export function commitElementUpdateBatch(
	updates: readonly ElementUpdate[],
	options: ElementUpdateOptions | undefined,
	host: ElementUpdateHost,
): void {
	const owned = cloneElementUpdates(updates);
	assertElementUpdateTarget(host.getTarget());
	// Gesture previews can write into the same slides and commit from an older
	// snapshot. Keep the entire batch outside that gesture's history boundary.
	if (host.hasActivePointerInteraction()) {
		throw new Error('Finish the current pointer interaction before updating elements.');
	}
	if (!prepareElementUpdateBatch(host.getSlides(), owned)) {
		return;
	}
	host.commitPendingText();
	const next = prepareElementUpdateBatch(host.getSlides(), owned);
	if (next) {
		host.commitSlides(next, options?.label);
	}
}
