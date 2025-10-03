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

  /**
   * Update HTTP agent statistics as diagnostics metrics (gauges).
   * This method should be called periodically to export current HTTP agent state.
   */
  public static updateHttpAgentMetrics() {
    if (!global.diagnosticsMetrics) {
      console.warn('DiagnosticsMetrics not available. HTTP agent metrics not reported.')
      return
    }

    const stats = HttpAgentSingleton.httpAgentStats()
    
    // Report HTTP agent stats as gauges (current state)
    global.diagnosticsMetrics.setGauge('http_agent_sockets_current', stats.sockets, {})
    global.diagnosticsMetrics.setGauge('http_agent_free_sockets_current', stats.freeSockets, {})
    global.diagnosticsMetrics.setGauge('http_agent_pending_requests_current', stats.pendingRequests, {})
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
