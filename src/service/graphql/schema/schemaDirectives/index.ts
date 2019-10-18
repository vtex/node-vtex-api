import { Auth } from './Auth'
import { SanitizeDirective } from './Sanitize'
import { SmartCacheDirective } from './SmartCacheDirective'
import { Translatable } from './Translatable'
import { TranslatableV2 } from './TranslatableV2'

export { parseTranslatableStringV2, formatTranslatableStringV2 } from './TranslatableV2'

export const nativeSchemaDirectives = {
  auth: Auth,
  sanitize: SanitizeDirective,
  smartcache: SmartCacheDirective,
  translatable: Translatable,
  translatableV2: TranslatableV2,
}
