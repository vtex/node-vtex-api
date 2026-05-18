/**
 * @vtex/api-runtime — internal runtime shipped only inside service-runtime-node.
 *
 * This package is the Koa-based host that boots a consumer app written against
 * @vtex/api. Phase 3 (workstream C) carved its sources out of @vtex/api so
 * consumer-app bundles don't carry Koa/middleware bytes (SC-003).
 *
 * NOT intended for direct consumer-app use.
 */
export { startApp, appPath } from './service'
