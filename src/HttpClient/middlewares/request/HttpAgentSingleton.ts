import HttpAgent from 'agentkeepalive'
import { mapObjIndexed, sum, values } from 'ramda'
import { createHttpAgent } from '../../agents'

export class HttpAgentSingleton {
  public static getHttpAgent() {
    if (!HttpAgentSingleton.httpAgent) {
      HttpAgentSingleton.httpAgent = createHttpAgent()
    }

    return HttpAgentSingleton.httpAgent
  }

  public static httpAgentStats() {
    const socketsPerOrigin = HttpAgentSingleton.countPerOrigin(HttpAgentSingleton.httpAgent.sockets)
    const sockets = sum(values(socketsPerOrigin))
    const freeSocketsPerOrigin = HttpAgentSingleton.countPerOrigin((HttpAgentSingleton.httpAgent as any).freeSockets)
    const freeSockets = sum(values(freeSocketsPerOrigin))
    const pendingRequestsPerOrigin = HttpAgentSingleton.countPerOrigin(HttpAgentSingleton.httpAgent.requests)
    const pendingRequests = sum(values(pendingRequestsPerOrigin))

    return {
      freeSockets,
      freeSocketsPerOrigin,
      pendingRequests,
      pendingRequestsPerOrigin,
      sockets,
      socketsPerOrigin,
    }
  }
  private static httpAgent: HttpAgent

  private static countPerOrigin(obj: { [key: string]: any[] }) {
    try {
      return mapObjIndexed(val => val.length, obj)
    } catch (_) {
      return {}
    }
  }
}
