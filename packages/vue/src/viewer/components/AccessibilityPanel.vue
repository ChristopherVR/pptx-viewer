<script setup lang="ts">
import type {
	AccessibilityIssue,
	AccessibilityIssueSeverity,
	AccessibilityIssueType,
} from 'pptx-viewer-core';
import { computed } from 'vue';

/**
 * AccessibilityPanel — lists accessibility issues for the current
 * presentation, grouped by severity (errors first, then warnings, then tips).
 *
 * Each issue shows a human-readable type label, its message, and which slide
 * it lives on. Clicking an issue emits `select-slide` with the issue's
 * zero-based slide index so the host editor can jump to that slide. When there
 * are no issues a clean empty state is shown instead.
 *
 * Purely presentational: the caller supplies the already-computed issue list
 * (see the `useAccessibility` composable).
 */
const props = defineProps<{
	issues: AccessibilityIssue[];
}>();

const emit = defineEmits<{
	'select-slide': [index: number];
}>();

/** Severity groups in display order. */
const SEVERITY_GROUPS: readonly AccessibilityIssueSeverity[] = ['error', 'warning', 'tip'];

const SEVERITY_LABELS: Record<AccessibilityIssueSeverity, string> = {
	error: 'Errors',
	warning: 'Warnings',
	tip: 'Tips',
};

const TYPE_LABELS: Record<AccessibilityIssueType, string> = {
	missingAltText: 'Missing alt text',
	missingSlideTitle: 'Missing slide title',
	lowContrast: 'Low contrast',
	complexTable: 'Complex table',
	duplicateTitle: 'Duplicate title',
	blankSlide: 'Blank slide',
};

interface IssueGroup {
	severity: AccessibilityIssueSeverity;
	label: string;
	issues: AccessibilityIssue[];
}

const groups = computed<IssueGroup[]>(() =>
	SEVERITY_GROUPS.map((severity) => ({
		severity,
		label: SEVERITY_LABELS[severity],
		issues: props.issues.filter((issue) => issue.severity === severity),
	})).filter((group) => group.issues.length > 0),
);

const hasIssues = computed(() => props.issues.length > 0);

function typeLabel(type: AccessibilityIssueType): string {
	return TYPE_LABELS[type];
}

/** Stable-ish key for v-for; issues have no id of their own. */
function issueKey(issue: AccessibilityIssue, index: number): string {
	return `${issue.slideIndex}-${issue.type}-${issue.elementId ?? 'slide'}-${index}`;
}

function onSelect(issue: AccessibilityIssue): void {
	emit('select-slide', issue.slideIndex);
}
</script>

<template>
	<section class="pptx-vue-a11y-panel" aria-label="Accessibility checker">
		<header class="pptx-vue-a11y-panel__header">
			<h2 class="pptx-vue-a11y-panel__title">Accessibility</h2>
			<span class="pptx-vue-a11y-panel__count">{{ issues.length }}</span>
		</header>

		<div v-if="!hasIssues" class="pptx-vue-a11y-panel__empty">
			<p class="pptx-vue-a11y-panel__empty-title">No issues found</p>
			<p class="pptx-vue-a11y-panel__empty-hint">
				This presentation passes all accessibility checks.
			</p>
		</div>

		<div v-else class="pptx-vue-a11y-panel__groups">
			<div
				v-for="group in groups"
				:key="group.severity"
				class="pptx-vue-a11y-group"
				:data-severity="group.severity"
			>
				<h3 class="pptx-vue-a11y-group__label">
					{{ group.label }}
					<span class="pptx-vue-a11y-group__count">{{ group.issues.length }}</span>
				</h3>
				<ul class="pptx-vue-a11y-group__list">
					<li
						v-for="(issue, index) in group.issues"
						:key="issueKey(issue, index)"
						class="pptx-vue-a11y-issue"
						:data-severity="issue.severity"
						:data-type="issue.type"
					>
						<button type="button" class="pptx-vue-a11y-issue__button" @click="onSelect(issue)">
							<span class="pptx-vue-a11y-issue__type">{{ typeLabel(issue.type) }}</span>
							<span class="pptx-vue-a11y-issue__message">{{ issue.message }}</span>
							<span class="pptx-vue-a11y-issue__slide">Slide {{ issue.slideIndex + 1 }}</span>
						</button>
					</li>
				</ul>
			</div>
		</div>
	</section>
</template>

<style scoped>
.pptx-vue-a11y-panel {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	padding: 0.75rem;
	font-family: system-ui, sans-serif;
	font-size: 0.875rem;
	color: #1f2937;
	background: #ffffff;
}

.pptx-vue-a11y-panel__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem;
}

.pptx-vue-a11y-panel__title {
	margin: 0;
	font-size: 1rem;
	font-weight: 600;
}

.pptx-vue-a11y-panel__count {
	min-width: 1.5rem;
	padding: 0.05rem 0.4rem;
	text-align: center;
	font-size: 0.75rem;
	font-weight: 600;
	color: #374151;
	background: #e5e7eb;
	border-radius: 999px;
}

.pptx-vue-a11y-panel__empty {
	padding: 1.5rem 0.5rem;
	text-align: center;
	color: #047857;
}

.pptx-vue-a11y-panel__empty-title {
	margin: 0 0 0.25rem;
	font-weight: 600;
}

.pptx-vue-a11y-panel__empty-hint {
	margin: 0;
	font-size: 0.8125rem;
	color: #6b7280;
}

.pptx-vue-a11y-panel__groups {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.pptx-vue-a11y-group__label {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	margin: 0 0 0.4rem;
	font-size: 0.8125rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.03em;
}

.pptx-vue-a11y-group[data-severity='error'] .pptx-vue-a11y-group__label {
	color: #b91c1c;
}

.pptx-vue-a11y-group[data-severity='warning'] .pptx-vue-a11y-group__label {
	color: #b45309;
}

.pptx-vue-a11y-group[data-severity='tip'] .pptx-vue-a11y-group__label {
	color: #1d4ed8;
}

.pptx-vue-a11y-group__count {
	font-size: 0.6875rem;
	font-weight: 600;
	color: #6b7280;
}

.pptx-vue-a11y-group__list {
	display: flex;
	flex-direction: column;
	gap: 0.4rem;
	margin: 0;
	padding: 0;
	list-style: none;
}

.pptx-vue-a11y-issue__button {
	display: flex;
	flex-direction: column;
	gap: 0.15rem;
	width: 100%;
	padding: 0.5rem 0.625rem;
	text-align: left;
	color: inherit;
	background: #f9fafb;
	border: 1px solid #e5e7eb;
	border-left-width: 3px;
	border-radius: 0.375rem;
	cursor: pointer;
}

.pptx-vue-a11y-issue__button:hover {
	background: #f3f4f6;
}

.pptx-vue-a11y-issue__button:focus-visible {
	outline: 2px solid #2563eb;
	outline-offset: 1px;
}

.pptx-vue-a11y-issue[data-severity='error'] .pptx-vue-a11y-issue__button {
	border-left-color: #dc2626;
}

.pptx-vue-a11y-issue[data-severity='warning'] .pptx-vue-a11y-issue__button {
	border-left-color: #d97706;
}

.pptx-vue-a11y-issue[data-severity='tip'] .pptx-vue-a11y-issue__button {
	border-left-color: #2563eb;
}

.pptx-vue-a11y-issue__type {
	font-weight: 600;
}

.pptx-vue-a11y-issue__message {
	color: #374151;
}

.pptx-vue-a11y-issue__slide {
	font-size: 0.75rem;
	color: #6b7280;
}
</style>
