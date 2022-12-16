import Browser from 'webextension-polyfill'

const NODE_NOT_FOUND = 'Not found node'
const url = location.href

Browser.runtime.sendMessage({ type: 'page', url }).then((v) => {
  if (v?.ok) run().catch((err) => console.debug('chatgpt-keep-alive', err))
})

async function run() {
  if (url.startsWith('https://chat.openai.com/auth/login')) {
    await retry(
      async () => {
        let element = Array.from(document.querySelectorAll('.btn')).find(
          (el) => el.textContent === 'Log in',
        )
        if (!element) {
          throw new Error(NODE_NOT_FOUND)
        }
        Browser.runtime.sendMessage({ type: 'init-login' })
        await sleep(1000)
        element.click()
      },
      100,
      100,
    )
  } else if (url.startsWith('https://auth0.openai.com/u/login/identifier')) {
    await retry(
      async () => {
        let element = document.querySelector('form[data-provider="google"]')
        if (!element) {
          throw new Error(NODE_NOT_FOUND)
        }
        Browser.runtime.sendMessage({ type: 'choose-login-method' })
        await sleep(1000)
        element.submit()
      },
      100,
      100,
    )
  } else if (url.startsWith('https://auth0.openai.com/login/callback')) {
    await retry(
      async () => {
        let element = document.querySelector('.error-title')
        if (!element || element.textContent !== 'OpenAI') {
          throw new Error(NODE_NOT_FOUND)
        }
        Browser.runtime.sendMessage({ type: 'location' })
        await sleep(1000)
        location.href = 'https://chat.openai.com/chat'
      },
      100,
      100,
    )
  } else if (
    url.startsWith('https://accounts.google.com/o/oauth2/auth') &&
    url.includes('auth0.openai.com')
  ) {
    await retry(
      async () => {
        let element = document.querySelector('div[data-authuser="0"]')
        if (!element) {
          element = document.querySelector('input[type="email"]')
          if (!element) {
            throw new Error(NODE_NOT_FOUND)
          } else {
            Browser.runtime.sendMessage({ type: 'google-auth-fail' })
            return
          }
        }
        Browser.runtime.sendMessage({ type: 'google-auth' })
        await sleep(3000)
        element.click()
        setInterval(() => {
          element.click()
        }, 3000)
      },
      100,
      100,
    )
  } else if (url.startsWith('https://chat.openai.com/chat')) {
    await retry(
      async () => {
        const element = document.querySelector('h1')
        if (!element || element.textContent !== 'ChatGPT') {
          throw new Error(NODE_NOT_FOUND)
        }
        await sleep(1000)
        const loginBtn = Array.from(document.querySelectorAll('button')).find((el) =>
          el.textContent.includes('Log in'),
        )
        if (loginBtn) {
          location.href = 'https://chat.openai.com/auth/login'
        } else {
          Browser.runtime.sendMessage({ type: 'enter-chat' })
        }
      },
      100,
      100,
    )
  }

  function retry(operation, maxAttempts, delay) {
    return new Promise((resolve, reject) => {
      let attempts = 0

      function attempt() {
        attempts++
        operation()
          .then(resolve)
          .catch((error) => {
            if (attempts >= maxAttempts) {
              reject(error)
            } else {
              setTimeout(attempt, delay)
            }
          })
      }

      attempt()
    })
  }
}

async function sleep(timeMs) {
  return new Promise((resolve) => setTimeout(resolve, timeMs))
}
