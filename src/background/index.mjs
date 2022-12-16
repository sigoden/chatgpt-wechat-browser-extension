import ExpiryMap from 'expiry-map'
import { v4 as uuidv4 } from 'uuid'
import { createParser } from 'eventsource-parser'
import Browser from 'webextension-polyfill'

const KEY_ACCESS_TOKEN = 'accessToken'

const cache = new ExpiryMap(10 * 1000)

let tabId
let conversationId
let parentMessageId
let hasError = false
let wechatPort
let googleAuthFail = false

Browser.runtime.onConnect.addListener((port) => {
  wechatPort = port
  wechatPort.onMessage.addListener(async (msg) => {
    console.debug('question:', msg.question)
    try {
      await generateAnswers(msg.question)
      hasError = false
    } catch (err) {
      console.log(err)
      hasError = true
      wechatPort.postMessage({ error: err.message })
      cache.delete(KEY_ACCESS_TOKEN)
    }
  })
})

Browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.debug('recvieve message', message)

  if (message.type === 'page') {
    if (sender.tab?.id === tabId) {
      if (googleAuthFail && !message.page.startsWith('https://chat.openai.com/chat')) {
        sendResponse({ ok: false })
      } else {
        sendResponse({ ok: true })
      }
    } else {
      sendResponse({ ok: false })
    }
  } else if (message.type === 'google-auth-fail') {
    googleAuthFail = true
    Browser.tabs.remove(tabId).catch(() => {})
  } else if (message.type === 'enter-chat') {
    googleAuthFail = false
    if (wechatPort && hasError) wechatPort.postMessage({ answer: '🙂 Session established' })
  }
})

async function getAccessToken() {
  if (cache.get(KEY_ACCESS_TOKEN)) {
    return cache.get(KEY_ACCESS_TOKEN)
  }
  const resp = await fetch('https://chat.openai.com/api/auth/session')
  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) {
      refreshLogin()
      throw new Error(`😟 Session lost.`)
    }
    throw new Error(`😟 Network error(${resp.status}).`)
  }
  const data = await resp.json()
  if (!data?.accessToken || data?.error === 'RefreshAccessTokenError') {
    refreshLogin()
    throw new Error(`😟 Session lost.`)
  }
  cache.set(KEY_ACCESS_TOKEN, data.accessToken)
  return data.accessToken
}

async function refreshLogin() {
  if (tabId) {
    try {
      let tab = await Browser.tabs.get(tabId)
      if (!tab?.url.startsWith('https://chat.openai.com/chat')) {
        console.debug('tab was occupied')
        tabId = null
      }
    } catch {
      console.debug('tab was closed')
      tabId = null
    }
  }
  if (!tabId) {
    const tab = await Browser.tabs.create({ url: 'https://chat.openai.com/chat', active: false })
    tabId = tab.id
  } else {
    await Browser.tabs.reload(tabId)
  }
}

async function generateAnswers(question) {
  const accessToken = await getAccessToken()

  const controller = new AbortController()
  wechatPort.onDisconnect.addListener(() => {
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
      if (message === '[DONE]') {
        console.debug('answer:', response)
        wechatPort.postMessage({ answer: response })
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
