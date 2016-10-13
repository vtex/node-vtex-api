import test from 'ava'
import Client from './Client'

test('HTTP client is created with all options', t => {
  const authToken = 'authToken'
  const userAgent = 'userAgent'
  const baseURL = 'baseURL'
  const client = new Client(authToken, userAgent, baseURL)
  t.is(client.http.defaults.baseURL, baseURL)
  t.is(client.http.defaults.headers['User-Agent'], userAgent)
  t.is(client.http.defaults.headers['Authorization'], `token ${authToken}`)
})
