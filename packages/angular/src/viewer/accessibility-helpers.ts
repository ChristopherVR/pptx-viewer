/**
 * Thin re-export shim -> vendored `pptx-viewer-shared`.
 *
 * The pure accessibility aggregation + severity grouping were extracted to
 * `pptx-viewer-shared` (`render/accessibility-issues.ts`) and are consumed by
 * every binding. This shim preserves the historical Angular import surface so
 * the accessibility panel/service and the colocated tests are unchanged.
 */
export type { AccessibilityIssueGroup } from '../internal/shared';
export {
	SEVERITY_GROUPS,
	SEVERITY_LABELS,
	TYPE_LABELS,
	collectAccessibilityIssues,
	countAccessibilityIssues,
	groupIssuesBySeverity,
	issueTypeLabel,
	issueTrackKey,
} from '../internal/shared';
