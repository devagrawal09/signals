import type { Observer, Subscribable } from "./core.js";
import { throughErrorHandler, throughOwner, transformValue, unwrapHalt } from "./operators.js";

const $OBS = Symbol("handler");

export type Handler<E> = (<O>(transform: (e: E) => O) => Handler<O>) & {
  [$OBS]: Subscribable<E>;
};

export function makeHandler<E>($: Subscribable<E>): Handler<E> {
  function handler<O>(transform: (e: E) => O): Handler<O> {
    const next = $.map(throughOwner())
      .map(throughErrorHandler)
      .map(transformValue(transform))
      .map(unwrapHalt)
      .share();

    return makeHandler(next);
  }
  handler[$OBS] = $;
  return handler;
}

export function getSource<E>(handler: Handler<E>): Subscribable<E> {
  return handler[$OBS];
}

export type Emitter<E> = ((e: E) => void) & { [$OBS]: Observer<E> };

export function makeEmitter<E>($: Observer<E>): Emitter<E> {
  function emitter(e: E) {
    $.next(e);
  }
  emitter[$OBS] = $;
  return emitter;
}

export function getObserver<E>(emitter: Emitter<E>): Observer<E> {
  return emitter[$OBS];
}
