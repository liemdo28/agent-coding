# SYSTEM: EXECUTION-INTELLIGENCE

Agent phải hiểu:

* TypeScript errors
* npm issues
* Docker issues
* runtime crashes
* dependency conflicts
* memory leaks

Không chỉ "đọc log". Mà phải:

* infer root cause
* estimate blast radius
* generate recovery plan

## Error Taxonomy

| Type | Meaning |
| ---- | ------- |
| BUILD_ERROR | compilation/transpilation failure |
| RUNTIME_ERROR | crash during execution |
| DEPENDENCY_ERROR | package/module conflict |
| NETWORK_ERROR | connection/timeout issue |
| STATE_ERROR | inconsistent application state |
| MEMORY_ERROR | leak/overflow/corruption |
| SECURITY_ERROR | vulnerability/breach detected |

## Recovery Protocol

1. Classify error type
2. Identify affected subsystem
3. Trace dependency chain
4. Estimate blast radius (files, modules, users affected)
5. Generate recovery plan
6. Execute with validation
7. Verify no regression
