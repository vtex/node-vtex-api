import { Auth, authDirectiveTypeDefs } from './Auth'
import { CacheControl, cacheControlDirectiveTypeDefs } from './CacheControl'
import { Deprecated, deprecatedDirectiveTypeDefs } from './Deprecated'
import { SanitizeDirective, sanitizeDirectiveTypeDefs } from './Sanitize'
import { SettingsDirective, settingsDirectiveTypeDefs } from './Settings'
import { SmartCacheDirective, smartCacheDirectiveTypeDefs } from './SmartCacheDirective'
import { Telemetry, telemetryDirectiveTypeDefs } from './Telemetry'
import { TranslatableV2, translatableV2DirectiveTypeDefs } from './TranslatableV2'
import { TranslateTo, translateToDirectiveTypeDefs } from './TranslateTo'

export { parseTranslatableStringV2, formatTranslatableStringV2 } from '../../utils/translations'

export const nativeSchemaDirectives = {
  auth: Auth,
  cacheControl: CacheControl,
  deprecated: Deprecated,
  sanitize: SanitizeDirective,
  settings: SettingsDirective,
  smartcache: SmartCacheDirective,
  telemetry: Telemetry,
  translatableV2: TranslatableV2,
  translateTo: TranslateTo,
}

export const nativeSchemaDirectivesTypeDefs = [
  authDirectiveTypeDefs,
  cacheControlDirectiveTypeDefs,
  deprecatedDirectiveTypeDefs,
  sanitizeDirectiveTypeDefs,
  settingsDirectiveTypeDefs,
  smartCacheDirectiveTypeDefs,
  telemetryDirectiveTypeDefs,
  translatableV2DirectiveTypeDefs,
  translateToDirectiveTypeDefs,
].join('\n\n')
