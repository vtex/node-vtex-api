import test from 'ava'
import Client from './Client'

test('HTTP client is created with all options', t => {
  const authToken = 'authToken'
  const userAgent = 'userAgent'
  const baseURL = 'baseURL'
  const accept = 'application/vnd.vtex.sppa.v4+json'
  const client = new Client(baseURL, {accept, authToken, userAgent})
  t.is(client.http.defaults.baseURL, baseURL)
  t.is(client.http.defaults.headers['User-Agent'], userAgent)
  t.is(client.http.defaults.headers['Authorization'], `token ${authToken}`)
  t.is(client.http.defaults.headers['Accept'], accept)
})
