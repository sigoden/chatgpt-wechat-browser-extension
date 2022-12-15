import ExpiryMap from 'expiry-map'
import { v4 as uuidv4 } from 'uuid'
import { createParser } from 'eventsource-parser'
import Browser from 'webextension-polyfill'

const KEY_ACCESS_TOKEN = 'accessToken'

const cache = new ExpiryMap(10 * 1000)

let conversationId
let parentMessageId

async function getAccessToken() {
  if (cache.get(KEY_ACCESS_TOKEN)) {
    return cache.get(KEY_ACCESS_TOKEN)
  }
  const resp = await fetch('https://chat.openai.com/api/auth/session')
  if (!resp.ok) {
    throw new Error(`😟 Network error(${resp.status}).`)
  }
  const data = await resp.json()
  const accessToken = data?.accessToken
  if (!accessToken) {
    throw new Error('😟 Unauthorized.')
  }
  cache.set(KEY_ACCESS_TOKEN, accessToken)
  return accessToken
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
  }).catch((err) => {
    if (response) {
      throw new Error(response + '...' + err.message)
    }
    throw err
  })
}

export async function fetchSSE(resource, options) {
  const { onMessage, ...fetchOptions } = options
  const resp = await fetch(resource, fetchOptions)
  if (!resp.ok) {
    if (resp.status === 404) {
      conversationId = undefined
    } else if (resp.status === 429) {
      throw new Error(`😟 Too many requests, try again later.`)
    }
    throw new Error(`😟 Network error(${resp.status}).`)
  }
  const parser = createParser((event) => {
    if (event.type === 'event') {
      onMessage(event.data)
    }
  })
  for await (const chunk of streamAsyncIterable(resp.body)) {
    const str = new TextDecoder().decode(chunk)
    parser.feed(str)
  }
}

export async function* streamAsyncIterable(stream) {
  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        return
      }
      yield value
    }
  } finally {
    reader.releaseLock()
  }
}

Browser.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener(async (msg) => {
    console.debug('received msg', msg)
    try {
      await generateAnswers(port, msg.question)
    } catch (err) {
      console.log(err)
      port.postMessage({ error: err.message })
      cache.delete(KEY_ACCESS_TOKEN)
    }
  })
})
