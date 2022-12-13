import ExpiryMap from 'expiry-map'
import { v4 as uuidv4 } from 'uuid'
import { createParser } from 'eventsource-parser'
import Browser from 'webextension-polyfill'

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
    openOrReloadChatgptTab()
    throw new Error(
      '😟 UNAUTHORIZED. The extension will open the https://chat.openai.com/chat in a new tab to refresh the login information, please try again later',
    )
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
    if (resp.status === 429) {
      conversationId = undefined
      parentMessageId = undefined
      throw new Error(`😟 Too many requests, please slow down.`)
    }
    throw new Error(`😟 Network error.`)
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

async function openOrReloadChatgptTab() {
  const url = 'https://chat.openai.com/chat'
  const tabs = await Browser.tabs.query({ url })
  if (tabs.length === 0) {
    await Browser.tabs.create({ url })
  } else {
    await Browser.tabs.reload(tabs[tabs.length - 1].id)
  }
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
