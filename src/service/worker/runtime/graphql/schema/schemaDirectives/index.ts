import { Auth, authDirectiveTypeDefs } from './Auth'
import { CacheControl, cacheControlDirectiveTypeDefs } from './CacheControl'
import { Deprecated, deprecatedDirectiveTypeDefs } from './Deprecated'
import { Metric, metricDirectiveTypeDefs } from './Metric'
import { Public, publicDirectiveTypeDefs } from './Public'
import { SanitizeDirective, sanitizeDirectiveTypeDefs } from './Sanitize'
import { SettingsDirective, settingsDirectiveTypeDefs } from './Settings'
import { SmartCacheDirective, smartCacheDirectiveTypeDefs } from './SmartCacheDirective'
import { TranslatableV2, translatableV2DirectiveTypeDefs } from './TranslatableV2'
import { TranslateTo, translateToDirectiveTypeDefs } from './TranslateTo'

export { parseTranslatableStringV2, formatTranslatableStringV2 } from '../../utils/translations'

export const nativeSchemaDirectives = {
  auth: Auth,
  cacheControl: CacheControl,
  deprecated: Deprecated,
  metric: Metric,
  sanitize: SanitizeDirective,
  settings: SettingsDirective,
  smartcache: SmartCacheDirective,
  translatableV2: TranslatableV2,
  translateTo: TranslateTo,
  public: Public
}

export const nativeSchemaDirectivesTypeDefs = [
  authDirectiveTypeDefs,
  cacheControlDirectiveTypeDefs,
  deprecatedDirectiveTypeDefs,
  metricDirectiveTypeDefs,
  sanitizeDirectiveTypeDefs,
  settingsDirectiveTypeDefs,
  smartCacheDirectiveTypeDefs,
  translatableV2DirectiveTypeDefs,
  translateToDirectiveTypeDefs,
  publicDirectiveTypeDefs
].join('\n\n')
