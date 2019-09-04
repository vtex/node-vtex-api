import { Auth } from './Auth'
import { DinamycSmartCache } from './DinamycSmartCache'
import { SmartCacheDirective } from './SmartCacheDirective'
import { Translatable } from './Translatable'

export const nativeSchemaDirectives = {
  auth: Auth,
  dinamycsmartcache: DinamycSmartCache,
  smartcache: SmartCacheDirective,
  translatable: Translatable,
}
