import HttpAgent from 'agentkeepalive'
import { createHttpAgent } from '../../agents'

export class HttpAgentSingleton {
  public static getHttpAgent() {
    if (!HttpAgentSingleton.httpAgent) {
      HttpAgentSingleton.httpAgent = createHttpAgent()
    }

    return HttpAgentSingleton.httpAgent
  }

  public static httpAgentStats() {
    const sockets = HttpAgentSingleton.count(HttpAgentSingleton.httpAgent.sockets)
    const freeSockets = HttpAgentSingleton.count((HttpAgentSingleton.httpAgent as any).freeSockets)
    const pendingRequests = HttpAgentSingleton.count(HttpAgentSingleton.httpAgent.requests)

    return {
      freeSockets,
      pendingRequests,
      sockets,
    }
  }
  private static httpAgent: HttpAgent

  private static count(obj: { [key: string]: any[] }) {
    try {
      return Object.values(obj).reduce((acc, val) => acc += val.length, 0)
    } catch (_) {
      return 0
    }
  }
}
