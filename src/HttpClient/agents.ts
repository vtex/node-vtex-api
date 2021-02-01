import HttpAgent, { HttpOptions as AgentHttpOptions, HttpsAgent, HttpsOptions as AgentHttpsOptions } from 'agentkeepalive'

type HttpOptions = Omit<AgentHttpOptions, 'freeSocketTimeout' | 'keepAlive' | 'maxFreeSockets'>

export const createHttpAgent = (opts?: HttpOptions) => new HttpAgent({
  ...opts,
  socketActiveTTL: 120 * 1000,
  freeSocketTimeout: 30 * 1000,
  keepAlive: true,
  maxFreeSockets: 256,
})

type HttpsOptions = Omit<AgentHttpsOptions, 'freeSocketTimeout' | 'keepAlive' | 'maxFreeSockets'>

export const createHttpsAgent = (opts?: HttpsOptions) => new HttpsAgent({
  ...opts,
  socketActiveTTL: 120 * 1000,
  freeSocketTimeout: 30 * 1000,
  keepAlive: true,
  maxFreeSockets: 256,
})
