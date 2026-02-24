/**
 * Interface base para todos los casos de uso
 */
export interface UseCase<TInput = any, TOutput = void> {
  execute(input: TInput): Promise<TOutput>;
}
