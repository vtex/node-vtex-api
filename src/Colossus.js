/* @flow */
import {createClient, createWorkspaceURL} from './baseClient'
import type {InstanceOptions} from './baseClient'

const routes = {
  Event: (sender: string, subject: string, route: string) =>
    `/events/${sender}/${subject}/${route}`,

  Log: (sender: string, subject: string, level: string) =>
    `/logs/${sender}/${subject}/${level}`,
}

export type ColossusInstance = {
  sendLog: (sender: string, subject: string, message: {}, level: string) => any,
  sendEvent: (sender: string, subject: string, route: string, message: {}) => any,
}

export default function Colossus (opts: InstanceOptions): ColossusInstance {
  const client = createClient({...opts, baseURL: createWorkspaceURL('colossus', opts)})

  return {
    sendLog: (sender: string, subject: string, message: {}, level: string) => {
      return client.post(routes.Log(sender, subject, level), message)
    },

    sendEvent: (sender: string, subject: string, route: string, message: {}) => {
      return client.post(routes.Event(sender, subject, route), message)
    },
  }
}
