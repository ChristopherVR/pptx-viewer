/**
 * Framework-agnostic formatting helpers that turn a tool name + raw JSON args
 * into a short, human-readable summary for the tool-call cards (e.g.
 * `update_text` -> "Update text"; `{ slideIndex: 2 }` -> "slide 3"). Shared by
 * every binding's chat panel so tool cards read identically across bindings.
 */

/** Turn a snake_case tool name into a Title Case label. */
export function toolLabel(toolName: string): string {
	if (!toolName) {
		return 'Tool';
	}
	const words = toolName.replace(/[_-]+/gu, ' ').trim().split(/\s+/u);
	return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
}

function formatValue(value: unknown): string {
	if (value === null || value === undefined) {
		return '';
	}
	if (typeof value === 'string') {
		return value.length > 32 ? `"${value.slice(0, 32)}..."` : `"${value}"`;
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	if (Array.isArray(value)) {
		return `[${value.length}]`;
	}
	return '{...}';
}

/** A compact `key: value` args summary, at most a few fields. */
export function summarizeToolArgs(input: unknown): string {
	if (input === null || typeof input !== 'object') {
		return '';
	}
	const entries = Object.entries(input as Record<string, unknown>).filter(
		([, v]) => v !== undefined && v !== null && v !== '',
	);
	if (entries.length === 0) {
		return '';
	}
	const parts: string[] = [];
	for (const [key, value] of entries.slice(0, 4)) {
		// Present zero-based slide/element indexes as human 1-based slide numbers.
		if (key === 'slideIndex' && typeof value === 'number') {
			parts.push(`slide ${value + 1}`);
			continue;
		}
		parts.push(`${key}: ${formatValue(value)}`);
	}
	if (entries.length > 4) {
		parts.push('...');
	}
	return parts.join(', ');
}

/**
 * A coarse icon category for a tool activity, so every binding can pick a
 * matching icon from its own icon set (React uses lucide, etc.) without the
 * shared layer depending on any icon library.
 */
export type ToolActivityIcon =
	| 'view'
	| 'text'
	| 'shape'
	| 'theme'
	| 'table'
	| 'slide'
	| 'chart'
	| 'move'
	| 'delete'
	| 'search'
	| 'nav'
	| 'animation'
	| 'notes'
	| 'tool';

/** Which tense the activity phrase should read in. */
export type ToolActivityTense = 'present' | 'past';

/** A friendly, non-technical description of one tool invocation. */
export interface ToolActivity {
	/** Icon category the binding maps to a concrete glyph. */
	icon: ToolActivityIcon;
	/** Plain-language phrase, e.g. "Looked at slide 5" / "Merged two tables". */
	label: string;
}

function asRecord(input: unknown): Record<string, unknown> {
	return input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
}

/** 1-based slide number from a tool input's `slideIndex`, if present. */
function slideNumber(input: Record<string, unknown>): number | undefined {
	const v = input.slideIndex;
	return typeof v === 'number' && Number.isFinite(v) ? v + 1 : undefined;
}

/** " on slide N" suffix, or "" when no slide is in scope. */
function onSlide(input: Record<string, unknown>): string {
	const n = slideNumber(input);
	return n === undefined ? '' : ` on slide ${n}`;
}

/** A short, quoted snippet of a free-text field (never an id). */
function snippet(value: unknown): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		return '';
	}
	const trimmed = value.trim();
	return trimmed.length > 24 ? `"${trimmed.slice(0, 24)}..."` : `"${trimmed}"`;
}

/** One tool's phrasing: an icon plus a present/past label builder. */
interface ToolPhrase {
	icon: ToolActivityIcon;
	present: (input: Record<string, unknown>) => string;
	past: (input: Record<string, unknown>) => string;
}

/**
 * Plain-language phrasing for every AI tool, keyed by canonical tool name.
 * Deliberately NEVER mentions element ids or raw argument JSON; only a slide
 * number (or a safe free-text snippet) is woven in. This is the single source
 * of truth for the friendly "activity" line every binding's chat panel shows.
 */
const TOOL_PHRASES: Record<string, ToolPhrase> = {
	// ── read ─────────────────────────────────────────────────────────────────
	get_deck_overview: {
		icon: 'view',
		present: () => 'Reviewing the deck',
		past: () => 'Reviewed the deck',
	},
	get_slide: {
		icon: 'view',
		present: (i) => `Looking at slide ${slideNumber(i) ?? ''}`.trim(),
		past: (i) => `Looked at slide ${slideNumber(i) ?? ''}`.trim(),
	},
	get_element: {
		icon: 'view',
		present: (i) => `Inspecting an element${onSlide(i)}`,
		past: (i) => `Inspected an element${onSlide(i)}`,
	},
	get_speaker_notes: {
		icon: 'notes',
		present: (i) => `Reading the notes${onSlide(i)}`,
		past: (i) => `Read the notes${onSlide(i)}`,
	},
	find_text: {
		icon: 'search',
		present: (i) => `Searching for ${snippet(i.query) || 'text'}`,
		past: (i) => `Searched for ${snippet(i.query) || 'text'}`,
	},
	get_theme: {
		icon: 'theme',
		present: () => 'Checking the theme',
		past: () => 'Checked the theme',
	},

	// ── navigation ───────────────────────────────────────────────────────────
	go_to_slide: {
		icon: 'nav',
		present: (i) => `Going to slide ${slideNumber(i) ?? ''}`.trim(),
		past: (i) => `Went to slide ${slideNumber(i) ?? ''}`.trim(),
	},
	select_elements: {
		icon: 'view',
		present: (i) => `Selecting elements${onSlide(i)}`,
		past: (i) => `Selected elements${onSlide(i)}`,
	},

	// ── MCP reads (no bespoke equivalent) ────────────────────────────────────────
	get_metadata: {
		icon: 'view',
		present: () => 'Checking the file details',
		past: () => 'Checked the file details',
	},
	get_layouts: {
		icon: 'view',
		present: () => 'Looking at the layouts',
		past: () => 'Looked at the layouts',
	},
	find_placeholders: {
		icon: 'search',
		present: () => 'Finding placeholders',
		past: () => 'Found placeholders',
	},
	get_presentation_properties: {
		icon: 'view',
		present: () => 'Checking the slideshow settings',
		past: () => 'Checked the slideshow settings',
	},
	run_accessibility_check: {
		icon: 'view',
		present: () => 'Running an accessibility check',
		past: () => 'Ran an accessibility check',
	},
	convert_to_markdown: {
		icon: 'view',
		present: () => 'Exporting to Markdown',
		past: () => 'Exported to Markdown',
	},

	// ── element editing ────────────────────────────────────────────────────────
	update_element: {
		icon: 'move',
		present: (i) => `Updating an element${onSlide(i)}`,
		past: (i) => `Updated an element${onSlide(i)}`,
	},
	update_element_style: {
		icon: 'shape',
		present: (i) => `Restyling an element${onSlide(i)}`,
		past: (i) => `Restyled an element${onSlide(i)}`,
	},
	add_element: {
		icon: 'shape',
		present: (i) => `Adding a ${typeof i.type === 'string' ? i.type : 'element'}${onSlide(i)}`,
		past: (i) => `Added a ${typeof i.type === 'string' ? i.type : 'element'}${onSlide(i)}`,
	},
	delete_elements: {
		icon: 'delete',
		present: (i) => `Deleting ${countLabel(i.elementIds, 'element')}${onSlide(i)}`,
		past: (i) => `Deleted ${countLabel(i.elementIds, 'element')}${onSlide(i)}`,
	},
	arrange_elements: {
		icon: 'move',
		present: (i) => `Rearranging elements${onSlide(i)}`,
		past: (i) => `Rearranged elements${onSlide(i)}`,
	},
	clone_element: {
		icon: 'shape',
		present: (i) => `Cloning an element${onSlide(i)}`,
		past: (i) => `Cloned an element${onSlide(i)}`,
	},
	group_elements: {
		icon: 'shape',
		present: (i) => `Grouping elements${onSlide(i)}`,
		past: (i) => `Grouped elements${onSlide(i)}`,
	},
	ungroup_elements: {
		icon: 'shape',
		present: (i) => `Ungrouping a group${onSlide(i)}`,
		past: (i) => `Ungrouped a group${onSlide(i)}`,
	},
	batch_update_elements: {
		icon: 'move',
		present: (i) => `Updating several elements${onSlide(i)}`,
		past: (i) => `Updated several elements${onSlide(i)}`,
	},
	replace_geometry: {
		icon: 'shape',
		present: (i) => `Reshaping an element${onSlide(i)}`,
		past: (i) => `Reshaped an element${onSlide(i)}`,
	},
	set_element_lock: {
		icon: 'shape',
		present: (i) => `Locking an element${onSlide(i)}`,
		past: (i) => `Locked an element${onSlide(i)}`,
	},
	manage_hyperlinks: {
		icon: 'text',
		present: (i) => `Updating a link${onSlide(i)}`,
		past: (i) => `Updated a link${onSlide(i)}`,
	},
	set_element_animation: {
		icon: 'animation',
		present: (i) => `Adding an animation${onSlide(i)}`,
		past: (i) => `Added an animation${onSlide(i)}`,
	},

	// ── text / tables / charts / smartart ────────────────────────────────────────
	replace_text: {
		icon: 'search',
		present: () => 'Replacing text across the deck',
		past: () => 'Replaced text across the deck',
	},
	manage_comments: {
		icon: 'notes',
		present: (i) => `Updating comments${onSlide(i)}`,
		past: (i) => `Updated comments${onSlide(i)}`,
	},
	update_table_cells: {
		icon: 'table',
		present: (i) => `Editing table cells${onSlide(i)}`,
		past: (i) => `Edited table cells${onSlide(i)}`,
	},
	manage_table_structure: {
		icon: 'table',
		present: (i) => `Changing a table${onSlide(i)}`,
		past: (i) => `Changed a table${onSlide(i)}`,
	},
	merge_tables: {
		icon: 'table',
		present: (i) => `Merging two tables${onSlide(i)}`,
		past: (i) => `Merged two tables${onSlide(i)}`,
	},
	create_chart: {
		icon: 'chart',
		present: (i) => `Adding a ${chartKind(i.chartType)}chart${onSlide(i)}`,
		past: (i) => `Added a ${chartKind(i.chartType)}chart${onSlide(i)}`,
	},
	update_chart: {
		icon: 'chart',
		present: (i) => `Updating a chart${onSlide(i)}`,
		past: (i) => `Updated a chart${onSlide(i)}`,
	},
	add_chart_series: {
		icon: 'chart',
		present: (i) => `Adding a chart series${onSlide(i)}`,
		past: (i) => `Added a chart series${onSlide(i)}`,
	},
	remove_chart_series: {
		icon: 'chart',
		present: (i) => `Removing a chart series${onSlide(i)}`,
		past: (i) => `Removed a chart series${onSlide(i)}`,
	},
	update_chart_series_data: {
		icon: 'chart',
		present: (i) => `Updating chart data${onSlide(i)}`,
		past: (i) => `Updated chart data${onSlide(i)}`,
	},
	manage_smart_art: {
		icon: 'shape',
		present: (i) => `Editing SmartArt${onSlide(i)}`,
		past: (i) => `Edited SmartArt${onSlide(i)}`,
	},
	apply_template: {
		icon: 'text',
		present: () => 'Filling in placeholders',
		past: () => 'Filled in placeholders',
	},

	// ── slide structure ──────────────────────────────────────────────────────────
	add_slide: {
		icon: 'slide',
		present: () => 'Adding a slide',
		past: () => 'Added a slide',
	},
	duplicate_slide: {
		icon: 'slide',
		present: (i) => `Duplicating slide ${slideNumber(i) ?? ''}`.trim(),
		past: (i) => `Duplicated slide ${slideNumber(i) ?? ''}`.trim(),
	},
	delete_slides: {
		icon: 'delete',
		present: (i) => `Deleting ${countLabel(i.slideIndexes, 'slide')}`,
		past: (i) => `Deleted ${countLabel(i.slideIndexes, 'slide')}`,
	},
	reorder_slides: {
		icon: 'slide',
		present: () => 'Reordering the slides',
		past: () => 'Reordered the slides',
	},
	update_slide_properties: {
		icon: 'slide',
		present: (i) => `Updating slide ${slideNumber(i) ?? ''}`.trim(),
		past: (i) => `Updated slide ${slideNumber(i) ?? ''}`.trim(),
	},
	set_slide_transition: {
		icon: 'animation',
		present: (i) => `Setting a transition${onSlide(i)}`,
		past: (i) => `Set a transition${onSlide(i)}`,
	},

	// ── theme (applied immediately) ──────────────────────────────────────────────
	apply_theme_preset: {
		icon: 'theme',
		present: (i) =>
			typeof i.presetName === 'string' ? `Applying the ${i.presetName} theme` : 'Applying a theme',
		past: (i) =>
			typeof i.presetName === 'string' ? `Applied the ${i.presetName} theme` : 'Applied a theme',
	},
	update_theme_colors: {
		icon: 'theme',
		present: () => 'Changing the theme colours',
		past: () => 'Changed the theme colours',
	},
	update_theme_fonts: {
		icon: 'theme',
		present: () => 'Changing the theme fonts',
		past: () => 'Changed the theme fonts',
	},

	// ── presentation-level ────────────────────────────────────────────────────────
	set_canvas_size: {
		icon: 'slide',
		present: () => 'Resizing the slides',
		past: () => 'Resized the slides',
	},
	update_metadata: {
		icon: 'tool',
		present: () => 'Updating the file details',
		past: () => 'Updated the file details',
	},
	manage_sections: {
		icon: 'slide',
		present: () => 'Organising the sections',
		past: () => 'Organised the sections',
	},
	update_presentation_properties: {
		icon: 'tool',
		present: () => 'Updating the slideshow settings',
		past: () => 'Updated the slideshow settings',
	},
	apply_layout: {
		icon: 'slide',
		present: (i) => `Applying a layout${onSlide(i)}`,
		past: (i) => `Applied a layout${onSlide(i)}`,
	},
};

/** "bar " / "" chart-kind prefix from a `chartType` input, when it is a word. */
function chartKind(value: unknown): string {
	return typeof value === 'string' && /^[a-z]+$/iu.test(value) ? `${value} ` : '';
}

/** "1 element" / "3 elements" from an array-valued input field. */
function countLabel(value: unknown, noun: string): string {
	const n = Array.isArray(value) ? value.length : 0;
	if (n <= 1) {
		return `${n || 1} ${noun}`;
	}
	return `${n} ${noun}s`;
}

/**
 * Turn a tool name + its input into a friendly, non-technical activity line for
 * the chat transcript, e.g. `get_slide` + `{ slideIndex: 4 }` -> "Looked at
 * slide 5"; `merge_tables` -> "Merged two tables". Never leaks element ids or
 * raw argument JSON; only a slide number or a safe text snippet is included.
 * Unknown tools fall back to a title-cased label.
 */
export function describeToolActivity(
	toolName: string,
	input: unknown,
	tense: ToolActivityTense = 'past',
): ToolActivity {
	const phrase = TOOL_PHRASES[toolName];
	const record = asRecord(input);
	if (!phrase) {
		return { icon: 'tool', label: toolLabel(toolName) };
	}
	return { icon: phrase.icon, label: phrase[tense](record) };
}
