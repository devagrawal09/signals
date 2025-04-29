import {
  throughOwner,
  transformValue,
  unwrapHalt,
  throughErrorHandler,
  throughQueue,
} from "./operators.js";
import type { Observer, Subscribable } from "./core.js";
import { EagerComputation } from "../core/effect.js";
import { STATE_DIRTY } from "../core/constants.js";

const $OBS = Symbol("handler");

export type Handler<E> = (<O>(transform: (e: E) => O) => Handler<O>) & {
  [$OBS]: Subscribable<E>;
};

export function makeHandler<E>($: Subscribable<E>): Handler<E> {
  function handler<O>(transform: (e: E) => O): Handler<O> {
    const signal = new EagerComputation(undefined, () => {})

    const next = $.map(throughQueue((push) => {
      // @ts-expect-error
      signal._compute = push
      signal._notify(STATE_DIRTY)
    }))
      .map(throughOwner())
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