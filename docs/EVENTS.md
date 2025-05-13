# Events API

## Overview

The Events API provides a powerful event-driven programming model built on top of the Signals system. It enables reactive event handling, event transformation, and event composition through a set of core primitives and operators.

## Core Concepts

### 1. Observable Pattern

The event system is built around the Observable pattern with the following key types:

```typescript
type Subscribable<T> = {
  subscribe(observer: Observer<T>): void;
  map<R = T>(fn: (observer: Observer<R>) => Observer<T>): Subscribable<R>;
  share(): Subscribable<T>;
};

type Observer<T> = {
  next(value: T): void;
  error: (error: any) => void;
  wait: () => void;
};
```

### 2. Handler and Emitter

The system provides two main interfaces for working with events:

```typescript
type Handler<E> = (<O>(transform: (e: E) => O) => Handler<O>) & {
  [$OBS]: Subscribable<E>;
};

type Emitter<E> = ((e: E) => void) & { [$OBS]: Observer<E> };
```

## Core Primitives

### 1. createEvent

Creates a new event with optional source handlers.

```typescript
function createEvent<E = any>(...sources: Handler<E>[]): [Handler<E>, Emitter<E>];
```

**Parameters:**

- `sources`: Optional array of source handlers to merge

**Returns:**

- `[Handler<E>, Emitter<E>]`: Tuple containing the handler and emitter

**Example:**

```typescript
const [handler, emitter] = createEvent();
emitter("event"); // Emit event
handler(e => console.log(e)); // Handle event
```

### 2. createAsyncEvent

Creates an event that handles asynchronous operations.

```typescript
function createAsyncEvent<I = any, E = any>(
  source: Handler<I>,
  asyncFn: (value: I) => Promise<E>
): Handler<E>;
```

**Parameters:**

- `source`: Source handler
- `asyncFn`: Async transformation function

**Example:**

```typescript
const asyncHandler = createAsyncEvent(handler, async value => await processValue(value));
```

### 3. createCycle

Creates a cycle between a handler and emitter.

```typescript
function createCycle<E>(handler: Handler<E>, cycle: Emitter<E>);
```

**Parameters:**

- `handler`: Event handler
- `cycle`: Event emitter

### 4. createSubject

Creates a reactive subject that can be updated by events.

```typescript
function createSubject<T>(
  init: () => T,
  ...events: Array<Handler<T | ((prev: T) => T)>>
): Accessor<T>;
```

**Parameters:**

- `init`: Initial value function
- `events`: Array of event handlers

### 5. createStream

Creates a stream from a signal.

```typescript
function createStream<T>(signal: () => T): Handler<T>;
```

**Parameters:**

- `signal`: Signal function

## Event Operators

### 1. throughQueue

Queues event processing.

```typescript
function throughQueue<E>(queue: (fn: Function) => void);
```

### 2. throughOwner

Manages event ownership and cleanup.

```typescript
function throughOwner();
```

### 3. throughErrorHandler

Handles errors in event processing.

```typescript
function throughErrorHandler<E>(observer: Observer<E>): Observer<E>;
```

### 4. throughRetry

Enables retry logic for event processing.

```typescript
function throughRetry<E>(observer: Observer<E>): Observer<E>;
```

### 5. transformValue

Transforms event values.

```typescript
function transformValue<T, R>(fn: (value: T) => R);
```

### 6. unwrapPromise

Handles Promise values in events.

```typescript
function unwrapPromise<E>(observer: Observer<E>): Observer<Promise<E> | E>;
```

### 7. unwrapAsyncIterator

Handles AsyncIterable values in events.

```typescript
function unwrapAsyncIterator<E>(observer: Observer<E>): Observer<AsyncIterable<E> | E>;
```

## Best Practices

1. **Event Creation**

   - Use meaningful names for events
   - Consider using TypeScript for type safety
   - Handle errors appropriately

2. **Event Composition**

   - Use operators to transform and combine events
   - Consider performance implications of event chains
   - Clean up resources properly

3. **Error Handling**

   - Implement proper error handling in event chains
   - Use throughErrorHandler for consistent error handling
   - Consider retry logic for transient failures

4. **Resource Management**
   - Use throughOwner for proper cleanup
   - Consider memory implications of long-lived event chains
   - Clean up subscriptions when no longer needed

## Related Documentation

- See [SIGNALS.md](./SIGNALS.md) for details on the underlying signal system
- See [QUEUE_EXECUTION_CONTROL.md](./QUEUE_EXECUTION_CONTROL.md) for details on event execution
- See [QUEUE_NOTIFICATION_SYSTEM.md](./QUEUE_NOTIFICATION_SYSTEM.md) for details on event propagation
