// perf/index.js - Local Performance Profiler module

export {
  runPerformanceProfile,
  measureBuildPerformance,
  measureTestPerformance,
  measureStartupTime,
  estimateBundleSize,
  findSlowFiles,
  analyzeDependencies,
} from './PerformanceProfiler.js';