import Browser from 'webextension-polyfill'

const PREFIX = 'CHATGPT:'

let port

function connect() {
  port = Browser.runtime.connect()
  port.onDisconnect.addListener(connect)
  port.onMessage.addListener((msg) => {
    if (msg.answer) {
      sendMsg(msg.answer)
    } else {
      sendMsg(msg.error || 'Ops! something wrong.')
    }
  })
}
connect()

const waitMsgList = setInterval(function () {
  const $msgList = document.querySelector('.msg-list')
  if ($msgList) {
    onWechatMsg()
    clearInterval(waitMsgList)
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === 'childList') {
          onWechatMsg()
        }
      })
    }).observe($msgList, { childList: true })
  }
}, 100)

function onWechatMsg() {
  const text = document.querySelector('.msg-list li:last-child .msg-text')?.textContent
  if (!text) return
  if (text.startsWith(PREFIX)) return
  port.postMessage({ question: text })
}

function sendMsg(text) {
  const $textArea = document.querySelector('.chat-panel__input-container')
  const $sendBtn = document.querySelector('.chat-send__button')
  if (!$textArea || !$sendBtn) return
  $textArea.value = PREFIX + '\n' + text
  $textArea.dispatchEvent(
    new Event('input', {
      bubbles: true,
      cancelable: true,
    }),
  )
  $sendBtn.dispatchEvent(new Event('click'))
}
