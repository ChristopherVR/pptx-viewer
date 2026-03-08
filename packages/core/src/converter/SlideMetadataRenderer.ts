import type { PptxSlide } from '../core';
import { TextSegmentRenderer } from './TextSegmentRenderer';

/**
 * Lightweight shape mirroring the native animation fields used during
 * markdown rendering. Avoids importing the full animation type from core.
 */
export interface NativeAnimationLike {
	/** Target element ID for the animation. */
	targetId?: string;
	/** Trigger type (e.g. `"onClick"`, `"afterPrevious"`). */
	trigger?: string;
	/** Animation preset class: `"entr"`, `"exit"`, `"emph"`, or `"path"`. */
	presetClass?: string;
	/** Numeric preset identifier within the class. */
	presetId?: number;
	/** Human-readable preset name (e.g. `"Fly In"`, `"Fade"`). */
	presetName?: string;
	/** Duration of the animation in milliseconds. */
	durationMs?: number;
	/** Delay before the animation starts in milliseconds. */
	delayMs?: number;
	/** SVG-like motion path string for path animations. */
	motionPath?: string;
	/** Rotation amount in degrees (for spin animations). */
	rotationBy?: number;
	/** Number of times the animation repeats. */
	repeatCount?: number;
	/** Whether the animation reverses after playing forward. */
	autoReverse?: boolean;
	/** Text build type (e.g. `"byParagraph"`). */
	buildType?: string;
}

/**
 * Lightweight shape mirroring slide transition fields.
 */
interface TransitionLike {
	type?: string;
	durationMs?: number;
	direction?: string;
	advanceOnClick?: boolean;
	advanceAfterMs?: number;
	soundFileName?: string;
}

/**
 * Represents a compatibility warning surfaced during slide parsing.
 */
interface CompatibilityWarningLike {
	/** Human-readable warning message. */
	message: string;
	/** Severity level of the warning. */
	severity: 'info' | 'warning';
}

/**
 * Renders slide-level metadata sections (transition, animations,
 * warnings, comments, speaker notes) into Markdown strings.
 */
export class SlideMetadataRenderer {
	public constructor(
		private readonly textRenderer: TextSegmentRenderer
	) {}

	/**
	 * Renders the slide transition effect as a short metadata line.
	 */
	public renderTransition(slide: PptxSlide): string {
		const tr = slide.transition as TransitionLike | undefined;
		if (!tr || !tr.type || tr.type === 'none') return '';

		const parts: string[] = [];
		parts.push(`**Transition:** ${tr.type}`);
		if (tr.direction) parts.push(`direction: ${tr.direction}`);
		if (typeof tr.durationMs === 'number') {
			parts.push(`${tr.durationMs}ms`);
		}
		if (tr.advanceOnClick === false) {
			parts.push('no click advance');
		}
		if (typeof tr.advanceAfterMs === 'number') {
			parts.push(`auto-advance: ${tr.advanceAfterMs}ms`);
		}
		if (tr.soundFileName) {
			parts.push(`sound: ${tr.soundFileName}`);
		}
		return `*${parts.join(' | ')}*`;
	}

	/**
	 * Renders the slide's animation effects grouped by click sequence.
	 */
	public renderAnimations(slide: PptxSlide): string {
		const native = slide.nativeAnimations as NativeAnimationLike[] | undefined;
		const legacy = slide.animations;
		const items: NativeAnimationLike[] = native?.length
			? native
			: this.mapLegacyAnimations(legacy);
		if (items.length === 0) return '';

		const clickGroups = this.groupByClickSequence(items);

		const lines: string[] = ['### Animations'];
		for (let gi = 0; gi < clickGroups.length; gi += 1) {
			const group = clickGroups[gi];
			lines.push(`- **Click ${gi + 1}:**`);
			for (const anim of group) {
				lines.push(`  - ${this.summariseAnimation(anim)}`);
			}
		}
		return lines.length > 1 ? lines.join('\n') : '';
	}

	/**
	 * Renders any compatibility warnings for the slide.
	 */
	public renderWarnings(slide: PptxSlide): string {
		const raw = slide.warnings as CompatibilityWarningLike[] | undefined;
		if (!raw || raw.length === 0) return '';
		const lines: string[] = ['### Warnings'];
		for (const w of raw) {
			const icon = w.severity === 'warning' ? '⚠️' : 'ℹ️';
			lines.push(`- ${icon} ${w.message}`);
		}
		return lines.join('\n');
	}

	/**
	 * Renders any review comments attached to the slide.
	 */
	public renderComments(slide: PptxSlide): string {
		if (!slide.comments || slide.comments.length === 0) return '';
		const lines: string[] = ['### Comments'];
		for (const comment of slide.comments) {
			const author = comment.author?.trim() || 'Unknown';
			const createdAt = comment.createdAt
				? ` (${comment.createdAt})`
				: '';
			const resolved = comment.resolved ? ' [resolved]' : '';
			lines.push(
				`- **${author}**${createdAt}: ${comment.text}${resolved}`
			);
		}
		return lines.join('\n');
	}

	/**
	 * Renders the slide's speaker notes as a Markdown blockquote.
	 */
	public renderNotes(slide: PptxSlide): string {
		const notesFromSegments = slide.notesSegments
			? this.textRenderer.render(slide.notesSegments)
			: '';
		const notesText = (notesFromSegments || slide.notes || '').trim();
		if (!notesText) return '';
		const quoted = notesText
			.split(/\r?\n/)
			.map((line) => `> ${line}`)
			.join('\n');
		return `> **Speaker Notes**\n${quoted}`;
	}

	/**
	 * Groups animations by click sequence. Each `onClick` trigger starts
	 * a new group; `withPrevious` and `afterPrevious` are appended to the
	 * current group.
	 */
	private groupByClickSequence(
		items: NativeAnimationLike[]
	): NativeAnimationLike[][] {
		const groups: NativeAnimationLike[][] = [];
		for (const item of items) {
			const trigger = item.trigger ?? 'onClick';
			if (trigger === 'onClick' || groups.length === 0) {
				groups.push([item]);
			} else {
				groups[groups.length - 1].push(item);
			}
		}
		return groups;
	}

	/**
	 * Converts legacy animation data into the NativeAnimationLike shape.
	 */
	private mapLegacyAnimations(
		legacy: PptxSlide['animations']
	): NativeAnimationLike[] {
		if (!legacy?.length) return [];
		return legacy.map((a) => {
			let presetClass: string = 'entr';
			if (a.exit) presetClass = 'exit';
			else if (a.emphasis) presetClass = 'emph';
			else if (a.motionPath) presetClass = 'path';
			return {
				trigger: a.trigger,
				presetClass,
				durationMs: a.durationMs,
				motionPath: a.motionPath,
			};
		});
	}

	/**
	 * Produces a human-readable summary of a single animation effect.
	 */
	private summariseAnimation(anim: NativeAnimationLike): string {
		const classLabels: Record<string, string> = {
			entr: 'Entrance',
			exit: 'Exit',
			emph: 'Emphasis',
			path: 'Motion Path',
		};
		const classLabel = classLabels[anim.presetClass ?? 'entr'] ?? 'Effect';

		const name = anim.presetName
			?? (anim.presetId ? `preset ${anim.presetId}` : 'effect');

		const details: string[] = [];
		if (anim.targetId) details.push(`target: ${anim.targetId}`);
		if (typeof anim.durationMs === 'number') {
			details.push(`${anim.durationMs}ms`);
		}
		if (typeof anim.delayMs === 'number' && anim.delayMs > 0) {
			details.push(`delay: ${anim.delayMs}ms`);
		}
		const trigger = anim.trigger ?? 'onClick';
		if (trigger !== 'onClick') {
			details.push(trigger.replace(/([A-Z])/g, ' $1').trim().toLowerCase());
		}
		if (typeof anim.repeatCount === 'number' && anim.repeatCount > 1) {
			details.push(`repeat: ${anim.repeatCount}x`);
		}
		if (anim.autoReverse) details.push('auto-reverse');
		if (anim.buildType) details.push(`build: ${anim.buildType}`);

		const suffix = details.length > 0 ? ` (${details.join(', ')})` : '';
		return `${classLabel}: ${name}${suffix}`;
	}
}
