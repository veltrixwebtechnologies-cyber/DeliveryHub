// Cancellation alone is insufficient: a response may finish just before abort.
export class RouteRequest {
  private generation = 0;
  private controller: AbortController | null = null;
  get busy() {
    return this.controller !== null;
  }
  cancel() {
    this.generation++;
    this.controller?.abort();
    this.controller = null;
  }
  async run<T>(
    fetcher: (signal: AbortSignal) => Promise<T>,
    accept: (value: T) => void,
    reject: (error: unknown) => void,
  ) {
    this.cancel();
    const generation = this.generation;
    const controller = (this.controller = new AbortController());
    try {
      const value = await fetcher(controller.signal);
      if (generation === this.generation) accept(value);
    } catch (error) {
      if (generation === this.generation) reject(error);
    } finally {
      if (generation === this.generation) this.controller = null;
    }
  }
}
