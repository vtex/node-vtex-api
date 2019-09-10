import { Auth } from './Auth'
import { SmartCacheDirective } from './SmartCacheDirective'
import { Translatable } from './Translatable'
import { TranslatableV2 } from './TranslatableV2'

export const nativeSchemaDirectives = {
  auth: Auth,
  smartcache: SmartCacheDirective,
  translatable: Translatable,
  translatableV2: TranslatableV2,
}
