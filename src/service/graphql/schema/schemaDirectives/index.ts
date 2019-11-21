import { Auth, authDirectiveTypeDefs } from './Auth'
import { CacheControl, cacheControlDirectiveTypeDefs } from './CacheControl'
import { SanitizeDirective, sanitizeDirectiveTypeDefs } from './Sanitize'
import {
  SmartCacheDirective,
  smartCacheDirectiveTypeDefs,
} from './SmartCacheDirective'
import {
  TranslatableV2,
  translatableV2DirectiveTypeDefs,
} from './TranslatableV2'

export { parseTranslatableStringV2, formatTranslatableStringV2 } from './TranslatableV2'

export const nativeSchemaDirectives = {
  auth: Auth,
  cacheControl: CacheControl,
  sanitize: SanitizeDirective,
  smartcache: SmartCacheDirective,
  translatableV2: TranslatableV2,
}

export const nativeSchemaDirectivesTypeDefs = [
  authDirectiveTypeDefs,
  cacheControlDirectiveTypeDefs,
  sanitizeDirectiveTypeDefs,
  smartCacheDirectiveTypeDefs,
  translatableV2DirectiveTypeDefs,
].join('\n\n')
