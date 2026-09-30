/** Internal UI ABI, independent of package versions. Bump for incompatible contracts. */
const CONTRACT_REVISION = 1;
const CONTRACT_KEY = Symbol.for('pptx-viewer.web-control-contract');

type ContractConstructor = CustomElementConstructor & { [CONTRACT_KEY]?: number };

/** Preflight every tag before installing styles or defining any new controls. */
export function assertWebControlContract(
	registry: Pick<CustomElementRegistry, 'get'>,
	names: readonly string[],
): void {
	for (const name of names) {
		const ctor = registry.get(name) as ContractConstructor | undefined;
		const revision = ctor?.[CONTRACT_KEY];
		if (revision !== undefined && revision !== CONTRACT_REVISION) {
			throw new Error(
				`Incompatible ${name} contract (${revision}; expected ${CONTRACT_REVISION}). Use matching viewer bindings in this window.`,
			);
		}
	}
}

/** Only stamp implementations defined by this bundle, never unmarked legacy tags. */
export function markWebControlContract(ctor: CustomElementConstructor): void {
	Object.defineProperty(ctor, CONTRACT_KEY, { value: CONTRACT_REVISION });
}
