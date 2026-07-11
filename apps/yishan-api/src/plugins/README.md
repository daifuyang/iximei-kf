# Plugins Folder

This folder now keeps module plugins only (`plugins/modules/**`).

Core shared plugins were moved to:

* `src/core/plugins/external`
* `src/core/plugins/app`

## Module Plugin Contract

Module plugins are discovered at startup from `src/plugins/modules/<module>`.
Adding or removing a module should not require edits in core code.

Core code must not statically import implementation files from
`src/plugins/modules/**`. If core needs optional plugin behavior, load it
dynamically and handle the plugin-missing case explicitly.

Plugin schemas are auto-registered from:

```text
src/plugins/modules/<module>/schemas/*
```

Only schema files with a default export function are registered:

```ts
export default function registerExampleSchemas(fastify) {
  fastify.addSchema(...)
}
```

Files that only export TypeBox constants or types are allowed, but they are
not auto-registered. Core schemas under `src/core/schemas` stay explicitly
registered so base API contracts remain stable and ordered.

This is startup-time hot plugging: after adding or deleting a plugin module,
restart `dev` or rebuild the API. Fastify routes and schemas are not unloaded
from a running process.

Plugins define behavior that is common to all the routes in your
application. Authentication, caching, templates, and all the other cross
cutting concerns should be handled by plugins placed in this folder.

Files in this folder are typically defined through the
[`fastify-plugin`](https://github.com/fastify/fastify-plugin) module,
making them non-encapsulated. They can define decorators and set hooks
that will then be used in the rest of your application.

Check out:

* [The hitchhiker's guide to plugins](https://fastify.dev/docs/latest/Guides/Plugins-Guide/)
* [Fastify decorators](https://fastify.dev/docs/latest/Reference/Decorators/).
* [Fastify lifecycle](https://fastify.dev/docs/latest/Reference/Lifecycle/).
