<script setup lang="ts">
import type {
	AccessibilityIssue,
	AccessibilityIssueSeverity,
	AccessibilityIssueType,
} from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * AccessibilityPanel: lists accessibility issues for the current
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

const { t } = useI18n();

/** Severity groups in display order. */
const SEVERITY_GROUPS: readonly AccessibilityIssueSeverity[] = ['error', 'warning', 'tip'];

const SEVERITY_LABEL_KEYS: Record<AccessibilityIssueSeverity, string> = {
	error: 'pptx.accessibility.severityErrors',
	warning: 'pptx.accessibility.severityWarnings',
	tip: 'pptx.accessibility.severityTips',
};

const TYPE_LABEL_KEYS: Record<AccessibilityIssueType, string> = {
	missingAltText: 'pptx.accessibility.typeMissingAltText',
	missingSlideTitle: 'pptx.accessibility.typeMissingSlideTitle',
	lowContrast: 'pptx.accessibility.typeLowContrast',
	complexTable: 'pptx.accessibility.typeComplexTable',
	duplicateTitle: 'pptx.accessibility.typeDuplicateTitle',
	blankSlide: 'pptx.accessibility.typeBlankSlide',
};

interface IssueGroup {
	severity: AccessibilityIssueSeverity;
	label: string;
	issues: AccessibilityIssue[];
}

const groups = computed<IssueGroup[]>(() =>
	SEVERITY_GROUPS.map((severity) => ({
		severity,
		label: t(SEVERITY_LABEL_KEYS[severity]),
		issues: props.issues.filter((issue) => issue.severity === severity),
	})).filter((group) => group.issues.length > 0),
);

const hasIssues = computed(() => props.issues.length > 0);

function typeLabel(type: AccessibilityIssueType): string {
	return t(TYPE_LABEL_KEYS[type]);
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
	<section
		class="pptx-vue-a11y-panel flex flex-col gap-3 bg-popover p-3 text-sm text-foreground"
		:aria-label="t('pptx.accessibility.title')"
	>
		<header class="pptx-vue-a11y-panel__header flex items-center justify-between gap-2">
			<h2 class="pptx-vue-a11y-panel__title m-0 text-base font-semibold">
				{{ t('pptx.accessibility.heading') }}
			</h2>
			<span
				class="pptx-vue-a11y-panel__count min-w-6 rounded-full bg-muted px-1.5 py-px text-center text-xs font-semibold text-muted-foreground"
				>{{ issues.length }}</span
			>
		</header>

		<div v-if="!hasIssues" class="pptx-vue-a11y-panel__empty px-2 py-6 text-center text-green-400">
			<p class="pptx-vue-a11y-panel__empty-title m-0 mb-1 font-semibold">
				{{ t('pptx.accessibility.noIssuesFound') }}
			</p>
			<p class="pptx-vue-a11y-panel__empty-hint m-0 text-[0.8125rem] text-muted-foreground">
				{{ t('pptx.accessibility.noIssuesHint') }}
			</p>
		</div>

		<div v-else class="pptx-vue-a11y-panel__groups flex flex-col gap-4">
			<div
				v-for="group in groups"
				:key="group.severity"
				class="pptx-vue-a11y-group"
				:data-severity="group.severity"
			>
				<h3
					class="pptx-vue-a11y-group__label m-0 mb-1.5 flex items-center gap-1.5 text-[0.8125rem] font-semibold uppercase tracking-wide"
					:class="{
						'text-red-400': group.severity === 'error',
						'text-amber-400': group.severity === 'warning',
						'text-blue-400': group.severity === 'tip',
					}"
				>
					{{ group.label }}
					<span
						class="pptx-vue-a11y-group__count text-[0.6875rem] font-semibold text-muted-foreground"
						>{{ group.issues.length }}</span
					>
				</h3>
				<ul class="pptx-vue-a11y-group__list m-0 flex list-none flex-col gap-1.5 p-0">
					<li
						v-for="(issue, index) in group.issues"
						:key="issueKey(issue, index)"
						class="pptx-vue-a11y-issue"
						:data-severity="issue.severity"
						:data-type="issue.type"
					>
						<button
							type="button"
							class="pptx-vue-a11y-issue__button flex w-full cursor-pointer flex-col gap-0.5 rounded-md border border-l-[3px] border-border bg-muted/50 px-2.5 py-2 text-left text-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
							:class="{
								'border-l-red-500': issue.severity === 'error',
								'border-l-amber-500': issue.severity === 'warning',
								'border-l-blue-500': issue.severity === 'tip',
							}"
							@click="onSelect(issue)"
						>
							<span class="pptx-vue-a11y-issue__type font-semibold">{{
								typeLabel(issue.type)
							}}</span>
							<span class="pptx-vue-a11y-issue__message text-foreground">{{ issue.message }}</span>
							<span class="pptx-vue-a11y-issue__slide text-xs text-muted-foreground">{{
								t('pptx.notes.slideN', { n: issue.slideIndex + 1 })
							}}</span>
						</button>
					</li>
				</ul>
			</div>
		</div>
	</section>
</template>
