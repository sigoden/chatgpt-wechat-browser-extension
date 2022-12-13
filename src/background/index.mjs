import ExpiryMap from 'expiry-map'
import { v4 as uuidv4 } from 'uuid'
import Browser from 'webextension-polyfill'
import { fetchSSE } from './fetch-sse.mjs'

const KEY_ACCESS_TOKEN = 'accessToken'

const cache = new ExpiryMap(10 * 1000)

let conversationId = undefined
let parentMessageId = undefined

async function getAccessToken() {
  if (cache.get(KEY_ACCESS_TOKEN)) {
    return cache.get(KEY_ACCESS_TOKEN)
  }
  const resp = await fetch('https://chat.openai.com/api/auth/session')
    .then((r) => r.json())
    .catch(() => ({}))
  if (!resp.accessToken) {
    throw new Error('UNAUTHORIZED')
  }
  cache.set(KEY_ACCESS_TOKEN, resp.accessToken)
  return resp.accessToken
}

async function generateAnswers(port, question) {
  const accessToken = await getAccessToken()

  const controller = new AbortController()
  port.onDisconnect.addListener(() => {
    controller.abort()
  })

  const body = {
    action: 'next',
    messages: [
      {
        id: uuidv4(),
        role: 'user',
        content: {
          content_type: 'text',
          parts: [question],
        },
      },
    ],
    model: 'text-davinci-002-render',
    parent_message_id: parentMessageId || uuidv4(),
  }

  if (conversationId) {
    body.conversation_id = conversationId
  }

  let response = ''

  await fetchSSE('https://chat.openai.com/backend-api/conversation', {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
    onMessage(message) {
      console.debug('sse message', message)
      if (message === '[DONE]') {
        port.postMessage({ answer: response })
        return
      }
      const data = JSON.parse(message)
      if (data.conversation_id) {
        conversationId = data.conversation_id
      }
      if (data.message?.id) {
        parentMessageId = data.message.id
      }
      const text = data.message?.content?.parts?.[0]
      if (text) {
        response = text
      }
    },
  })
}

Browser.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener(async (msg) => {
    console.debug('received msg', msg)
    try {
      await generateAnswers(port, msg.question)
    } catch (err) {
      console.error(err)
      port.postMessage({ error: err.message })
      cache.delete(KEY_ACCESS_TOKEN)
    }
  })
})
