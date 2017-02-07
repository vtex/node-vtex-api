import test from 'ava'
import {createServer} from 'http'
import Client from './baseClient'

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

test('HTTP client is created with no accept', t => {
  const authToken = 'authToken'
  const userAgent = 'userAgent'
  const baseURL = 'baseURL'
  const client = new Client(baseURL, {authToken, userAgent})
  t.is(client.http.defaults.baseURL, baseURL)
  t.is(client.http.defaults.headers['User-Agent'], userAgent)
  t.is(client.http.defaults.headers['Authorization'], `token ${authToken}`)
  t.is(client.http.defaults.headers['Accept'], undefined)
})

test('HTTP client is created with no baseURL', t => {
  t.throws(() => {
    new Client() // eslint-disable-line
    t.fail()
  }, 'A required argument is missing: (baseURL, {authToken, userAgent}).')
})

test('Error handler doesn\'t bork when rejection isn\'t from http response', async t => {
  const options = {
    authToken: 'token',
    userAgent: 'agent',
  }
  const client = new Client('http://undefined', options)
  try {
    await client.http('/wat')
  } catch (e) {
    if (e.name === 'TypeError') {
      t.fail()
    }
    t.pass()
  }
})

test('Client timeout fails requests', async t => {
  const hang = () => {}
  const server = createServer(hang)
  server.listen(13373)
  const timeout = 500
  const options = {
    authToken: 'token',
    userAgent: 'agent',
    timeout,
  }
  const client = new Client('http://localhost:13373', options)
  const timeoutHandle = setTimeout(() => { throw new Error() }, timeout + 100)
  try {
    await client.http('/tictoc')
  } catch (e) {
    if (e.message === `timeout of ${timeout}ms exceeded`) {
      clearTimeout(timeoutHandle)
      t.pass()
    } else {
      t.fail()
    }
  }
})
