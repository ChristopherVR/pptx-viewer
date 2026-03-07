export interface IFactory<TResult, TInit = void> {
  create(init: TInit): TResult;
}
