import { evaluatePresetShape } from './preset-shape-evaluator';

const CONNECTOR_PRESET = /^(?:bent|curved)connector[2-5]$/iu;
const PATH_TOKEN = /[MLQCZ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/giu;
const COMMAND_ARITY: Readonly<Record<string, number>> = {
	M: 2,
	L: 2,
	Q: 4,
	C: 6,
	Z: 0,
};

function formatCoordinate(value: number): string {
	return String(Number(value.toFixed(12)));
}

function flipPresetPath(
	pathData: string,
	width: number,
	height: number,
	flipH: boolean,
	flipV: boolean,
): string | undefined {
	const tokens = pathData.match(PATH_TOKEN);
	if (!tokens) {
		return undefined;
	}

	const output: string[] = [];
	let command = '';
	let coordinateIndex = 0;

	for (const token of tokens) {
		if (/^[A-Z]$/u.test(token)) {
			command = token;
			coordinateIndex = 0;
			if (!(command in COMMAND_ARITY)) {
				return undefined;
			}
			output.push(command);
			continue;
		}

		const arity = COMMAND_ARITY[command];
		if (!arity || coordinateIndex >= arity) {
			return undefined;
		}

		const value = Number(token);
		const isX = coordinateIndex % 2 === 0;
		const flipped = isX ? (flipH ? width - value : value) : flipV ? height - value : value;
		output.push(formatCoordinate(flipped));
		coordinateIndex += 1;
	}

	return output.join(' ');
}

/** Evaluate a connector from its normative OOXML preset path definition. */
export function evaluateConnectorPresetPath(
	shapeType: string,
	width: number,
	height: number,
	adjustments: Record<string, number> | undefined,
	flipH: boolean,
	flipV: boolean,
): string | undefined {
	if (!CONNECTOR_PRESET.test(shapeType)) {
		return undefined;
	}

	const pathData = evaluatePresetShape(shapeType, width, height, adjustments)?.svgPath;
	if (!pathData || (!flipH && !flipV)) {
		return pathData;
	}

	return flipPresetPath(pathData, width, height, flipH, flipV);
}
