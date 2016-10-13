/* @flow */
import axios from 'axios'

const data = ({data}) => data

export default class Client {
  http: any
  constructor (authToken: string, userAgent: string, baseURL: string) {
    const headers = {
      'Authorization': `token ${authToken}`,
      'User-Agent': userAgent,
    }
    this.http = axios.create({
      baseURL,
      headers,
    })
    this.http.interceptors.response.use(data, (err) => Promise.reject(err))
  }
}
