import { REACTIVE_RECOMPUTING_DEPS, REACTIVE_ZOMBIE } from "./constants.js";
import { deleteFromHeap } from "./heap.js";
import { disposeChildren } from "./owner.js";
import { dirtyQueue, zombieQueue } from "./scheduler.js";
import type { Computed, FirewallSignal, Link, Signal } from "./types.js";

// https://github.com/stackblitz/alien-signals/blob/v2.0.3/src/system.ts#L100
export function unlinkSubs(link: Link): Link | null {
  const dep = link._dep;
  const nextDep = link._nextDep;
  const nextSub = link._nextSub;
  const prevSub = link._prevSub;
  if (nextSub !== null) nextSub._prevSub = prevSub;
  else dep._subsTail = prevSub;

  if (prevSub !== null) prevSub._nextSub = nextSub;
  else dep._subs = nextSub;
  if (prevSub || nextSub) return nextDep;
  dep._unobserved?.();
  // No more subscribers, unwatch if computed
  const computed = dep as any;
  if (computed._fn && !computed._preventAutoDisposal && !(computed._flags & REACTIVE_ZOMBIE)) {
    deleteFromHeap(computed, computed._flags & REACTIVE_ZOMBIE ? zombieQueue : dirtyQueue);
    for (let dep = computed._deps; dep !== null; dep = unlinkSubs(dep)) {}
    computed._deps = null;
    disposeChildren(computed, true);
  }
  return nextDep;
}

// https://github.com/stackblitz/alien-signals/blob/v2.0.3/src/system.ts#L52
export function link(dep: Signal<any> | Computed<any>, sub: Computed<any>) {
  const prevDep = sub._depsTail;
  if (prevDep !== null && prevDep._dep === dep) return;

  const isRecomputing = sub._flags & REACTIVE_RECOMPUTING_DEPS;
  const nextDep = isRecomputing ? (prevDep !== null ? prevDep._nextDep : sub._deps) : null;
  if (nextDep !== null && nextDep._dep === dep) {
    sub._depsTail = nextDep;
    return;
  }

  const prevSub = dep._subsTail;
  if (prevSub !== null && prevSub._sub === sub && (!isRecomputing || isValidLink(prevSub, sub)))
    return;

  const newLink = {
    _dep: dep,
    _sub: sub,
    _nextDep: nextDep,
    _prevSub: prevSub,
    _nextSub: null
  };
  sub._depsTail = newLink;
  dep._subsTail = newLink;
  if (prevDep !== null) prevDep._nextDep = newLink;
  else sub._deps = newLink;

  if (prevSub !== null) prevSub._nextSub = newLink;
  else dep._subs = newLink;
}

// https://github.com/stackblitz/alien-signals/blob/v2.0.3/src/system.ts#L284
function isValidLink(checkLink: Link, sub: Computed<unknown>): boolean {
  const depsTail = sub._depsTail;
  if (depsTail === null) return false;
  for (let link = sub._deps!; link !== depsTail; link = link._nextDep!) {
    if (link === checkLink) return true;
  }
  return checkLink === depsTail;
}
