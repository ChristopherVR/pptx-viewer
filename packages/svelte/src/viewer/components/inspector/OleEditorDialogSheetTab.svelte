<script lang="ts">
	/**
	 * OleEditorDialogSheetTab: the "sheet" content tab of `OleEditorDialog`,
	 * mirroring React's `OleSheetGridEditor` in `OleEditorDialogTabs.tsx`. Loads
	 * the Excel-payload grid on mount, and commits each cell's edit on blur
	 * through core's `applyOleSheetCellEdit` + the same `editor.applyElementPatch`
	 * path every other inspector field uses.
	 *
	 * Split out of `OleEditorDialog.svelte` to respect the 300-LOC file limit
	 * (a `.svelte` file can only default-export one component, so each content
	 * tab that React splits into a sub-component gets its own file here).
	 */
	import type { OlePptxElement, OleSheetGrid, PptxElement } from 'pptx-viewer-core';
	import { applyOleSheetCellEdit, getOleSheetGrid } from 'pptx-viewer-core';
	import { buildOleContentUpdatePatch } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';

	const {
		editor,
		el,
		onerror,
	}: {
		editor: EditorState;
		el: OlePptxElement;
		onerror: () => void;
	} = $props();
	const t = useTranslator();

	let grid = $state<OleSheetGrid | undefined>(undefined);
	let loading = $state(true);

	$effect(() => {
		let cancelled = false;
		loading = true;
		void (async (): Promise<void> => {
			const value = await getOleSheetGrid(el);
			if (!cancelled) {
				grid = value;
				loading = false;
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	async function handleCellBlur(row: number, col: number, value: string, previous: string): Promise<void> {
		if (value === previous) {
			return;
		}
		try {
			const updated = await applyOleSheetCellEdit(el, { row, col, value });
			if (updated.oleContentDirty) {
				editor.applyElementPatch(el.id, buildOleContentUpdatePatch(updated) as Partial<PptxElement>);
			}
			grid = await getOleSheetGrid(updated);
		} catch {
			onerror();
		}
	}
</script>

{#if loading}
	<p class="hint">{t('pptx.ole.editDialog.loading')}</p>
{:else if !grid || grid.rows.length === 0}
	<p class="hint">{t('pptx.ole.editDialog.emptySheet')}</p>
{:else}
	<div class="grid-wrap">
		<table>
			<tbody>
				{#each grid.rows as row, rowIndex (rowIndex)}
					<tr>
						{#each row.cells as cell, colIndex (colIndex)}
							<td>
								<input
									type="text"
									value={cell.value}
									aria-label={t('pptx.ole.editDialog.cellEditLabel')}
									onblur={(event) =>
										void handleCellBlur(rowIndex, colIndex, event.currentTarget.value, cell.value)}
								/>
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.hint {
		margin: 0;
		font-size: 11px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.grid-wrap {
		max-height: 50vh;
		overflow: auto;
		border: 1px solid var(--pptx-border, #3f3f52);
		border-radius: var(--pptx-radius, 6px);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
	}

	td {
		padding: 0;
		border: 1px solid var(--pptx-border, #3f3f52);
	}

	input {
		box-sizing: border-box;
		width: 100%;
		padding: 5px 6px;
		border: none;
		background: transparent;
		color: inherit;
		font: inherit;
	}

	input:focus {
		background: var(--pptx-accent, #33334d);
		outline: none;
	}
</style>
