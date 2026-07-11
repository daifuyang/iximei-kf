# Plugin Runtime (Step 2)

This folder provides a minimal runtime skeleton for plugin manifests under `src/plugins/modules/*`.

Current responsibilities:

- Define core runtime types for manifest, lifecycle state, and hooks.
- Validate manifest shape with a lightweight TypeScript checker.
- Keep plugin state in a registry and drive transitions with a lifecycle state machine.
- Provide a minimal hook bus with priority-based execution.
- Discover module directories from a configurable modules directory.
- Load module manifests and support startup-time plugin schema discovery.
- Persist plugin metadata and runtime state into Prisma models.

Current integration in `src/app.ts` scans/registers manifests, updates runtime state,
and syncs persistence. Existing route/plugin autoload behavior is unchanged.

Schema discovery:

- Core schemas remain explicitly registered in `src/core/schemas/index.ts`.
- Plugin schemas are discovered from `src/plugins/modules/<module>/schemas/*`.
- A plugin schema file is registered only when its default export is a function
  accepting the Fastify instance.
- Core runtime code should not statically import plugin implementation files;
  deleted plugin directories must not break TypeScript compilation.
- Discovery happens during startup. Runtime unload/reload of registered
  Fastify routes or schemas is out of scope.

Persistence behavior:

- Primary path: write to `sys_plugin*` tables via Prisma.
- Fallback path: if persistence fails, runtime degrades to in-memory state and logs warnings.

Planned next steps:

- Add richer manifest constraints and error reporting.
- Add runtime events around transitions and hook emissions.
- Connect runtime state to feature toggles and controlled module enable/disable.
