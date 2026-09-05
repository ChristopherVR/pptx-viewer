import type { GradientState } from 'pptx-viewer-shared';
import {
	defaultGradientState,
	gradientStopColorCommitPatch,
	PATTERN_PRESET_OPTIONS,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { ColorControlHandle, NumberFieldHandle } from '../controls';
import { makeButton, makeColorControl, makeNumberField } from '../controls';
import { createRecentColorsRow } from '../recent-colors-row';
import { createThemeColorSwatchGrid } from '../theme-color-swatch-grid';
import { makeCheckboxField, makeRangeField, makeSelectField } from './controls-extra';
import { createShapeEffectsControls } from './shape-effects-controls';
import type { InspectorHandlers, InspectorState } from './types';

/** Preset used when a shape switches into pattern-fill mode with no prior one. */
const DEFAULT_PATTERN_PRESET = 'pct20';

export interface FillSection {
	el: HTMLElement;
	update(state: InspectorState): void;
}

/** Percent-formatted readout for the opacity sliders (0..1 -> "NN%"). */
function pct(value: number): string {
	return `${Math.round(value * 100)}%`;
}

/**
 * The Fill & Stroke section: flat colour + width (as before), plus opacity
 * sliders and a gradient-fill sub-panel (2-3 stop colour + angle), reusing
 * `pptx-viewer-shared`'s gradient-picker patch builders.
 */
export function createFillSection(
	doc: Document,
	t: Translator,
	section: (label: string) => HTMLElement,
	handlers: InspectorHandlers,
): FillSection {
	const el = section(t('pptx.shape.fillStroke'));

	const fillRow = createEl(doc, 'div', 'pptxv-inspector-row');
	const fill = makeColorControl(
		doc,
		{ label: t('pptx.inspector.fill'), onInput: handlers.setShapeFill },
		'#4f86ff',
	);
	const stroke = makeColorControl(
		doc,
		{ label: t('pptx.inspector.line'), onInput: handlers.setShapeStroke },
		'#1e3a8a',
	);
	const fillLabel = createEl(doc, 'span', 'pptxv-inspector-row-label');
	fillLabel.textContent = t('pptx.inspector.fill');
	const lineLabel = createEl(doc, 'span', 'pptxv-inspector-row-label');
	lineLabel.textContent = t('pptx.inspector.line');
	fillRow.append(fillLabel, fill.el, lineLabel, stroke.el);
	el.appendChild(fillRow);

	// W3-G2: the deck's real "Theme Colors" grid, above the recent-colours
	// row. Clicking a theme swatch commits BOTH the resolved hex and the ref
	// (so the fill/stroke keeps following the theme after a later theme
	// change); every other commit path below clears the ref.
	const fillTheme = createThemeColorSwatchGrid(doc, t, (commit) =>
		handlers.setShapeFill(commit.hex, commit.ref),
	);
	el.appendChild(fillTheme.el);
	const strokeTheme = createThemeColorSwatchGrid(doc, t, (commit) =>
		handlers.setShapeStroke(commit.hex, commit.ref),
	);
	el.appendChild(strokeTheme.el);

	// B6 (A1/A2): "Recent colours" rows under the fill and stroke pickers.
	// Clicking a swatch commits through the SAME handler the picker's own
	// `<input type="color">` uses (`setShapeFill`/`setShapeStroke`), which
	// already folds the pick back into the deck's MRU list.
	const fillRecent = createRecentColorsRow(doc, t, handlers.setShapeFill);
	el.appendChild(fillRecent.el);
	const strokeRecent = createRecentColorsRow(doc, t, handlers.setShapeStroke);
	el.appendChild(strokeRecent.el);

	const strokeWidth = makeNumberField(doc, {
		label: t('pptx.ribbon.strokeWidth'),
		min: 0,
		step: 0.5,
		onCommit: handlers.setShapeStrokeWidth,
	});
	el.appendChild(strokeWidth.el);

	const fillOpacity = makeRangeField(doc, {
		label: t('pptx.strokeEffects.fillOpacity'),
		min: 0,
		max: 1,
		step: 0.01,
		formatValue: pct,
		onCommit: handlers.setFillOpacity,
	});
	el.appendChild(fillOpacity.el);
	const strokeOpacity = makeRangeField(doc, {
		label: t('pptx.strokeEffects.strokeOpacity'),
		min: 0,
		max: 1,
		step: 0.01,
		formatValue: pct,
		onCommit: handlers.setStrokeOpacity,
	});
	el.appendChild(strokeOpacity.el);

	// -- Gradient sub-panel -----------------------------------------------------
	const gradientToggle = makeCheckboxField(doc, {
		label: t('pptx.fill.gradient'),
		onChange(checked) {
			if (checked) {
				handlers.setGradientFill(lastGradient);
			} else {
				handlers.setShapeFill(fill.el.querySelector('input')?.value ?? '#4f86ff');
			}
		},
	});
	el.appendChild(gradientToggle.el);

	const gradientPanel = createEl(doc, 'div', 'pptxv-inspector-gradient');
	el.appendChild(gradientPanel);

	const typeSelectRow = createEl(doc, 'div', 'pptxv-inspector-row');
	gradientPanel.appendChild(typeSelectRow);
	const linearBtn = makeButton(doc, {
		label: t('pptx.gradient.linear'),
		text: t('pptx.gradient.linear'),
		onClick: () => handlers.setGradientFill({ ...lastGradient, type: 'linear' }),
	});
	const radialBtn = makeButton(doc, {
		label: t('pptx.gradient.radial'),
		text: t('pptx.gradient.radial'),
		onClick: () => handlers.setGradientFill({ ...lastGradient, type: 'radial' }),
	});
	typeSelectRow.append(linearBtn.btn, radialBtn.btn);

	const angleField = makeNumberField(doc, {
		label: t('pptx.gradient.angle'),
		min: 0,
		max: 360,
		onCommit: (angle) => handlers.setGradientFill({ ...lastGradient, angle }),
	});
	gradientPanel.appendChild(angleField.el);

	const stopsContainer = createEl(doc, 'div', 'pptxv-inspector-gradient-stops');
	gradientPanel.appendChild(stopsContainer);

	const addStopBtn = makeButton(doc, {
		label: t('pptx.gradient.addStop'),
		text: t('pptx.gradient.addStop'),
		onClick: () => {
			const stops = lastGradient.stops;
			const lastPos = stops[stops.length - 1]?.position ?? 100;
			const prevPos = stops[stops.length - 2]?.position ?? 0;
			handlers.addGradientStop('#ffffff', Math.round((lastPos + prevPos) / 2));
		},
	});
	gradientPanel.appendChild(addStopBtn.btn);

	// -- Pattern sub-panel --------------------------------------------------------
	// `a:pattFill`: the shape's own `fillColor` is the pattern foreground (the
	// existing Fill swatch above doubles as it, matching how the wire format
	// itself has no separate foreground field), `fillPatternBackgroundColor` is
	// the second colour, and `fillPatternPreset` picks one of the 56 presets.
	const patternToggle = makeCheckboxField(doc, {
		label: t('pptx.table.fillPattern'),
		onChange(checked) {
			if (checked) {
				handlers.setShapeStyle({
					fillMode: 'pattern',
					fillPatternPreset: lastPatternPreset,
					fillPatternBackgroundColor: lastPatternBackground,
				});
			} else {
				handlers.setShapeFill(fill.el.querySelector('input')?.value ?? '#4f86ff');
			}
		},
	});
	el.appendChild(patternToggle.el);

	const patternPanel = createEl(doc, 'div', 'pptxv-inspector-pattern');
	el.appendChild(patternPanel);

	const patternPreset = makeSelectField<string>(doc, {
		label: t('pptx.table.patternPreset'),
		options: PATTERN_PRESET_OPTIONS.map((opt) => ({ value: opt.value, label: t(opt.labelKey) })),
		onChange: (value) => {
			lastPatternPreset = value;
			handlers.setShapeStyle({ fillMode: 'pattern', fillPatternPreset: value });
		},
	});
	patternPanel.appendChild(patternPreset.el);

	const patternBackground = makeColorControl(
		doc,
		{
			label: t('pptx.table.patternBackground'),
			onInput: (hex) => {
				lastPatternBackground = hex;
				handlers.setShapeStyle({ fillMode: 'pattern', fillPatternBackgroundColor: hex });
			},
			onCommit: handlers.pushRecentColor,
		},
		'#ffffff',
	);
	patternPanel.appendChild(patternBackground.el);

	let lastPatternPreset = DEFAULT_PATTERN_PRESET;
	let lastPatternBackground = '#ffffff';

	let lastGradient: GradientState = defaultGradientState();
	let stopRows: Array<{
		color: ColorControlHandle;
		theme: ReturnType<typeof createThemeColorSwatchGrid>;
		position: NumberFieldHandle;
		remove: ReturnType<typeof makeButton>;
	}> = [];

	/**
	 * Rebuilds every stop row from scratch on each `update()` (stop count can
	 * change). Each stop gets its own "Theme Colors" grid under the native
	 * colour input, same "swatch commits hex + ref, native input clears it"
	 * contract as the fill/stroke pickers above.
	 */
	const rebuildStopRows = (
		stops: GradientState['stops'],
		themeColorMap: Record<string, string> | undefined,
		canShape: boolean,
	): void => {
		stopsContainer.replaceChildren();
		stopRows = stops.map((stop, index) => {
			const row = createEl(doc, 'div', 'pptxv-inspector-row');
			const color = makeColorControl(
				doc,
				{
					label: t('pptx.gradient.stops'),
					onInput: (hex) => handlers.updateGradientStop(index, { color: hex, colorRef: undefined }),
					onCommit: handlers.pushRecentColor,
				},
				stop.color,
			);
			const position = makeNumberField(doc, {
				label: t('pptx.gradient.position'),
				min: 0,
				max: 100,
				onCommit: (value) => handlers.updateGradientStop(index, { position: value }),
			});
			position.setValue(stop.position);
			const remove = makeButton(doc, {
				label: t('pptx.gradient.removeStop'),
				text: '✕',
				onClick: () => handlers.removeGradientStop(index),
			});
			remove.setDisabled(stops.length <= 2);
			row.append(color.el, position.el, remove.btn);
			stopsContainer.appendChild(row);
			const theme = createThemeColorSwatchGrid(doc, t, (commit) =>
				handlers.updateGradientStop(index, gradientStopColorCommitPatch(commit)),
			);
			theme.setThemeColorMap(themeColorMap);
			theme.setSelected(stop.colorRef, stop.color);
			theme.setDisabled(!canShape);
			stopsContainer.appendChild(theme.el);
			return { color, theme, position, remove };
		});
	};

	const gated = [
		fill,
		stroke,
		strokeWidth,
		fillOpacity,
		strokeOpacity,
		gradientToggle,
		patternToggle,
	];
	const gradientGated = [linearBtn, radialBtn, angleField, addStopBtn];
	const patternGated = [patternPreset, patternBackground];
	const effects = createShapeEffectsControls(doc, t, handlers);
	el.appendChild(effects.el);

	return {
		el,
		update(state) {
			el.hidden = !state.hasSelection || !state.canShape;
			fill.setValue(state.fillColor);
			stroke.setValue(state.strokeColor);
			strokeWidth.setValue(state.strokeWidth);
			fillOpacity.setValue(state.fillOpacity);
			strokeOpacity.setValue(state.strokeOpacity);
			fillTheme.setThemeColorMap(state.themeColorMap);
			fillTheme.setSelected(state.fillColorRef, state.fillColor);
			fillTheme.setDisabled(!state.canShape);
			strokeTheme.setThemeColorMap(state.themeColorMap);
			strokeTheme.setSelected(state.strokeColorRef, state.strokeColor);
			strokeTheme.setDisabled(!state.canShape);
			fillRecent.setColors(state.recentColors ?? []);
			strokeRecent.setColors(state.recentColors ?? []);
			fillRecent.setDisabled(!state.canShape);
			strokeRecent.setDisabled(!state.canShape);
			gradientToggle.setValue(state.gradientEnabled);
			angleField.setValue(state.gradient.angle);
			lastGradient = state.gradient;
			rebuildStopRows(state.gradient.stops, state.themeColorMap, state.canShape);
			gradientPanel.hidden = !state.gradientEnabled;
			effects.update(state);

			const patternEnabled = state.shapeStyle?.fillMode === 'pattern';
			patternToggle.setValue(patternEnabled);
			lastPatternPreset = state.shapeStyle?.fillPatternPreset ?? lastPatternPreset;
			lastPatternBackground = state.shapeStyle?.fillPatternBackgroundColor ?? lastPatternBackground;
			patternPreset.setValue(lastPatternPreset);
			patternBackground.setValue(lastPatternBackground);
			patternPanel.hidden = !patternEnabled;

			for (const c of gated) {
				c.setDisabled(!state.canShape);
			}
			for (const c of gradientGated) {
				c.setDisabled(!state.canShape || !state.gradientEnabled);
			}
			for (const c of patternGated) {
				c.setDisabled(!state.canShape || !patternEnabled);
			}
			for (const row of stopRows) {
				row.color.setDisabled(!state.canShape);
				row.position.setDisabled(!state.canShape);
				row.remove.setDisabled(!state.canShape || state.gradient.stops.length <= 2);
			}
		},
	};
}
