import { onCleanup } from "../core/owner.js";
import { createRoot } from "../signals.js";

export type Subscribable<T> = {
  subscribe(observer: Observer<T>): void;
  map<R = T>(fn: (observer: Observer<R>) => Observer<T>): Subscribable<R>;
  share(): Subscribable<T>;
};
export type Observer<T> = {
  next(value: T): void;
  error: (error: any) => void;
  wait: () => void;
};

export class Observable<T> implements Subscribable<T> {
  constructor(private _subscribe: (observer: Observer<T>) => void) {}

  subscribe(observer: Observer<T>) {
    this._subscribe(observer);
  }

  map<R = T>(fn: (observer: Observer<R>) => Observer<T>): Subscribable<R> {
    return new Observable(obs => this.subscribe(fn(obs)));
  }

  share(): Subscribable<T> {
    return new Subject<T>([this]);
  }
}

export class Subject<T> extends Observable<T> implements Observer<T> {
  private observers = new Set<Observer<T>>();

  private waiting = false;

  private dispose: (() => void) | undefined;

  constructor(sources?: Subscribable<T>[]) {
    super(observer => {
      this.observers.add(observer);

      if (sources?.length && !this.dispose) {
        createRoot(_dispose => {
          sources.map(source => source.subscribe(observer));
          this.dispose = _dispose;
        });
      }

      onCleanup(() => {
        this.observers.delete(observer);
        if (this.dispose && this.observers.size === 0) {
          this.dispose();
          this.dispose = undefined;
        }
      });
    });
  }

  next(value: T) {
    this.waiting = false;
    this.observers.forEach(observer => observer.next(value));
  }

  wait() {
    if (this.waiting) return;
    this.waiting = true;
    this.observers.forEach(observer => observer.wait());
  }

  error(error: any) {
    this.observers.forEach(observer => observer.error(error));
  }
}
