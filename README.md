# Agent Director Architecture

Project uses a clear split between frontend and backend layers inside `src`.

## Structure

```text
src/
  app/                         # Next.js App Router entrypoints
  frontend/
    layouts/                   # Page shells and route-level composition
    pages/                     # Screen-level page components
    components/                # Reusable UI blocks
    services/                  # Frontend data/services layer
  backend/
    modules/                   # Domain modules (controller/service split)
      health/
    shared/
      types/                   # Shared backend types
```

## Rules

1. Put route files in `src/app`, but keep screen logic in `src/frontend/pages`.
2. Keep UI-only code in `src/frontend/components`.
3. Keep data fetching and orchestration in `src/frontend/services`.
4. Build backend by modules under `src/backend/modules/*`.
