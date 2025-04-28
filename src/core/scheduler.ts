import {
  EFFECT_PURE,
  EFFECT_RENDER,
  EFFECT_USER,
} from "./constants.js";

let clock = 0;
export function getClock() {
  return clock;
}
export function incrementClock(): void {
  clock++;
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  if (!globalQueue._running) queueMicrotask(flushSync);
}

export interface IQueue {
  enqueue(type: number, node: () => void): void;
  run(type: number): boolean | void;
  flush(): void;
  addChild(child: IQueue): void;
  removeChild(child: IQueue): void;
  created: number;
  notify(...args: any[]): boolean;
  _parent: IQueue | null;
}

export class Queue implements IQueue {
  _parent: IQueue | null = null;
  _running: boolean = false;
  _queues: [(() => void)[], (() => void)[], (() => void)[]] = [[], [], []];
  _children: IQueue[] = [];
  created = clock;
  enqueue(type: number, node: () => void): void {
    this._queues[0].push(node);
    if (type) this._queues[type].push(node);
    schedule();
  }
  run(type: number) {
    if (this._queues[type].length) {
      if (type === EFFECT_PURE) {
        runQueue(this._queues[type]);
        this._queues[type] = [];
      } else {
        const effects = this._queues[type];
        this._queues[type] = [];
        runQueue(effects);
      }
    }
    let rerun = false;
    for (let i = 0; i < this._children.length; i++) {
      rerun = this._children[i].run(type) || rerun;
    }
    if (type === EFFECT_PURE) return (rerun || !!this._queues[type].length);
  }
  flush() {
    if (this._running) return;
    this._running = true;
    try {
      while (this.run(EFFECT_PURE)) {}
      incrementClock();
      scheduled = false;
      this.run(EFFECT_RENDER);
      this.run(EFFECT_USER);
    } finally {
      this._running = false;
    }
  }
  addChild(child: IQueue) {
    this._children.push(child);
    child._parent = this;
  }
  removeChild(child: IQueue) {
    const index = this._children.indexOf(child);
    if (index >= 0) this._children.splice(index, 1);
  }
  notify(...args: any[]) {
    if (this._parent) return this._parent.notify(...args);
    return false;
  }
}

export const globalQueue = new Queue();

/**
 * By default, changes are batched on the microtask queue which is an async process. You can flush
 * the queue synchronously to get the latest updates by calling `flushSync()`.
 */
export function flushSync(): void {
  let count = 0;
  while (scheduled) {
    if (__DEV__ && ++count === 1e5) throw new Error("Potential Infinite Loop Detected.");
    globalQueue.flush();
  }
}

function runQueue(queue: (() => void)[]) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]();
  }
}
