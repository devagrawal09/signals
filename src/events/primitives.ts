import { Observable, Subject } from "./core.js";
import {
  throughOwner,
  throughQueue,
  throughRetry,
  transformValue,
  unwrapPromise,
  unwrapHalt,
} from "./operators.js";
import {
  type Handler,
  type Emitter,
  getSource,
  getObserver,
  makeHandler,
  makeEmitter,
} from "./handler.js";
import { Computation, EagerComputation, LOADING_BIT, UNCHANGED } from "../core/index.js";
import { createStore, onCleanup, type Accessor, type Store } from "../index.js";
import { STATE_DIRTY } from "../core/constants.js";

export function createEvent<E = any>(
  ...sources: Handler<E>[]
): [Handler<E>, Emitter<E>] {
  if(sources.length === 0) {
    return [makeHandler(new Subject<E>()), makeEmitter(new Subject<E>())] as const;
  }

  const $ = new Subject<E>(sources.map((s) => {
    const signal = new EagerComputation(undefined, () => {})
    return getSource(s).map(throughQueue((_fn) => {
      // @ts-expect-error
      signal._compute = _fn
      signal._notify(STATE_DIRTY)
    }))
  }))
  return [makeHandler($), makeEmitter($)] as const;
}

export function createAsyncEvent<I = any, E = any>(
  source: Handler<I>,
  asyncFn: (value: I) => Promise<E>,
): Handler<E> {
  const signal = new EagerComputation(undefined, () => {})

  const $ = getSource(source)
    .map(throughRetry)
    .map(throughQueue((_fn) => {
      // @ts-expect-error
      signal._compute = _fn
      signal._notify(STATE_DIRTY)
    }))
    .map(throughOwner())
    .map(transformValue(asyncFn))
    .map<E>(unwrapPromise)
    .map(unwrapHalt);

  onCleanup(
    $.subscribe({
      wait: () => {},
      next: () => {},
      error: () => {},
    }),
  );

  return makeHandler($);
}

export function createCycle<E>(handler: Handler<E>, cycle: Emitter<E>) {
  const $ = getObserver(cycle);
  const signal = new EagerComputation(undefined, () => {})

  onCleanup(
    getSource(handler)
      .map(throughQueue((_fn) => {
        // @ts-expect-error
        signal._compute = _fn
        signal._notify(STATE_DIRTY)
      }))
      .subscribe({
        wait: () => $.wait?.(),
        next: (e) => $.next(e as E),
        error: (e) => $.error?.(e),
      }),
  );
}

export function createSubject<T>(
  init: () => T,
  ...events: Array<Handler<T | ((prev: T) => T)>>
): Accessor<T> {
  const signal = new Computation<T>(undefined, init);
  events.forEach((h) => onCleanup(getSource(h).subscribe({
    wait: () => signal.write(UNCHANGED, LOADING_BIT),
    next: (e) => signal.write(e),
    error: (err) => signal._setError(err),
  })))
  return signal.read.bind(signal);
}

export function createSubjectStore<T extends object = {}>(
  fn: (store: T) => void,
  source: T | Store<T>,
  ...events: Array<Handler<(store: T) => void>>
) {
  const [store, setStore] = createStore<T>(fn, source);
  events.forEach((event) => event(setStore));
  return store;
}

export function createStream<T>(signal: () => T): Handler<T> {
  const $ = new Observable<T>((observer) => {
    new EagerComputation(null, () => observer.next(signal()));
    return () => {};
  });
  return makeHandler($);
}