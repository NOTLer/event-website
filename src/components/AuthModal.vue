<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal">
      <h3 class="title">Вход</h3>
      <p class="sub">Выберите способ</p>

      <button class="btn google" @click="$emit('google')">Войти через Google</button>

      <div class="tg">
        <div class="tg-title">Войти через Telegram</div>

        <div v-if="!telegramBotUsername" class="warn">
          Не задан VITE_TELEGRAM_BOT_USERNAME в .env
        </div>

        <div ref="tgMount" class="tg-mount"></div>

        <div class="hint">
          Telegram-вход требует серверной проверки (Edge Function telegram-verify), иначе это можно подделать.
        </div>
      </div>

      <button class="btn close" @click="$emit('close')">Закрыть</button>
    </div>
  </div>
</template>

<script>
import { onMounted, onBeforeUnmount, ref } from 'vue'

export default {
  name: 'AuthModal',
  emits: ['google', 'telegram-auth', 'close'],
  props: {
    telegramBotUsername: { type: String, default: '' }
  },
  setup(props, { emit }) {
    const tgMount = ref(null)

    const renderTelegramWidget = () => {
      if (!tgMount.value) return
      tgMount.value.innerHTML = ''

      if (!props.telegramBotUsername) return

      window.__onTelegramAuth = (user) => {
        emit('telegram-auth', user)
      }

      const script = document.createElement('script')
      script.async = true
      script.src = 'https://telegram.org/js/telegram-widget.js?22'
      script.setAttribute('data-telegram-login', props.telegramBotUsername)
      script.setAttribute('data-size', 'large')
      script.setAttribute('data-userpic', 'true')
      script.setAttribute('data-request-access', 'write')
      script.setAttribute('data-onauth', '__onTelegramAuth(user)')
      tgMount.value.appendChild(script)
    }

    onMounted(renderTelegramWidget)

    onBeforeUnmount(() => {
      if (tgMount.value) tgMount.value.innerHTML = ''
      if (window.__onTelegramAuth) delete window.__onTelegramAuth
    })

    return { tgMount }
  }
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal {
  width: 420px;
  max-width: calc(100vw - 40px);
  background: #fff;
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 10px 30px rgba(0,0,0,.2);
}

.title { margin: 0; }
.sub { margin: 6px 0 14px; opacity: .7; }

.btn {
  width: 100%;
  border: none;
  border-radius: 12px;
  padding: 12px 14px;
  cursor: pointer;
  font-weight: 700;
}

.google { background: #8A75E3; color: #fff; }
.close { margin-top: 12px; background: #efefef; }

.tg { margin-top: 14px; padding-top: 14px; border-top: 1px solid #efefef; }
.tg-title { font-weight: 700; margin-bottom: 10px; }

.tg-mount {
  min-height: 48px;
  max-height: 240px;
  overflow-y: auto;
  overflow-x: hidden;
  border: 1px solid #efefef;
  border-radius: 12px;
  padding: 8px;
  background: #fafafa;
  scrollbar-width: thin;
  scrollbar-color: #c4b5fd #f5f3ff;
}

.tg-mount::-webkit-scrollbar {
  width: 8px;
}

.tg-mount::-webkit-scrollbar-track {
  background: #f5f3ff;
  border-radius: 12px;
}

.tg-mount::-webkit-scrollbar-thumb {
  background: #c4b5fd;
  border-radius: 12px;
}

.tg-mount::-webkit-scrollbar-thumb:hover {
  background: #a78bfa;
}

.tg-mount :deep(iframe.bis_skin_checked) {
  width: 100% !important;
  min-height: 180px !important;
  max-height: 220px !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  display: block;
  border: 0;
}

.warn { color: #b45309; font-size: 13px; margin-bottom: 10px; }
.hint { margin-top: 10px; font-size: 12px; opacity: .7; }
</style>
