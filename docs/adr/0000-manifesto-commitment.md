# ADR-0000: Commitment to the Manifesto

**Status:** accepted
**Date:** 2026-05-18
**Deciders:** Founder & Tech Lead

## Context
The Manifesto v2 establishes the product as Sovereign Engineering Intelligence,
not a coding assistant. This commitment is foundational; every later ADR
flows from it.

## Decision
- The 15 non-negotiable principles in MANIFESTO_v2.md §5 are binding.
- Principle 1 (sovereignty) cannot be relaxed by any future decision.
- Principle 15 (refuse cloud pressure) is the founder's standing commitment.
- ADR-0000 cannot be superseded.

## Consequences
Good:
- Clear north star for every architectural choice
- Customers can rely on the offline guarantee for the lifetime of the product
- No moving goalposts on what we are

Bad:
- We forgo revenue from customers who want hosted/cloud
- We must build harder for the offline path (no shortcuts)

## Alternatives considered
- Cloud-optional hybrid: REJECTED. Compromises Principle 1.
- "Cloud for some features only": REJECTED. Same problem, smaller surface.
- Open-source-only: REJECTED. Doesn't fund the engineering depth required.

## References
- docs/vision/MANIFESTO_v2.md
- docs/vision/DEV_BUILD_GUIDE_v2.md
