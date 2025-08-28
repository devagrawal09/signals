export class GraphContext {
  constructor(
    public readonly retry = () => {},
    public readonly dispose = () => {}
  ) {}

  withDispose(dispose: () => void) {
    return new GraphContext(this.retry, () => {
      this.dispose();
      dispose();
    });
  }

  withRetry(retry: () => void) {
    return new GraphContext(() => {
      retry();
      this.retry();
    }, this.dispose);
  }

  clone() {
    return new GraphContext(this.retry, this.dispose);
  }
}

let currentContext: GraphContext | undefined;

export function withContext<E>(context: GraphContext | undefined, fn: () => E) {
  const previousContext = currentContext;
  currentContext = context;
  const result = fn();
  currentContext = previousContext;
  return result;
}

export function getContext() {
  return currentContext;
}
