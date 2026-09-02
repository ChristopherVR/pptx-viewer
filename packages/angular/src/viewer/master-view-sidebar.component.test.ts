/**
 * master-view-sidebar.component.test.ts: the Slide Master view sidebar's CRUD
 * button row (wave-4 B4). No Angular TestBed (see `vitest.config.ts`), so this
 * is a source-text guard, the same technique `power-point-viewer-api.test.ts`
 * uses: it pins the template wiring a DOM render would otherwise verify.
 *
 * The button row itself lives in the sub-component `MasterViewCrudRowComponent`
 * (split out to keep this file under the repo's 300-LOC cap); this file checks
 * both halves: the row's own markup, and that the sidebar wires it correctly.
 */
import { describe, expect, it } from 'vitest';

import { componentSource } from './component-source.test-support';

const sidebarSource = componentSource(import.meta.dirname, 'master-view-sidebar.component.ts');
const rowSource = componentSource(import.meta.dirname, 'master-view-crud-row.component.ts');

describe('masterViewCrudRowComponent', () => {
	it('accepts the shared crud action list and emits picked ids', () => {
		expect(rowSource).toContain('readonly actions = input<readonly MasterViewCrudAction[]>([]);');
		expect(rowSource).toContain('readonly pick = output<MasterViewCrudActionId>();');
	});

	it('renders one button per action with a stable data-testid', () => {
		expect(rowSource).toContain('[attr.data-testid]="\'pptx-master-crud-\' + action.id"');
		expect(rowSource).toContain('(click)="pick.emit(action.id)"');
	});

	it('disables the button and explains why via disabledReasonKey', () => {
		expect(rowSource).toContain('[disabled]="!action.enabled"');
		expect(rowSource).toContain(
			'action.disabledReasonKey ? (action.disabledReasonKey | translate) : null',
		);
	});
});

describe('masterViewSidebarComponent CRUD row wiring', () => {
	it('only shows the CRUD row on an editable Slides-tab selection', () => {
		expect(sidebarSource).toContain('@if (editable() && crudActions().length > 0) {');
	});

	it('passes the crud action list through and re-emits the picked id', () => {
		expect(sidebarSource).toContain('<pptx-master-view-crud-row');
		expect(sidebarSource).toContain('[actions]="crudActions()"');
		expect(sidebarSource).toContain('(pick)="crudAction.emit($event)"');
	});
});
