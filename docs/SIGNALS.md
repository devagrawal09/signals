# Signals API

## Overview
The Signals API provides the core reactive primitives for building reactive applications. It includes functions for creating reactive state, derived values, and side effects.

## Core Primitives

### 1. createSignal
Creates a reactive state with a getter and setter.

```typescript
const [state, setState] = createSignal<T>(initialValue, options?);
```

**Parameters:**
- `initialValue`: Initial value of the state
- `options`: Optional configuration
  - `name`: Debug name
  - `equals`: Custom equality function

**Returns:**
- `state`: Accessor function that returns current value
- `setState`: Setter function that updates the value

**Example:**
```typescript
const [count, setCount] = createSignal(0);
// Read value
console.log(count()); // 0
// Update value
setCount(count() + 1);
// Update with function
setCount(c => c + 1);
```

### 2. createMemo
Creates a derived reactive value that memoizes its computation.

```typescript
const memo = createMemo<T>(compute, initialValue?, options?);
```

**Parameters:**
- `compute`: Function that derives the value
- `initialValue`: Optional initial value
- `options`: Optional configuration
  - `name`: Debug name
  - `equals`: Custom equality function

**Returns:**
- Accessor function that returns the computed value

**Example:**
```typescript
const double = createMemo(() => count() * 2);
```

### 3. createEffect
Creates a side effect that runs after the render phase.

```typescript
createEffect<T>(compute, effect, error?, initialValue?, options?);
```

**Parameters:**
- `compute`: Function that computes the value
- `effect`: Function that performs side effects
- `error`: Optional error handler
- `initialValue`: Optional initial value
- `options`: Optional configuration
  - `name`: Debug name
  - `defer`: Whether to defer execution

**Example:**
```typescript
createEffect(
  () => count(),
  (value) => console.log("Count changed:", value)
);
```

### 4. createRenderEffect
Creates a side effect that runs during the render phase.

```typescript
createRenderEffect<T>(compute, effect, initialValue?, options?);
```

Similar to `createEffect` but runs during render phase. Used for DOM updates.

### 5. createAsync
Creates a derived reactive value that handles async operations.

```typescript
const asyncValue = createAsync<T>(compute, initialValue?, options?);
```

**Parameters:**
- `compute`: Function that returns a Promise or AsyncIterable
- `initialValue`: Optional initial value
- `options`: Optional configuration
  - `name`: Debug name
  - `equals`: Custom equality function

**Example:**
```typescript
const data = createAsync(async () => {
  const response = await fetch(url);
  return response.json();
});
```

## Utility Functions

### 1. createRoot
Creates a new reactive context with manual disposal.

```typescript
const result = createRoot<T>(init, options?);
```

**Parameters:**
- `init`: Function that creates the reactive context
- `options`: Optional configuration
  - `id`: Unique identifier

**Example:**
```typescript
createRoot((dispose) => {
  // Create reactive primitives
  return dispose; // Manual cleanup
});
```

### 2. runWithOwner
Runs a function in a specific owner context.

```typescript
const result = runWithOwner<T>(owner, run);
```

Used for moving ownership of reactive primitives.

### 3. resolve
Returns a promise that resolves with a reactive value.

```typescript
const promise = resolve<T>(fn);
```

**Example:**
```typescript
const value = await resolve(() => count());
```

## Type Definitions

### 1. Accessor
```typescript
type Accessor<T> = () => T;
```
Function that returns a reactive value.

### 2. Setter
```typescript
type Setter<T> = {
  (value: T | ((prev: T) => T)): T;
};
```
Function that updates a reactive value.

### 3. Signal
```typescript
type Signal<T> = [get: Accessor<T>, set: Setter<T>];
```
Tuple containing an accessor and setter.

## Best Practices

1. **Signal Creation**
   - Use meaningful names
   - Consider using TypeScript for type safety
   - Use appropriate equality functions

2. **Effect Management**
   - Clean up resources in effect cleanup functions
   - Use appropriate effect types (render vs regular)
   - Handle errors properly

3. **Performance**
   - Use memos for expensive computations
   - Batch related updates
   - Use appropriate equality functions

## Related Documentation
- See [QUEUE_EXECUTION_CONTROL.md](./QUEUE_EXECUTION_CONTROL.md) for details on how effects are executed
- See [QUEUE_NOTIFICATION_SYSTEM.md](./QUEUE_NOTIFICATION_SYSTEM.md) for details on state propagation
- See [BITWISE_OPERATIONS.md](./BITWISE_OPERATIONS.md) for details on state management 