import { Auth, authDirectiveTypeDefs } from './Auth'
import { CacheControl, cacheControlDirectiveTypeDefs } from './CacheControl'
import { Deprecated, deprecatedDirectiveTypeDefs } from './Deprecated'
import { SanitizeDirective, sanitizeDirectiveTypeDefs } from './Sanitize'
import { SettingsDirective, settingsDirectiveTypeDefs } from './Settings'
import { SmartCacheDirective, smartCacheDirectiveTypeDefs } from './SmartCacheDirective'
import { TranslatableV2, translatableV2DirectiveTypeDefs } from './TranslatableV2'

export { parseTranslatableStringV2, formatTranslatableStringV2 } from './TranslatableV2'

export const nativeSchemaDirectives = {
  auth: Auth,
  cacheControl: CacheControl,
  deprecated: Deprecated,
  sanitize: SanitizeDirective,
  settings: SettingsDirective,
  smartcache: SmartCacheDirective,
  translatableV2: TranslatableV2,
}

export const nativeSchemaDirectivesTypeDefs = [
  authDirectiveTypeDefs,
  cacheControlDirectiveTypeDefs,
  deprecatedDirectiveTypeDefs,
  sanitizeDirectiveTypeDefs,
  settingsDirectiveTypeDefs,
  smartCacheDirectiveTypeDefs,
  translatableV2DirectiveTypeDefs,
].join('\n\n')
