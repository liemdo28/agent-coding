# Architectural Decision Records

Every non-trivial decision lives here.

## Format
```
docs/adr/NNNN-short-title.md
```

## Template
```
# ADR-NNNN: Title
**Status:** proposed | accepted | superseded | deprecated
**Date:** YYYY-MM-DD
**Deciders:** names
**Context:**
  Why this decision needs to be made; the constraints.
**Decision:**
  What we are doing.
**Consequences:**
  Good and bad.
**Alternatives considered:**
  What we rejected and why.
**References:**
  Links to related PRs, issues, prior art.
```

## Rules
- All cross-pillar decisions require an ADR.
- All sovereignty-affecting decisions require an ADR signed by Tech Lead + Security Lead.
- ADRs are immutable once accepted; supersede with a new ADR that references the old one.
- Read these in 5 years and you'll know why the system is the way it is.
