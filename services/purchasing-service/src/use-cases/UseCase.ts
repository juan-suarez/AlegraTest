export interface UseCase<TInput = any, TOutput = void> {
  execute(input: TInput): Promise<TOutput>;
}
