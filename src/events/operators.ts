import { type Observer } from "./core.js";
import { withContext, getContext } from "./context.js";
import { createRoot, onCleanup } from "../index.js";

export class HaltError extends Error {
  constructor(public reason?: string) {
    super(
      reason
        ? "Event propogation halted: " + reason
        : "Event propogation halted",
    );
  }
}

export function halt(reason?: string): never {
  throw new HaltError(reason);
}

export const unwrapPromise = <E>(
  observer: Observer<E>,
): Observer<Promise<E> | E> => {

  return {
    wait: () => observer.wait(),
    next: (e) => {
      if (e instanceof Promise) {
        let aborted = false;
        onCleanup(() => (aborted = true));

        observer.wait();

        const context = getContext()?.clone();

        e.then((n) => {
          if (aborted) return;
          withContext(context, () => observer.next(n));
        }).catch((e) => {
          if (aborted) return;
          withContext(context, () => observer.error(e));
        });
        return;
      }
      observer.next(e);
    },
    error: (err) => observer.error(err),
  };
};

export const unwrapAsyncIterator = <E>(
  observer: Observer<E>,
): Observer<AsyncIterable<E> | E> => {

  return {
    wait: () => observer.wait(),
    next: (e) => {
      // @ts-ignore
      const iterator = e[Symbol.asyncIterator];
      if (iterator) {
        let aborted = false;
        onCleanup(() => (aborted = true));

        observer.wait();

        const context = getContext()?.clone();
        
        const it = e as AsyncIterable<E>;
        (async () => {
          try {
            for await (const value of it) {
              if (aborted) return;
              withContext(context, () => observer.next(value));
            }
          } catch (e) {
            if (aborted) return;
            withContext(context, () => observer.error(e));
          }
        })();
        return;
      }
      observer.next(e as E);
    },
    error: (err) => observer.error(err),
  };
};

export const throughQueue =
  <E>(queue: (fn: Function) => void) =>
  (observer: Observer<E>): Observer<E> => {
    return {
      wait: () => {
        const context = getContext()?.clone();
        queue(() => withContext(context, () => observer.wait()));
      },
      next: (e) => {
        const context = getContext()?.clone();
        queue(() => withContext(context, () => observer.next(e)));
      },
      error: (err) => {
        const context = getContext()?.clone();
        queue(() => withContext(context, () => observer.error(err)));
      },
    };
  };

export const throughOwner = () => {
  let dispose = () => {};
  onCleanup(() => dispose());

  return (observer: Observer<any>): Observer<any> => ({
    wait: () => {
      const context = getContext()?.cloneWithDispose(() => dispose());
      withContext(context, () => observer.wait());
    },
    next: (e) => {
      dispose();

      createRoot((_dispose) => {
        dispose = _dispose;
        const context = getContext()?.cloneWithDispose(() => dispose());
        withContext(context, () => observer.next(e));
      });
    },
    error: (err) => {
      const context = getContext()?.cloneWithDispose(() => dispose());
      withContext(context, () => observer.error(err));
    },
  });
};

export const throughErrorHandler = <E>(observer: Observer<E>): Observer<E> => {
  return {
    wait: () => observer.wait(),
    next: (e) => {
      try {
        observer.next(e);
      } catch (err) {
        observer.error(err);
      }
    },
    error: (err) => observer.error(err),
  };
};

export const throughRetry = <E>(observer: Observer<E>): Observer<E> => {
  return {
    wait: () => observer.wait(),
    next: (e) => {
      const context = getContext()?.cloneWithRetry(() =>
        withContext(context, () => observer.next(e)),
      );
      withContext(context, () => observer.next(e));
    },
    error: (err) => observer.error(err),
  };
};

export const unwrapHalt = <E>(observer: Observer<E>): Observer<E> => {
  return {
    wait: () => observer.wait(),
    next: (e) => observer.next(e),
    error: (err) => {
      if (err instanceof HaltError) {
        return console.info(err);
      }
      observer.error(err);
    },
  };
};

export const wrapPromise = <E>(input: Observer<Promise<E>>): Observer<E> => {
  let resolve: ((e: E) => void) | null = null;
  let reject: ((e: any) => void) | null = null;

  return {
    wait: () => {
      const promise = new Promise<E>((r, j) => ((resolve = r), (reject = j)));
      input.next(promise);
    },
    next: (e) => {
      if (resolve) {
        resolve(e);
        resolve = null;
        reject = null;
      } else {
        input.next(Promise.resolve(e));
      }
    },
    error: (e) => {
      if (reject) {
        reject(e);
        resolve = null;
        reject = null;
      } else {
        input.error(Promise.reject(e));
      }
    },
  };
};

export const transformValue = <T, R>(
  fn: (value: T) => R,
): ((observer: Observer<R>) => Observer<T>) => {
  return (observer) => ({
    wait: () => observer.wait(),
    next: (value) => observer.next(fn(value)),
    error: (err) => observer.error(err),
  });
};
