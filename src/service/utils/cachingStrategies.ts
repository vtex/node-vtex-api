import { SEGMENT_HEADER, SESSION_HEADER, VaryHeaders } from '../../constants'

type Scopes = 'public' | 'private' | 'segment'

export interface CachingStrategy {
  forbidden: VaryHeaders[]
  name: Scopes
  regex: RegExp
  vary: VaryHeaders[]
}

export const cachingStrategies: CachingStrategy[] = [
  {
    forbidden: [],
    name: 'private',
    regex: /^\/_v\/private\//,
    vary: [SEGMENT_HEADER, SESSION_HEADER],
  },
  {
    forbidden: [SEGMENT_HEADER, SESSION_HEADER],
    name: 'public',
    regex: /^\/_v\/public\//,
    vary: [],
  },
  {
    forbidden: [SESSION_HEADER],
    name: 'segment',
    regex: /^\/_v\/segment\//,
    vary: [SEGMENT_HEADER],
  },
]
