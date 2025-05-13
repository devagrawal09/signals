import { EFFECT_PURE, EFFECT_USER } from "../core/constants.js";
import {
  Computation,
  EagerComputation,
  ERROR_BIT,
  isPending,
  LOADING_BIT,
  tryCatch,
  UNCHANGED
} from "../core/index.js";
import { getOwner } from "../core/owner.js";
import {
  createStore,
  onCleanup,
  type Accessor,
  type EffectFunction,
  type Store
} from "../index.js";
import { Observable, Subject } from "./core.js";
import {
  getObserver,
  getSource,
  makeEmitter,
  makeHandler,
  type Emitter,
  type Handler
} from "./handler.js";
import {
  notifyObserver,
  throughOwner,
  throughQueue,
  throughRetry,
  transformValue,
  unwrapHalt,
  unwrapPromise
} from "./operators.js";

export function createEvent<E = any>(...sources: Handler<E>[]): [Handler<E>, Emitter<E>] {
  if (sources.length === 0) {
    return [makeHandler(new Subject<E>()), makeEmitter(new Subject<E>())] as const;
  }

  const owner = getOwner();

  const $ = new Subject<E>(
    sources.map(s => {
      return getSource(s).map(
        throughQueue(_fn => {
          owner?._queue.enqueue(EFFECT_PURE, () => _fn());
        })
      );
    })
  );
  return [makeHandler($), makeEmitter($)] as const;
}

export function createAsyncEvent<I = any, E = any>(
  source: Handler<I>,
  asyncFn: (value: I) => Promise<E>
): Handler<E> {
  const owner = getOwner();

  const $ = getSource(source)
    .map(throughRetry)
    .map(
      throughQueue(_fn => {
        owner?._queue.enqueue(EFFECT_PURE, () => _fn());
      })
    )
    .map(throughOwner())
    .map(transformValue(asyncFn))
    .map<E>(unwrapPromise)
    .map(unwrapHalt);

  $.subscribe({
    wait: () => {},
    next: () => {},
    error: () => {}
  });

  return makeHandler($);
}

export function createCycle<E>(handler: Handler<E>, cycle: Emitter<E>) {
  const $ = getObserver(cycle);
  const owner = getOwner();

  getSource(handler)
    .map(
      throughQueue(_fn => {
        owner?._queue.enqueue(EFFECT_PURE, () => _fn());
      })
    )
    .subscribe({
      wait: () => $.wait?.(),
      next: e => $.next(e as E),
      error: e => $.error?.(e)
    });
}

export function createSubject<T>(
  init: () => T,
  ...events: Array<Handler<T | ((prev: T) => T)>>
): Accessor<T> {
  const signal = new Computation<T>(undefined, init);
  events.forEach(h =>
    getSource(h).subscribe({
      wait: () => signal.write(UNCHANGED, LOADING_BIT),
      next: e => signal.write(e),
      error: err => signal._setError(err)
    })
  );
  return signal.read.bind(signal);
}

export function createSubjectStore<T extends object = {}>(
  fn: (store: T) => void,
  source: T | Store<T>,
  ...events: Array<Handler<(store: T) => void>>
) {
  const [store, setStore] = createStore<T>(fn, source);
  events.forEach(event => event(setStore));
  return store;
}

export function createStream<T>(signal: () => T): Handler<T> {
  const $ = new Observable<T>(observer => {
    new EagerComputation(null, () => {
      if (isPending(signal, true)) {
        observer.wait();
      }
      const [error, value] = tryCatch(signal);
      if (error) {
        observer.error(error);
      } else {
        observer.next(value);
      }
    });
    return () => {};
  });
  return makeHandler($);
}

export function createEffect<T>(
  signal: () => T,
  effect: EffectFunction<T, T>,
  error?: (err: unknown) => void
) {
  const $ = new Observable<T>(observer => {
    new EagerComputation(null, () => {
      if (isPending(signal, true)) {
        observer.wait();
      }
      const [error, value] = tryCatch(signal);
      if (error) {
        observer.error(error);
      } else {
        observer.next(value);
      }
    });
    return () => {};
  });
  createListener(makeHandler($), effect, error);
}

export function createListener<E>(
  handler: Handler<E>,
  effect: EffectFunction<E, E>,
  error?: (err: unknown) => void
) {
  const owner = getOwner();
  const dummy = {};

  getSource(handler)
    .map(
      notifyObserver({
        wait: () => owner?._queue.notify(dummy, LOADING_BIT | ERROR_BIT, LOADING_BIT),
        next: () => owner?._queue.notify(dummy, LOADING_BIT | ERROR_BIT, 0),
        error: () => {
          owner?._queue.notify(dummy, LOADING_BIT, 0);
          owner?._queue.notify(dummy, ERROR_BIT, ERROR_BIT);
        }
      })
    )
    .map(
      throughQueue(_fn => {
        owner?._queue.enqueue(EFFECT_USER, () => _fn());
      })
    )
    .map(throughOwner())
    .subscribe({
      wait: () => {},
      next: e => onCleanup(effect(e as E) || (() => {})),
      error: e => error?.(e)
    });
}
