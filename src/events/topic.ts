import { createMemo, onCleanup } from "solid-js";
import { createEvent } from "./primitives.js";
import { type Emitter, type Handler } from "./handler.js";
import { halt } from "./operators.js";

export type TopicHandler<T extends Record<string, any>> = {
  <K extends keyof T, O>(
    key: [K] | (() => [K]),
    transform: (e: T[K]) => O,
  ): Handler<O>;
  <K extends keyof T>(key: [K] | (() => [K])): TopicHandler<T[K]>;

  <K1 extends keyof T, K2 extends keyof T[K1]>(
    key: [K1, K2] | (() => [K1, K2]),
  ): TopicHandler<T[K1][K2]>;
  <K1 extends keyof T, K2 extends keyof T[K1], O>(
    key: [K1, K2] | (() => [K1, K2]),
    transform: (e: T[K1][K2]) => O,
  ): Handler<O>;

  <K1 extends keyof T, K2 extends keyof T[K1], K3 extends keyof T[K1][K2], O>(
    key: [K1, K2, K3] | (() => [K1, K2, K3]),
    transform: (e: T[K1][K2][K3]) => O,
  ): Handler<O>;
  <K1 extends keyof T, K2 extends keyof T[K1], K3 extends keyof T[K1][K2]>(
    key: [K1, K2, K3] | (() => [K1, K2, K3]),
  ): TopicHandler<T[K1][K2][K3]>;

  <
    K1 extends keyof T,
    K2 extends keyof T[K1],
    K3 extends keyof T[K1][K2],
    K4 extends keyof T[K1][K2][K3],
    O,
  >(
    key: [K1, K2, K3, K4] | (() => [K1, K2, K3, K4]),
    transform: (e: T[K1][K2][K3][K4]) => O,
  ): Handler<O>;
  <
    K1 extends keyof T,
    K2 extends keyof T[K1],
    K3 extends keyof T[K1][K2],
    K4 extends keyof T[K1][K2][K3],
  >(
    key: [K1, K2, K3, K4] | (() => [K1, K2, K3, K4]),
  ): TopicHandler<T[K1][K2][K3][K4]>;
} & Handler<T>;

export type TopicEmitter<T extends Record<string, any>> = (e: T) => void;

const $EVENT = Symbol("event");
type TopicNode = {
  [$EVENT]?: [Handler<any>, Emitter<any>];
  [key: string]: TopicNode;
};

function toKeySignal(key: string[] | (() => string[])) {
  return typeof key === "function" ? key : () => key;
}

export function createTopic<T extends Record<string, any>>(
  ...sources: Handler<T>[]
) {
  const topicTree: TopicNode = {};

  const [topicEvent] = createEvent(
    ...sources.map((source) => (source(emit), halt())),
  );

  // @ts-expect-error
  const on: TopicHandler<T> = (
    _key: string[] | (() => string[]),
    transform?: (e: any) => any,
  ) => {
    const key = typeof _key === "function" ? _key : () => _key;

    if (!transform) {
      return (_k: string[] | (() => string[]), _t?: (e: any) => any) =>
        // @ts-expect-error
        on(() => [...key(), ...toKeySignal(_k)], _t);
    }

    const event = createEvent(topicEvent);

    const setupEvent = createMemo(() => {
      const keys = key();
      const node = keys.reduce((node, key) => {
        if (!node[key]) node[key] = {};
        return node[key];
      }, topicTree);

      if (!node[$EVENT]) {
        node[$EVENT] = event;
      }
      onCleanup(() => {
        node[$EVENT] = undefined;
      });
    });

    return event[0]((value) => {
      setupEvent();
      return transform(value);
    });
  };

  const emit: TopicEmitter<T> = (payload) => emitNode(topicTree, payload);

  return [on, emit] as const;
}

function emitNode(node: TopicNode, payload: any) {
  if (node[$EVENT]) {
    node[$EVENT][1](payload);
  }
  if (payload && typeof payload === "object") {
    Object.keys(payload).forEach((key) => {
      const node2 = node[key];
      if (!node2) return;
      emitNode(node2, payload[key]);
    });
  }
}
