# REST to GraphQL Migration Plan

## Goal
Migrate our REST API to GraphQL. Run both in parallel for 3 months, then deprecate REST.

## Approach
- GraphQL layer is a thin wrapper over existing service functions in src/shared/
- No database changes needed — resolvers call the same db module
- REST stays untouched during parallel period
- Clients migrate at their own pace

## Timeline
- Week 1-2: Build GraphQL schema + resolvers (done — see src/graphql/)
- Week 3-4: Internal dogfooding
- Month 2-3: Client migration window
- Month 4: Deprecate REST

## Open Questions
- Auth: REST uses session cookies, GraphQL should use Bearer tokens. How to handle the transition?
- Rate limiting: REST has per-endpoint limits. GraphQL needs query complexity analysis.
- Monitoring: Current dashboards are per-REST-endpoint. Need new GraphQL operation tracking.
