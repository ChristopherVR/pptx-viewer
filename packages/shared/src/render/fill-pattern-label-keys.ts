/**
 * fill-pattern-label-keys.ts: i18n keys for the 56 `a:pattFill/@prst` presets.
 *
 * WHY here: three bindings render the pattern select straight off
 * `PATTERN_OPTIONS` (a bare string array in `table-advanced-fill.ts`), so the
 * user picked between `ltDnDiag` and `narHorz`. React kept a labelled copy in
 * its own inspector folder, which the other bindings cannot import; putting the
 * keys in shared is what lets every binding spell the same preset the same way
 * without changing which presets it offers.
 *
 * @module render/fill-pattern-label-keys
 */

/** Wire token -> i18n key for every OOXML pattern preset. */
export const FILL_PATTERN_LABEL_KEYS: Readonly<Record<string, string>> = {
	pct5: 'pptx.fillPatterns.pct5',
	pct10: 'pptx.fillPatterns.pct10',
	pct20: 'pptx.fillPatterns.pct20',
	pct25: 'pptx.fillPatterns.pct25',
	pct30: 'pptx.fillPatterns.pct30',
	pct40: 'pptx.fillPatterns.pct40',
	pct50: 'pptx.fillPatterns.pct50',
	pct60: 'pptx.fillPatterns.pct60',
	pct70: 'pptx.fillPatterns.pct70',
	pct75: 'pptx.fillPatterns.pct75',
	pct80: 'pptx.fillPatterns.pct80',
	pct90: 'pptx.fillPatterns.pct90',
	horz: 'pptx.fillPatterns.horizontal',
	vert: 'pptx.fillPatterns.vertical',
	ltHorz: 'pptx.fillPatterns.lightHorizontal',
	ltVert: 'pptx.fillPatterns.lightVertical',
	dkHorz: 'pptx.fillPatterns.darkHorizontal',
	dkVert: 'pptx.fillPatterns.darkVertical',
	narHorz: 'pptx.fillPatterns.narrowHorizontal',
	narVert: 'pptx.fillPatterns.narrowVertical',
	wdHorz: 'pptx.fillPatterns.wideHorizontal',
	wdVert: 'pptx.fillPatterns.wideVertical',
	dashHorz: 'pptx.fillPatterns.dashedHorizontal',
	dashVert: 'pptx.fillPatterns.dashedVertical',
	cross: 'pptx.fillPatterns.cross',
	dnDiag: 'pptx.fillPatterns.downDiagonal',
	upDiag: 'pptx.fillPatterns.upDiagonal',
	ltDnDiag: 'pptx.fillPatterns.lightDownDiagonal',
	ltUpDiag: 'pptx.fillPatterns.lightUpDiagonal',
	dkDnDiag: 'pptx.fillPatterns.darkDownDiagonal',
	dkUpDiag: 'pptx.fillPatterns.darkUpDiagonal',
	wdDnDiag: 'pptx.fillPatterns.wideDownDiagonal',
	wdUpDiag: 'pptx.fillPatterns.wideUpDiagonal',
	dashDnDiag: 'pptx.fillPatterns.dashedDownDiagonal',
	dashUpDiag: 'pptx.fillPatterns.dashedUpDiagonal',
	diagCross: 'pptx.fillPatterns.diagonalCross',
	smCheck: 'pptx.fillPatterns.smallCheck',
	lgCheck: 'pptx.fillPatterns.largeCheck',
	smGrid: 'pptx.fillPatterns.smallGrid',
	lgGrid: 'pptx.fillPatterns.largeGrid',
	dotGrid: 'pptx.fillPatterns.dotGrid',
	smConfetti: 'pptx.fillPatterns.smallConfetti',
	lgConfetti: 'pptx.fillPatterns.largeConfetti',
	horzBrick: 'pptx.fillPatterns.horizontalBrick',
	diagBrick: 'pptx.fillPatterns.diagonalBrick',
	solidDmnd: 'pptx.fillPatterns.solidDiamond',
	openDmnd: 'pptx.fillPatterns.openDiamond',
	dotDmnd: 'pptx.fillPatterns.dottedDiamond',
	plaid: 'pptx.fillPatterns.plaid',
	sphere: 'pptx.fillPatterns.sphere',
	weave: 'pptx.fillPatterns.weave',
	divot: 'pptx.fillPatterns.divot',
	shingle: 'pptx.fillPatterns.shingle',
	wave: 'pptx.fillPatterns.wave',
	trellis: 'pptx.fillPatterns.trellis',
	zigZag: 'pptx.fillPatterns.zigZag',
};
