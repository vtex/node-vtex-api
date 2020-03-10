import HttpAgent from 'agentkeepalive'
import { mapObjIndexed, sum, values } from 'ramda'
import { createHttpAgent } from '../../agents'

export class HttpAgentSingleton {
  public static getHttpAgent() {
    if (!this.httpAgent) {
      this.httpAgent = createHttpAgent()
    }

    return this.httpAgent
  }

  public static httpAgentStats() {
    const socketsPerOrigin = this.countPerOrigin(this.httpAgent.sockets)
    const sockets = sum(values(socketsPerOrigin))
    const freeSocketsPerOrigin = this.countPerOrigin((this.httpAgent as any).freeSockets)
    const freeSockets = sum(values(freeSocketsPerOrigin))
    const pendingRequestsPerOrigin = this.countPerOrigin(this.httpAgent.requests)
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
