/**
 * UseCase interface para inventory
 */
export interface UseCase<T, R> {
  execute(data: T): Promise<R>;
}
