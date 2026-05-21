/**
 * Execution Fabric — Realtime Autonomous Execution Layer
 *
 * Transforms the runtime into a living engineering nervous system.
 *
 * Components:
 * - EventStreamCore: Append-log event stream (pub/sub, consumer groups)
 * - WorkerSwarm: Dynamic worker spawn/merge/split/redistribute
 * - ExecutionPressure: Dynamic load balancing and pressure response
 * - ReflexEngine: Autonomous crash recovery and stabilization
 */

export { EventStreamCore } from './EventStreamCore.js';
export { WorkerSwarm } from './WorkerSwarm.js';
export { ExecutionPressure } from './ExecutionPressure.js';
export { ReflexEngine } from './ReflexEngine.js';
