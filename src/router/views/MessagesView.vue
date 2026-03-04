<template>
  <div class="mv">
    <div class="mv-left">
      <div class="mv-head">
        <div class="mv-title">Сообщения</div>
        <button class="mv-create-conversation" type="button" @click="openCreateConversationModal">+ Беседа</button>
        <button class="mv-refresh" type="button" @click="reload" :disabled="loading">⟳</button>
      </div>

      <div v-if="authRequired" class="mv-empty">
        <div class="mv-empty-title">Нужен вход</div>
        <div class="mv-empty-text">Авторизуйся, чтобы видеть чаты.</div>
        <button class="mv-empty-btn" type="button" @click="openProfileLogin">Открыть вход</button>
      </div>

      <div v-else>
        <div v-if="loading" class="mv-skel">
          <div class="skel-row" v-for="i in 6" :key="i"></div>
        </div>

        <div v-else-if="threads.length === 0" class="mv-empty">
          <div class="mv-empty-title">Пока пусто</div>
          <div class="mv-empty-text">Начни переписку — и здесь появятся чаты.</div>
        </div>

        <div v-else class="mv-list">
          <button
            v-for="t in threads"
            :key="t.otherUserId"
            type="button"
            class="thread"
            :class="{ active: t.otherUserId === selectedOtherId, unread: t.unread }"
            @click="openThread(t.otherUserId)"
          >
            <div class="thread-ava">
              <img v-if="t.avatar" :src="t.avatar" class="thread-ava-img" alt="avatar" @error="onAvaErr(t)" />
              <div v-else class="thread-ava-ph">👤</div>
              <div v-if="t.unread" class="thread-dot" aria-label="Непрочитано"></div>
            </div>

            <div class="thread-mid">
              <div class="thread-top">
                <div class="thread-name">
                  {{ t.title }}
                </div>
                <div class="thread-time">{{ formatTime(t.lastMessage?.created_at) }}</div>
              </div>

              <div class="thread-sub">
                <div class="thread-preview">
                  {{ t.isConversation ? 'Групповая беседа' : threadPreview(t.lastMessage?.body || '') }}
                </div>
                <div v-if="t.unreadCount > 0" class="thread-pill" aria-label="Непрочитанные">
                  {{ t.unreadCount > 99 ? '99+' : t.unreadCount }}
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>

    <div class="mv-right" :class="{ 'mv-right-open': !!selectedOtherId }">
      <div v-if="authRequired" class="chat-empty">
        <div class="chat-empty-title">Сообщения</div>
        <div class="chat-empty-text">Войди, чтобы открыть чат.</div>
      </div>

      <div v-else-if="!selectedOtherId" class="chat-empty">
        <div class="chat-empty-title">Выбери чат</div>
        <div class="chat-empty-text">Слева список диалогов.</div>
      </div>

      <div v-else class="chat">
        <div class="chat-head">
          <div class="chat-peer">
            <div class="chat-peer-ava">
              <img
                v-if="peer?.avatar"
                :src="peer.avatar"
                class="chat-peer-ava-img"
                alt="avatar"
                @error="onPeerAvaErr"
              />
              <div v-else class="chat-peer-ava-ph">👤</div>
            </div>

            <div class="chat-peer-info" @click="openPeerProfile" role="button" tabindex="0">
              <div class="chat-peer-name">{{ peer?.title || 'Пользователь' }}</div>
              <div class="chat-peer-sub">
                {{ peerStatusText }}
                <span v-if="peerTyping" class="typing-pill" aria-label="Печатает">печатает…</span>
              </div>
            </div>
          </div>

          <div class="chat-head-actions">
            <button class="chat-back" type="button" @click="closeThread" aria-label="Назад">←</button>
            <button class="chat-head-btn" type="button" @click="reloadConversation" :disabled="convLoading">⟳</button>
          </div>
        </div>

        <div ref="chatBodyRef" class="chat-body" @scroll.passive="onChatScroll" @click="closeMessageMenu">
          <div v-if="convLoading" class="chat-skel">
            <div class="chat-skel-bubble" v-for="i in 8" :key="i"></div>
          </div>

          <template v-else>
            <div v-if="messages.length === 0" class="chat-empty-inner">
              Пока нет сообщений
            </div>

            <TransitionGroup v-else name="msg-list" tag="div" class="chat-msgs">
              <div
                v-for="m in messages"
                :key="m.id"
                class="msg"
                :class="{ mine: m.sender_id === myId, their: m.sender_id !== myId, 'menu-open': messageMenuId === String(m.id) }"
              >
                <div class="msg-bubble" @click.stop @contextmenu.prevent.stop="openMessageMenuContext($event, m.id)">

                  <div v-if="messageMenuId === String(m.id)" class="msg-menu" @click.stop>
                    <div class="msg-menu-stickers">
                      <button
                        v-for="emoji in reactionOptions"
                        :key="`${m.id}-menu-${emoji}`"
                        class="msg-menu-sticker"
                        type="button"
                        :class="{ active: myReactionByMessage(m.id) === emoji }"
                        @click="pickReactionFromMenu(m.id, emoji)"
                      >{{ emoji }}</button>
                    </div>

                    <button class="msg-menu-item" type="button" @click="copyMessageFromMenu(m)">Копировать текст</button>
                    <button class="msg-menu-item" type="button" @click="replyFromMenu(m)">Ответить</button>
                    <button class="msg-menu-item" type="button" @click="forwardMessageFromMenu(m)">Переслать сообщение</button>
                    <button
                      class="msg-menu-item msg-menu-item-danger"
                      type="button"
                      :disabled="m.sender_id !== myId"
                      @click="deleteFromMenu(m)"
                    >Удалить</button>
                  </div>

                  <!-- reply preview inside message -->
                  <div v-if="parseBody(m.body).reply" class="msg-reply">
                    <div class="msg-reply-top">
                      Ответ на <span class="msg-reply-who">{{ parseBody(m.body).reply.who }}</span>
                    </div>
                    <div class="msg-reply-text">{{ parseBody(m.body).reply.text }}</div>
                  </div>

                  <div class="msg-text">{{ parseBody(m.body).text }}</div>

                  <div v-if="parseBody(m.body).forward" class="msg-forward">
                    <div class="msg-forward-top">
                      Переслано от <span class="msg-forward-who">{{ parseBody(m.body).forward.from }}</span>
                    </div>
                    <div v-if="parseBody(m.body).forward.chat" class="msg-forward-chat">
                      из чата «{{ parseBody(m.body).forward.chat }}»
                    </div>
                    <div class="msg-forward-text">{{ parseBody(m.body).forward.text }}</div>
                  </div>

                  <div class="msg-reactions">
                    <button
                      v-for="item in getMessageReactions(m.id)"
                      :key="`${m.id}-${item.reaction}`"
                      class="msg-reaction-chip"
                      :class="{ mine: item.mine }"
                      type="button"
                      :title="reactionAuthorsText(item)"
                      @click="setMessageReaction(m.id, item.reaction)"
                    >
                      <span>{{ item.reaction }}</span>
                      <span v-if="m.sender_id !== myId || item.count > 1">{{ item.count }}</span>
                    </button>

                    <div v-if="getMessageReactions(m.id).length > 0" class="msg-reactions-tooltip">
                      <div
                        v-for="item in getMessageReactions(m.id)"
                        :key="`${m.id}-${item.reaction}-authors`"
                        class="msg-reactions-tooltip-row"
                      >{{ item.reaction }} {{ reactionAuthorsText(item) }}</div>
                    </div>
                  </div>

                  <div class="msg-meta">
                    <span class="msg-time">{{ formatTime(m.created_at) }}</span>
                    <span v-if="m.sender_id === myId" class="msg-check" :class="{ read: !!m.read_at }">{{ m.read_at ? '✓✓' : '✓' }}</span>
                  </div>
                </div>
              </div>
            </TransitionGroup>
          </template>
        </div>

        <button
          v-if="showScrollDown"
          class="scroll-down-btn"
          type="button"
          @click="scrollBottom(true)"
          aria-label="Прокрутить вниз"
          title="Вниз"
        >
          ↓
        </button>

        <div class="chat-foot">
          <!-- reply-to bar -->
          <div v-if="replyTo" class="reply-bar">
            <div class="reply-bar-left">
              <div class="reply-bar-title">Ответ на {{ replyTo.who }}</div>
              <div class="reply-bar-snippet">{{ replyTo.text }}</div>
            </div>
            <button class="reply-bar-close" type="button" @click="clearReply" aria-label="Отменить ответ">✕</button>
          </div>

          <div v-if="forwardTo" class="reply-bar reply-bar-forward">
            <div class="reply-bar-left">
              <div class="reply-bar-title">Переслать: {{ forwardTo.from }}</div>
              <div class="reply-bar-snippet">{{ forwardTo.text }}</div>
            </div>
            <button class="reply-bar-close" type="button" @click="clearForward" aria-label="Отменить пересылку">✕</button>
          </div>

          <div class="chat-input-row">
            <input
              ref="chatInputRef"
              v-model="draft"
              class="chat-input"
              type="text"
              placeholder="Напиши сообщение…"
              @input="onDraftInput"
              @blur="stopTyping"
              @keydown.enter.prevent="send"
              :disabled="sending"
            />
            <button class="chat-send" type="button" @click="send" :disabled="sending || (!draft.trim() && !forwardTo)">Отправить</button>
          </div>
        </div>
      </div>
    </div>


  <UserProfileView
    v-if="showPeerProfile && selectedOtherId"
    :user-id="selectedOtherId"
    @close="closePeerProfile"
  />

  <div v-if="forwardModalOpen" class="fwd-modal" @click.self="closeForwardModal">
    <div class="fwd-modal-card">
      <div class="fwd-modal-head">
        <div class="fwd-modal-title">Кому переслать?</div>
        <button class="fwd-modal-close" type="button" @click="closeForwardModal" aria-label="Закрыть">✕</button>
      </div>

      <div v-if="threads.length === 0" class="fwd-modal-empty">Нет чатов для пересылки.</div>

      <div v-else class="fwd-modal-list">
        <button
          v-for="t in threads"
          :key="`fwd-${t.otherUserId}`"
          type="button"
          class="fwd-chat"
          @click="pickForwardChat(t.otherUserId)"
        >
          <img v-if="t.avatar" :src="t.avatar" class="fwd-chat-ava" alt="avatar" />
          <div v-else class="fwd-chat-ava fwd-chat-ava-ph">👤</div>
          <div class="fwd-chat-main">
            <div class="fwd-chat-title">{{ t.title }}</div>
            <div class="fwd-chat-sub">{{ threadPreview(t.lastMessage?.body || '') || 'Без сообщений' }}</div>
          </div>
        </button>
      </div>
    </div>
  </div>

  <div v-if="createConversationOpen" class="fwd-modal" @click.self="closeCreateConversationModal">
    <div class="fwd-modal-card">
      <div class="fwd-modal-head">
        <div class="fwd-modal-title">Новая беседа</div>
        <button class="fwd-modal-close" type="button" @click="closeCreateConversationModal" aria-label="Закрыть">✕</button>
      </div>

      <div class="conv-title-block">
        <div class="conv-title-label">Название беседы</div>
        <input
          v-model="newConversationTitle"
          class="chat-input"
          type="text"
          placeholder="Например: Поездка на конференцию"
          :disabled="creatingConversation"
        />
      </div>

      <div v-if="!newConversationTitle.trim()" class="fwd-modal-empty">Сначала укажи название беседы.</div>
      <template v-else>
        <div v-if="friendsLoading" class="fwd-modal-empty">Загрузка друзей...</div>
        <div v-else-if="friendsForConversation.length === 0" class="fwd-modal-empty">Нет друзей для добавления.</div>

        <div v-else class="conv-friends-list">
          <label v-for="f in friendsForConversation" :key="`new-conv-${f.id}`" class="conv-friend-row">
            <input v-model="selectedConversationFriends" :value="f.id" type="checkbox" />
            <img v-if="f.avatar" :src="f.avatar" class="fwd-chat-ava" alt="avatar" />
            <div v-else class="fwd-chat-ava fwd-chat-ava-ph">👤</div>
            <div class="conv-friend-name">{{ f.title }}</div>
          </label>
        </div>
      </template>

      <button
        class="chat-send conv-create-btn"
        type="button"
        :disabled="creatingConversation || !newConversationTitle.trim() || selectedConversationFriends.length === 0"
        @click="createConversationSubmit"
      >Создать беседу</button>
    </div>
  </div>
  </div>
</template>

<script>
import { ref, onMounted, watch, nextTick, onBeforeUnmount, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSupabase, supabase } from '../../composables/useSupabase.js'
import { useUnreadMessages } from '../../composables/unreadMessages.js'
import UserProfileView from './UserProfileView.vue'

const normalizeStoragePublicUrl = (url) => {
  if (!url || typeof url !== 'string') return ''
  const u = url.trim()
  if (!u) return ''
  if (u.includes('/storage/v1/object/public/')) return u
  if (u.includes('/storage/v1/object/')) return u.replace('/storage/v1/object/', '/storage/v1/object/public/')
  return u
}

/**
 * Reply-мета хранится внутри body:
 * __REPLY__{"id":"...","who":"...","text":"..."}__REPLY__<текст>
 */
const REPLY_PREFIX = '__REPLY__'
const REPLY_SUFFIX = '__REPLY__'
const FORWARD_PREFIX = '__FORWARD__'
const FORWARD_SUFFIX = '__FORWARD__'
const REACTION_OPTIONS = ['❤️', '🫡', '👌', '👍', '😡', '🥲', '😭']
const CONVERSATION_THREAD_PREFIX = 'conversation:'

const isConversationThreadId = (id) => String(id || '').startsWith(CONVERSATION_THREAD_PREFIX)
const conversationIdFromThreadId = (id) => {
  const raw = String(id || '').trim()
  if (!isConversationThreadId(raw)) return ''
  return raw.slice(CONVERSATION_THREAD_PREFIX.length)
}

const safeJsonParse = (s) => {
  try { return JSON.parse(s) } catch { return null }
}

const buildBodyWithMeta = ({ replyTo, forwardTo, text }) => {
  let body = String(text || '')

  if (forwardTo) {
    const meta = {
      from: String(forwardTo.from || 'Пользователь'),
      chat: String(forwardTo.chat || ''),
      text: String(forwardTo.text || '').trim().slice(0, 1200)
    }
    body = `${FORWARD_PREFIX}${JSON.stringify(meta)}${FORWARD_SUFFIX}${body}`
  }

  if (replyTo) {
    const meta = {
      id: String(replyTo.id || ''),
      who: String(replyTo.who || 'сообщение'),
      text: String(replyTo.text || '').slice(0, 180)
    }
    body = `${REPLY_PREFIX}${JSON.stringify(meta)}${REPLY_SUFFIX}${body}`
  }

  return body
}

const parseBody = (body) => {
  const raw = String(body || '')
  let cursor = raw
  let reply = null
  let forward = null

  if (cursor.startsWith(REPLY_PREFIX)) {
    const end = cursor.indexOf(REPLY_SUFFIX, REPLY_PREFIX.length)
    if (end !== -1) {
      const jsonPart = cursor.slice(REPLY_PREFIX.length, end)
      const meta = safeJsonParse(jsonPart)
      if (meta && typeof meta === 'object') {
        reply = {
          id: String(meta.id || ''),
          who: String(meta.who || 'сообщение'),
          text: String(meta.text || '').trim()
        }
      }
      cursor = cursor.slice(end + REPLY_SUFFIX.length)
    }
  }

  if (cursor.startsWith(FORWARD_PREFIX)) {
    const end = cursor.indexOf(FORWARD_SUFFIX, FORWARD_PREFIX.length)
    if (end !== -1) {
      const jsonPart = cursor.slice(FORWARD_PREFIX.length, end)
      const meta = safeJsonParse(jsonPart)
      if (meta && typeof meta === 'object') {
        forward = {
          from: String(meta.from || 'Пользователь'),
          chat: String(meta.chat || ''),
          text: String(meta.text || '').trim()
        }
      }
      cursor = cursor.slice(end + FORWARD_SUFFIX.length)
    }
  }

  return { reply, forward, text: cursor }
}

export default {
  name: 'MessagesView',
  components: { UserProfileView },
  setup() {
    const router = useRouter()
    const route = useRoute()

    const {
      getUser,
      getPublicUserById,
      getInboxThreads,
      getMyConversations,
      getFriendships,
      createConversation,
      getConversation,
      sendMessage,
      deleteMessage,
      markConversationRead,
      subscribeToMyMessages
    } = useSupabase()

    const { setUnreadCount } = useUnreadMessages()

    const myId = ref('')
    const authRequired = ref(false)

    const loading = ref(false)
    const convLoading = ref(false)
    const sending = ref(false)

    const threads = ref([]) // [{ otherUserId, lastMessage, unread, unreadCount, title, avatar }]
    const selectedOtherId = ref('')
    const showPeerProfile = ref(false)
    const createConversationOpen = ref(false)
    const friendsLoading = ref(false)
    const creatingConversation = ref(false)
    const friendsForConversation = ref([])
    const selectedConversationFriends = ref([])
    const newConversationTitle = ref('')

    const peer = ref(null)
    const messages = ref([])
    const reactionsByMessage = ref({})
    const messageMenuId = ref('')
    const draft = ref('')
    const peerOnline = ref(false)
    const peerLastSeenAt = ref('')

    const replyTo = ref(null) // { id, who, text }
    const forwardTo = ref(null) // { from, chat, text }
    const forwardModalOpen = ref(false)
    const pendingForwardMessage = ref(null)
    const chatBodyRef = ref(null)
    const chatInputRef = ref(null)
    const showScrollDown = ref(false)
    const convHasMore = ref(true)
    const convLoadingMore = ref(false)
    const oldestLoadedAt = ref('')

    // ✅ typing
    const peerTyping = ref(false)
    let typingSelfTimer = null
    let typingSelfStopTimer = null
    let typingPeerTimer = null
    let typingPresenceTimer = null
    let peerStatusTickTimer = null
    let typingChannel = null
    const typingFeatureEnabled = ref(true)

    let rtChannel = null
    let reactionsChannel = null

    const reactionOptions = REACTION_OPTIONS

    const calcUnreadTotal = () => {
      let total = 0
      for (const t of threads.value) total += Number(t.unreadCount || 0)
      setUnreadCount(total)
    }

    const isNotAuthorizedError = (error) => {
      const msg = String(error?.message || error || '').toLowerCase()
      return msg.includes('not authorized') || msg.includes('jwt') || msg.includes('auth')
    }

    const formatTime = (iso) => {
      if (!iso) return ''
      try {
        const d = new Date(iso)
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        return `${hh}:${mm}`
      } catch {
        return ''
      }
    }

    const openProfileLogin = () => {
      window.dispatchEvent(new Event('open-profile'))
    }

    const safeTitleFromUser = (u) => {
      if (!u) return 'Пользователь'
      const fn = String(u.first_name || '').trim()
      const ln = String(u.last_name || '').trim()
      const uname = String(u.username || '').trim()
      const email = String(u.email || '').trim()
      const full = `${fn} ${ln}`.trim()
      return full || uname || email || 'Пользователь'
    }

    const threadPreview = (body) => {
      const p = parseBody(body)
      const t = String(p.text || '').trim()
      return t || (p.reply ? 'Ответ' : '')
    }

    const copyText = async (text) => {
      const value = String(text || '')
      if (!value) return false
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value)
          return true
        }
      } catch {
        // fallback
      }

      try {
        const ta = document.createElement('textarea')
        ta.value = value
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.top = '-9999px'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        return !!ok
      } catch {
        return false
      }
    }

    const formatLastSeen = (iso) => {
      if (!iso) return ''
      const dt = new Date(iso)
      if (Number.isNaN(dt.getTime())) return ''
      const now = Date.now()
      const deltaSec = Math.max(0, Math.floor((now - dt.getTime()) / 1000))
      if (deltaSec < 60) return 'был(а) только что'
      const deltaMin = Math.floor(deltaSec / 60)
      if (deltaMin < 60) return `был(а) ${deltaMin} мин назад`
      const hh = String(dt.getHours()).padStart(2, '0')
      const mm = String(dt.getMinutes()).padStart(2, '0')
      return `был(а) в ${hh}:${mm}`
    }

    const peerStatusText = computed(() => {
      const base = peer?.value?.sub || ''
      if (isConversationThreadId(selectedOtherId.value)) return base || 'групповой чат'
      const status = peerOnline.value ? 'в сети' : formatLastSeen(peerLastSeenAt.value)
      return [base, status].filter(Boolean).join(' · ')
    })

    const refreshPeerOnlineByTime = () => {
      if (!peerLastSeenAt.value) {
        peerOnline.value = false
        return
      }
      const dt = new Date(peerLastSeenAt.value)
      if (Number.isNaN(dt.getTime())) {
        peerOnline.value = false
        return
      }
      peerOnline.value = Date.now() - dt.getTime() <= 35000
    }

    const loadPeerPresence = async () => {
      const uid = myId.value
      const otherId = selectedOtherId.value
      if (!uid || !otherId || !typingFeatureEnabled.value) {
        peerLastSeenAt.value = ''
        peerOnline.value = false
        return
      }
      try {
        const { data, error } = await supabase
          .from('typing')
          .select('updated_at,is_typing')
          .eq('user_id', otherId)
          .eq('other_id', uid)
          .maybeSingle()
        if (error) throw error

        const updatedAt = String(data?.updated_at || '')
        peerLastSeenAt.value = updatedAt
        if (data?.is_typing) {
          peerOnline.value = true
          return
        }
        refreshPeerOnlineByTime()
      } catch {
        peerLastSeenAt.value = ''
        peerOnline.value = false
      }
    }

    const playIncomingSound = () => {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (!Ctx) return
        const ctx = new Ctx()

        const master = ctx.createGain()
        master.gain.value = 0.0001
        master.connect(ctx.destination)

        const now = ctx.currentTime

        const beep = (freq, start, len, volume) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq
          gain.gain.value = 0.0001
          osc.connect(gain)
          gain.connect(master)
          gain.gain.exponentialRampToValueAtTime(volume, start + 0.01)
          gain.gain.exponentialRampToValueAtTime(0.0001, start + len)
          osc.start(start)
          osc.stop(start + len + 0.02)
        }

        // Чуть громче и выразительнее: двойной "пинг"
        master.gain.exponentialRampToValueAtTime(0.22, now + 0.02)
        master.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)
        beep(820, now, 0.16, 0.24)
        beep(980, now + 0.14, 0.18, 0.26)

        setTimeout(() => {
          try { ctx.close() } catch {}
        }, 650)
      } catch {
        // ignore
      }
    }

    const appendMessageUnique = (m) => {
      if (!m?.id) return false
      if (messages.value.some((x) => x?.id === m.id)) return false
      messages.value = [...messages.value, m]
      return true
    }


    const reactionAuthorName = (userId) => {
      const uid = String(userId || '')
      if (!uid) return 'Пользователь'
      if (uid === myId.value) return 'Вы'
      if (uid === String(selectedOtherId.value || '')) return String(peer.value?.title || 'Собеседник')
      return 'Пользователь'
    }

    const groupReactions = (rows) => {
      const grouped = {}
      for (const row of (rows || [])) {
        const messageId = String(row?.message_id || '')
        const reaction = String(row?.reaction || '')
        if (!messageId || !reaction) continue

        if (!grouped[messageId]) grouped[messageId] = { myReaction: '', byEmoji: {} }
        if (!grouped[messageId].byEmoji[reaction]) grouped[messageId].byEmoji[reaction] = { reaction, count: 0, mine: false, users: [] }

        grouped[messageId].byEmoji[reaction].count += 1
        grouped[messageId].byEmoji[reaction].users.push(reactionAuthorName(row?.user_id))
        if (String(row?.user_id || '') === myId.value) {
          grouped[messageId].myReaction = reaction
          grouped[messageId].byEmoji[reaction].mine = true
        }
      }

      const next = {}
      for (const [messageId, val] of Object.entries(grouped)) {
        const items = Object.values(val.byEmoji).sort((a, b) => {
          const ai = reactionOptions.indexOf(a.reaction)
          const bi = reactionOptions.indexOf(b.reaction)
          return ai - bi
        })
        next[messageId] = { items, myReaction: val.myReaction }
      }
      return next
    }

    const loadReactionsForMessages = async (messageIds) => {
      const ids = Array.isArray(messageIds)
        ? [...new Set(messageIds.map((x) => String(x || '').trim()).filter(Boolean))]
        : []

      if (ids.length === 0) {
        reactionsByMessage.value = {}
        return
      }

      const numericIds = ids
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id))

      if (numericIds.length === 0) {
        reactionsByMessage.value = {}
        return
      }

      const { data, error } = await supabase
        .from('message_reactions')
        .select('message_id,user_id,reaction')
        .in('message_id', numericIds)

      if (error) throw error
      reactionsByMessage.value = groupReactions(data || [])
    }

    const refreshReactionsForCurrentConversation = async () => {
      const ids = messages.value.map((m) => m?.id)
      await loadReactionsForMessages(ids)
    }

    const getMessageReactions = (messageId) => {
      const key = String(messageId || '')
      return reactionsByMessage.value?.[key]?.items || []
    }

    const myReactionByMessage = (messageId) => {
      const key = String(messageId || '')
      return String(reactionsByMessage.value?.[key]?.myReaction || '')
    }

    const reactionAuthorsText = (item) => {
      const users = Array.isArray(item?.users) ? item.users : []
      return users.length > 0 ? users.join(', ') : 'без имени'
    }

    const closeMessageMenu = () => {
      messageMenuId.value = ''
    }

    const openMessageMenuContext = (event, messageId) => {
      if (event?.preventDefault) event.preventDefault()
      if (event?.stopPropagation) event.stopPropagation()
      const id = String(messageId || '')
      if (!id) return
      messageMenuId.value = id
    }

    const pickReactionFromMenu = async (messageId, emoji) => {
      await setMessageReaction(messageId, emoji)
      messageMenuId.value = ''
    }

    const replyFromMenu = async (m) => {
      await setReply(m)
      messageMenuId.value = ''
    }

    const copyMessageFromMenu = async (m) => {
      const text = String(parseBody(m?.body).text || '').trim()
      const ok = await copyText(text)
      messageMenuId.value = ''
      if (!ok) alert('Не удалось скопировать текст')
    }

    const messageAuthorForForward = (m) => {
      if (!m) return 'Пользователь'
      return String(m.sender_id || '') === myId.value
        ? 'Вы'
        : String(peer.value?.title || 'Пользователь')
    }

    const closeForwardModal = () => {
      forwardModalOpen.value = false
      pendingForwardMessage.value = null
    }


    const closeCreateConversationModal = () => {
      createConversationOpen.value = false
      selectedConversationFriends.value = []
      newConversationTitle.value = ''
    }

    const loadFriendsForConversation = async () => {
      const { user } = await getUser()
      if (!user?.id) {
        friendsForConversation.value = []
        return
      }

      friendsLoading.value = true
      try {
        const { data, error } = await getFriendships()
        if (error) throw error

        const accepted = (data || []).filter((row) => row?.status === 'accepted')
        const ids = [...new Set(accepted.map((row) => {
          const requester = String(row?.requester_id || '')
          const addressee = String(row?.addressee_id || '')
          return requester === user.id ? addressee : requester
        }).filter(Boolean))]

        const users = await Promise.all(ids.map(async (id) => {
          const { data: u } = await getPublicUserById(id)
          return {
            id,
            title: safeTitleFromUser(u),
            avatar: normalizeStoragePublicUrl(u?.image_path || '')
          }
        }))

        friendsForConversation.value = users
      } finally {
        friendsLoading.value = false
      }
    }

    const openCreateConversationModal = async () => {
      createConversationOpen.value = true
      await loadFriendsForConversation()
    }

    const createConversationSubmit = async () => {
      if (selectedConversationFriends.value.length === 0) return
      creatingConversation.value = true
      try {
        const { data, error } = await createConversation({ title: newConversationTitle.value, participantIds: selectedConversationFriends.value })
        if (error) throw error
        closeCreateConversationModal()
        await reload()
        if (data?.id) alert('Беседа создана')
      } catch (e) {
        alert(String(e?.message || 'Не удалось создать беседу'))
      } finally {
        creatingConversation.value = false
      }
    }

    const forwardMessageFromMenu = async (m) => {
      const parsed = parseBody(m?.body)
      const pureText = String(parsed?.text || '').trim()
      if (!pureText) {
        messageMenuId.value = ''
        return
      }

      pendingForwardMessage.value = {
        from: messageAuthorForForward(m),
        chat: String(peer.value?.title || 'Чат'),
        text: pureText.slice(0, 1200)
      }
      forwardModalOpen.value = true
      messageMenuId.value = ''
    }

    const pickForwardChat = async (otherId) => {
      const payload = pendingForwardMessage.value
      closeForwardModal()
      if (!otherId || !payload) return

      await openThread(otherId)
      forwardTo.value = payload
      await focusChatInput()
    }

    const clearForward = () => {
      forwardTo.value = null
    }

    const deleteFromMenu = async (m) => {
      if (String(m?.sender_id || '') !== myId.value) return
      await removeMessage(m.id)
      messageMenuId.value = ''
    }

    const setMessageReaction = async (messageId, reaction) => {
      const messageKey = String(messageId || '')
      const picked = String(reaction || '')
      if (!messageKey || !reactionOptions.includes(picked) || !myId.value) return

      const current = myReactionByMessage(messageKey)
      if (current === picked) {
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', Number(messageKey))
          .eq('user_id', myId.value)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('message_reactions')
          .upsert([{ message_id: Number(messageKey), user_id: myId.value, reaction: picked }], { onConflict: 'message_id,user_id' })
        if (error) throw error
      }

      messageMenuId.value = ''
      await refreshReactionsForCurrentConversation()
    }

    const ensureThreadsUsers = async (rows) => {
      const ids = [...new Set((rows || []).map((x) => x.otherUserId).filter(Boolean))]
      const map = new Map()

      await Promise.all(
        ids.map(async (id) => {
          const { data } = await getPublicUserById(id)
          if (data) map.set(id, data)
        })
      )

      return map
    }

    const reload = async () => {
      loading.value = true
      try {
        const { user } = await getUser()
        if (!user?.id) {
          authRequired.value = true
          myId.value = ''
          threads.value = []
          setUnreadCount(0)
          return
        }
        authRequired.value = false
        myId.value = user.id

        const { data, error } = await getInboxThreads(60)
        if (error) {
          if (isNotAuthorizedError(error)) {
            authRequired.value = true
            myId.value = ''
            threads.value = []
            setUnreadCount(0)
            return
          }
          throw error
        }

        const rows = (data || []).map((x) => ({
          otherUserId: x.otherUserId,
          lastMessage: x.lastMessage,
          isConversation: false
        }))

        const { data: conversationsData, error: conversationsError } = await getMyConversations(60)
        if (conversationsError) throw conversationsError

        for (const conv of (conversationsData || [])) {
          const convId = String(conv?.id || '').trim()
          if (!convId) continue
          const title = String(conv?.title || '').trim() || `Беседа #${convId}`
          const freshAt = conv?.updated_at || conv?.created_at || ''
          rows.push({
            otherUserId: `conversation:${convId}`,
            lastMessage: { body: '', created_at: freshAt },
            isConversation: true,
            conversationId: convId,
            conversationTitle: title,
            conversationFreshAt: freshAt
          })
        }

        const usersMap = await ensureThreadsUsers(rows)
        const unreadByOther = new Map()
        const { data: unreadRows } = await supabase
          .from('messages')
          .select('sender_id')
          .eq('receiver_id', user.id)
          .is('read_at', null)

        for (const m of (unreadRows || [])) {
          const other = String(m?.sender_id || '')
          if (!other) continue
          unreadByOther.set(other, Number(unreadByOther.get(other) || 0) + 1)
        }

        const enriched = rows.map((r) => {
          const m = r.lastMessage || {}
          if (r.isConversation) {
            return {
              otherUserId: r.otherUserId,
              lastMessage: r.lastMessage || { body: '', created_at: r.conversationFreshAt || '' },
              unread: false,
              unreadCount: 0,
              title: r.conversationTitle || 'Беседа',
              avatar: '',
              isConversation: true,
              conversationId: r.conversationId
            }
          }

          const unreadCount = Number(unreadByOther.get(String(r.otherUserId)) || 0)
          const unread = unreadCount > 0
          const u = usersMap.get(r.otherUserId)

          return {
            otherUserId: r.otherUserId,
            lastMessage: m,
            unread,
            unreadCount,
            title: safeTitleFromUser(u),
            avatar: normalizeStoragePublicUrl(u?.image_path || ''),
            isConversation: false
          }
        })

        threads.value = enriched.sort((a, b) => new Date(b?.lastMessage?.created_at || 0) - new Date(a?.lastMessage?.created_at || 0))
        calcUnreadTotal()

        const qWith = String(route.query.with || '').trim()
        if (qWith && enriched.some((t) => t.otherUserId === qWith)) {
          selectedOtherId.value = qWith
          await loadPeer(qWith)
          await reloadConversation()
          await markThreadAsRead(qWith)
        }
      } finally {
        loading.value = false
      }
    }

    const loadPeer = async (otherId) => {
      if (!otherId) {
        peer.value = null
        return
      }
      const { data } = await getPublicUserById(otherId)
      const title = safeTitleFromUser(data)
      peer.value = {
        id: otherId,
        title,
        sub: data?.username ? `@${data.username}` : '',
        avatar: normalizeStoragePublicUrl(data?.image_path || '')
      }
    }

    const isAtBottom = (el = chatBodyRef.value) => {
      if (!el) return true
      const delta = el.scrollHeight - el.scrollTop - el.clientHeight
      return delta <= 80
    }

    const scrollBottom = async (smooth = false) => {
      await nextTick()
      await new Promise((resolve) => requestAnimationFrame(resolve))
      const el = chatBodyRef.value
      if (!el) return
      if (smooth) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      } else {
        el.scrollTop = el.scrollHeight
      }
      showScrollDown.value = false
    }

    const loadOlderMessages = async () => {
      if (!selectedOtherId.value || convLoading.value || convLoadingMore.value || !convHasMore.value || !oldestLoadedAt.value) return
      convLoadingMore.value = true
      try {
        const { user } = await getUser()
        if (!user?.id) return

        const selectedConversationId = conversationIdFromThreadId(selectedOtherId.value)

        const beforeTop = chatBodyRef.value?.scrollHeight || 0

        let query = supabase
          .from('messages')
          .select('*')
          .lt('created_at', oldestLoadedAt.value)
          .order('created_at', { ascending: false })
          .limit(80)

        if (selectedConversationId) {
          query = query.eq('conversation_id', selectedConversationId)
        } else {
          query = query.or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedOtherId.value}),and(sender_id.eq.${selectedOtherId.value},receiver_id.eq.${user.id})`)
        }

        const { data, error } = await query

        if (error) throw error

        const rows = (data || []).slice().reverse()
        if (rows.length === 0) {
          convHasMore.value = false
          return
        }

        const dedup = rows.filter((m) => !messages.value.some((x) => x?.id === m?.id))
        if (dedup.length === 0) {
          convHasMore.value = false
          return
        }

        messages.value = [...dedup, ...messages.value]
        oldestLoadedAt.value = String(messages.value?.[0]?.created_at || oldestLoadedAt.value || '')

        await nextTick()
        const el = chatBodyRef.value
        if (el) {
          const afterTop = el.scrollHeight
          el.scrollTop += Math.max(0, afterTop - beforeTop)
        }

        await refreshReactionsForCurrentConversation()
      } finally {
        convLoadingMore.value = false
      }
    }

    const onChatScroll = async () => {
      const el = chatBodyRef.value
      if (!el) return
      showScrollDown.value = !isAtBottom(el)
      if (el.scrollTop <= 120) {
        await loadOlderMessages()
      }
    }

    const reloadConversation = async () => {
      if (!selectedOtherId.value) return
      convLoading.value = true
      try {
        const { user } = await getUser()
        if (!user?.id) return
        myId.value = user.id

        const selectedConversationId = conversationIdFromThreadId(selectedOtherId.value)

        // загружаем последние сообщения (снизу), затем разворачиваем в хронологию
        let query = supabase
          .from('messages')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(80)

        if (selectedConversationId) {
          query = query.eq('conversation_id', selectedConversationId)
        } else {
          query = query.or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedOtherId.value}),and(sender_id.eq.${selectedOtherId.value},receiver_id.eq.${user.id})`)
        }

        const { data, error } = await query

        if (error) throw error

        const rows = (data || []).slice().reverse()
        messages.value = rows
        oldestLoadedAt.value = String(rows?.[0]?.created_at || '')
        convHasMore.value = rows.length >= 80
        showScrollDown.value = false

        await refreshReactionsForCurrentConversation()
        await scrollBottom()
      } finally {
        convLoading.value = false
      }
    }

    const jumpToLatestOnOpen = async () => {
      await scrollBottom()
      await nextTick()
      showScrollDown.value = !isAtBottom()
    }

    const markThreadAsRead = async (otherId) => {
      if (!otherId) return
      try {
        const idx = threads.value.findIndex((t) => t.otherUserId === otherId)
        if (idx !== -1) {
          const was = Number(threads.value[idx].unreadCount || 0)
          threads.value[idx] = {
            ...threads.value[idx],
            unread: false,
            unreadCount: 0,
            lastMessage: {
              ...threads.value[idx].lastMessage,
              read_at: threads.value[idx].lastMessage?.read_at || new Date().toISOString()
            }
          }
          if (was > 0) calcUnreadTotal()
        }

        await markConversationRead(otherId)
        calcUnreadTotal()
      } catch {
        // игнор
      }
    }

    const openThread = async (otherId) => {
      selectedOtherId.value = otherId
      router.replace({ name: 'messages', query: { with: otherId } })

      replyTo.value = null
      forwardTo.value = null
      peerTyping.value = false
      peerLastSeenAt.value = ''
      peerOnline.value = false

      // я перестаю "печатать" в прошлом чате
      await stopTyping()

      const conversationId = conversationIdFromThreadId(otherId)
      if (conversationId) {
        const title = threads.value.find((t) => t.otherUserId === otherId)?.title || 'Беседа'
        peer.value = {
          id: otherId,
          title,
          sub: 'групповая беседа',
          avatar: ''
        }
      } else {
        await loadPeer(otherId)
        await loadPeerPresence()
        await startTypingPresence()
      }
      await reloadConversation()
      await jumpToLatestOnOpen()
      if (!conversationId) {
        await markThreadAsRead(otherId)
      }
    }

    const focusChatInput = async () => {
      await nextTick()
      const input = chatInputRef.value
      if (!input) return
      try {
        input.focus()
        if (typeof input.setSelectionRange === 'function') {
          const len = String(draft.value || '').length
          input.setSelectionRange(len, len)
        }
      } catch {
        // ignore
      }
    }

    const setReply = async (m) => {
      if (!m) return
      const isMine = m.sender_id === myId.value
      const who = isMine ? 'себя' : (peer.value?.title || 'пользователя')
      const p = parseBody(m.body)
      const clean = String(p.text || '').trim()
      replyTo.value = {
        id: String(m.id || ''),
        who,
        text: clean.slice(0, 120)
      }
      await focusChatInput()
    }

    const clearReply = () => {
      replyTo.value = null
    }

    // ==========================
    // ✅ Typing (send)
    // ==========================
    const setTyping = async (isTyping) => {
      if (!typingFeatureEnabled.value) return
      const uid = myId.value
      const otherId = selectedOtherId.value
      if (!uid || !otherId) return

      try {
        const { error } = await supabase.from('typing').upsert(
          [
            {
              user_id: uid,
              other_id: otherId,
              is_typing: !!isTyping,
              updated_at: new Date().toISOString()
            }
          ],
          { onConflict: 'user_id,other_id' }
        )

        if (error && String(error?.message || '').toLowerCase().includes('404')) {
          typingFeatureEnabled.value = false
        }
      } catch (e) {
        const msg = String(e?.message || '').toLowerCase()
        if (msg.includes('404') || msg.includes('not found')) {
          typingFeatureEnabled.value = false
        }
      }
    }

    const onDraftInput = async () => {
      // отправляем typing только после паузы в наборе (debounce)
      if (!selectedOtherId.value) return

      if (typingSelfTimer) clearTimeout(typingSelfTimer)
      typingSelfTimer = setTimeout(async () => {
        await setTyping(true)

        if (typingSelfStopTimer) clearTimeout(typingSelfStopTimer)
        typingSelfStopTimer = setTimeout(async () => {
          await setTyping(false)
        }, 1200)
      }, 500)
    }

    const stopTyping = async () => {
      try {
        if (typingSelfTimer) clearTimeout(typingSelfTimer)
        typingSelfTimer = null
        if (typingSelfStopTimer) clearTimeout(typingSelfStopTimer)
        typingSelfStopTimer = null
        await setTyping(false)
      } catch {
        // ignore
      }
    }

    const startTypingPresence = async () => {
      if (typingPresenceTimer) clearInterval(typingPresenceTimer)
      typingPresenceTimer = null
      if (!selectedOtherId.value || !typingFeatureEnabled.value) return

      await setTyping(false)
      typingPresenceTimer = setInterval(() => {
        if (!selectedOtherId.value) return
        setTyping(false)
      }, 20000)
    }

    const stopTypingPresence = () => {
      if (typingPresenceTimer) clearInterval(typingPresenceTimer)
      typingPresenceTimer = null
    }

    // ==========================
    // Send message
    // ==========================
    const send = async () => {
      const otherId = selectedOtherId.value
      const text = String(draft.value || '').trim()
      if (!otherId || (!text && !forwardTo.value)) return
      const conversationId = conversationIdFromThreadId(otherId)

      sending.value = true
      try {
        await stopTyping()

        const finalBody = buildBodyWithMeta({ replyTo: replyTo.value, forwardTo: forwardTo.value, text })
        let data = null
        let error = null
        if (conversationId) {
          const response = await supabase
            .from('messages')
            .insert([{ sender_id: myId.value, receiver_id: null, conversation_id: conversationId, body: finalBody }])
            .select('*')
            .maybeSingle()
          data = response.data
          error = response.error
        } else {
          const response = await sendMessage(otherId, finalBody)
          data = response.data
          error = response.error
        }
        if (error) throw error

        draft.value = ''
        replyTo.value = null
        forwardTo.value = null

        if (data) {
          const appended = appendMessageUnique(data)
          if (appended) await scrollBottom()
          await refreshReactionsForCurrentConversation()

          const idx = threads.value.findIndex((t) => t.otherUserId === otherId)
          if (idx !== -1) {
            const t = threads.value[idx]
            const nextT = { ...t, lastMessage: data }
            const copy = [...threads.value]
            copy.splice(idx, 1)
            threads.value = [nextT, ...copy]
          }
        }
      } finally {
        sending.value = false
      }
    }


    const removeMessage = async (messageId) => {
      const id = String(messageId || '')
      if (!id) return
      try {
        const { error } = await deleteMessage(id)
        if (error) throw error

        const nextMessages = messages.value.filter((x) => String(x?.id || '') !== id)
        messages.value = nextMessages
        delete reactionsByMessage.value[id]
        messageMenuId.value = messageMenuId.value === id ? '' : messageMenuId.value

        if (selectedOtherId.value) {
          const idx = threads.value.findIndex((t) => t.otherUserId === selectedOtherId.value)
          if (idx !== -1) {
            const last = nextMessages[nextMessages.length - 1] || null
            threads.value[idx] = { ...threads.value[idx], lastMessage: last }
          }
        }
      } catch (e) {
        console.error('Delete message failed:', e)
      }
    }

    const onAvaErr = (t) => {
      const idx = threads.value.findIndex((x) => x.otherUserId === t.otherUserId)
      if (idx !== -1) threads.value[idx] = { ...threads.value[idx], avatar: '' }
    }

    const onPeerAvaErr = () => {
      if (!peer.value) return
      peer.value = { ...peer.value, avatar: '' }
    }

    const handleRealtimeInsert = async (m) => {
      if (!m) return
      const uid = myId.value
      if (!uid) return

      const otherId = m.sender_id === uid ? m.receiver_id : m.sender_id
      if (!otherId) return

      const idx = threads.value.findIndex((t) => t.otherUserId === otherId)
      let t = idx !== -1 ? threads.value[idx] : null

      if (!t) {
        const { data: u } = await getPublicUserById(otherId)
        t = {
          otherUserId: otherId,
          lastMessage: m,
          unread: false,
          unreadCount: 0,
          title: safeTitleFromUser(u),
          avatar: normalizeStoragePublicUrl(u?.image_path || '')
        }
      }

      const isIncoming = m.receiver_id === uid
      const isOpenNow = selectedOtherId.value === otherId
      const unread = isIncoming && !m.read_at && !isOpenNow
      const unreadCount = unread ? (Number(t?.unreadCount || 0) + 1) : 0
      if (unread) playIncomingSound()

      const nextT = {
        ...t,
        lastMessage: m,
        unread,
        unreadCount
      }

      const copy = [...threads.value]
      if (idx !== -1) copy.splice(idx, 1)
      threads.value = [nextT, ...copy]

      calcUnreadTotal()

      if (isOpenNow) {
        const appended = appendMessageUnique(m)
        if (appended) {
          if (isAtBottom()) {
            await scrollBottom()
          } else {
            showScrollDown.value = true
          }
          await refreshReactionsForCurrentConversation()
        }
        await markThreadAsRead(otherId)
      }
    }

    const setupRealtime = async () => {
      try {
        const { user } = await getUser()
        if (!user?.id) return
        myId.value = user.id

        const { channel, error } = await subscribeToMyMessages({
          onInsert: (m) => handleRealtimeInsert(m),
          onUpdate: () => {}
        })
        if (error) return
        rtChannel = channel

        reactionsChannel = supabase
          .channel(`rt:message_reactions:${user.id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, async (payload) => {
            const messageId = String(payload?.new?.message_id || payload?.old?.message_id || '')
            if (!messageId) return
            const hasMessage = messages.value.some((m) => String(m?.id || '') === messageId)
            if (!hasMessage) return
            await refreshReactionsForCurrentConversation()
          })
          .subscribe()
      } catch {
        // игнор
      }
    }

    // ==========================
    // ✅ Typing (realtime subscribe)
    // ==========================
    const setupTypingRealtime = async () => {
      try {
        if (!typingFeatureEnabled.value) return
        const uid = myId.value
        if (!uid) return

        // слушаем только строки, где other_id = мой id (то есть "мне печатают")
        typingChannel = supabase
          .channel(`typing-${uid}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'typing',
              filter: `other_id=eq.${uid}`
            },
            (payload) => {
              const row = payload?.new || payload?.old
              if (!row) return

              // печатает ли текущий собеседник
              if (String(row.user_id) !== String(selectedOtherId.value)) return

              const isOn = row.is_typing === true
              peerTyping.value = isOn
              peerLastSeenAt.value = String(row.updated_at || '')
              peerOnline.value = isOn
              if (!isOn) refreshPeerOnlineByTime()

              // авто-сброс, если кто-то "завис" в typing=true
              if (typingPeerTimer) clearTimeout(typingPeerTimer)
              if (isOn) {
                typingPeerTimer = setTimeout(() => {
                  peerTyping.value = false
                }, 2000)
              }
            }
          )
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              typingFeatureEnabled.value = false
            }
          })
      } catch {
        // ignore
      }
    }

    const teardownTypingRealtime = () => {
      try {
        if (typingChannel) supabase.removeChannel(typingChannel)
      } catch {
        // ignore
      }
      typingChannel = null
      if (typingPeerTimer) clearTimeout(typingPeerTimer)
      typingPeerTimer = null
      peerTyping.value = false
    }

    onMounted(async () => {
      const qWith = String(route.query.with || '').trim()
      if (qWith) selectedOtherId.value = qWith

      await reload()
      await setupRealtime()
      await setupTypingRealtime()

      if (peerStatusTickTimer) clearInterval(peerStatusTickTimer)
      peerStatusTickTimer = setInterval(() => {
        if (!peerTyping.value) refreshPeerOnlineByTime()
      }, 15000)

      if (selectedOtherId.value) {
        await loadPeer(selectedOtherId.value)
        await loadPeerPresence()
        await startTypingPresence()
        await reloadConversation()
        await jumpToLatestOnOpen()
        await markThreadAsRead(selectedOtherId.value)
      }
    })

    onBeforeUnmount(async () => {
      try {
        await stopTyping()
      } catch {}

      try {
        if (rtChannel && typeof rtChannel.unsubscribe === 'function') rtChannel.unsubscribe()
      } catch {
        // ignore
      }
      rtChannel = null

      try {
        if (reactionsChannel) supabase.removeChannel(reactionsChannel)
      } catch {
        // ignore
      }
      reactionsChannel = null

      teardownTypingRealtime()
      stopTypingPresence()

      if (typingSelfTimer) clearTimeout(typingSelfTimer)
      typingSelfTimer = null

      if (peerStatusTickTimer) clearInterval(peerStatusTickTimer)
      peerStatusTickTimer = null
    })

    const closeThread = async () => {
      await stopTyping()
      router.replace({ name: 'messages', query: {} })
      selectedOtherId.value = ''
      peer.value = null
      peerLastSeenAt.value = ''
      peerOnline.value = false
      messages.value = []
      reactionsByMessage.value = {}
      messageMenuId.value = ''
      oldestLoadedAt.value = ''
      convHasMore.value = true
      showScrollDown.value = false
      replyTo.value = null
      forwardTo.value = null
      peerTyping.value = false
      showPeerProfile.value = false
      stopTypingPresence()
    }

    const openPeerProfile = () => {
      const id = String(selectedOtherId.value || '').trim()
      if (!id) return
      showPeerProfile.value = true
    }

    const closePeerProfile = () => {
      showPeerProfile.value = false
    }

    watch(
      () => route.query.with,
      async (val) => {
        const nextId = String(val || '').trim()
        if (!nextId) {
          await stopTyping()
          selectedOtherId.value = ''
          peer.value = null
          peerLastSeenAt.value = ''
          peerOnline.value = false
          messages.value = []
          reactionsByMessage.value = {}
          messageMenuId.value = ''
          oldestLoadedAt.value = ''
          convHasMore.value = true
          showScrollDown.value = false
          replyTo.value = null
          forwardTo.value = null
          peerTyping.value = false
          showPeerProfile.value = false
          stopTypingPresence()
          return
        }
        if (nextId === selectedOtherId.value) return
        await stopTyping()
        selectedOtherId.value = nextId
        replyTo.value = null
        forwardTo.value = null
        peerTyping.value = false
        showPeerProfile.value = false
        peerLastSeenAt.value = ''
        peerOnline.value = false
        await loadPeer(nextId)
        await loadPeerPresence()
        await startTypingPresence()
        await reloadConversation()
        await jumpToLatestOnOpen()
        await markThreadAsRead(nextId)
      }
    )

    return {
      myId,
      authRequired,

      loading,
      convLoading,
      sending,

      threads,
      selectedOtherId,
      peer,
      peerStatusText,
      messages,
      reactionOptions,
      messageMenuId,
      draft,

      replyTo,
      forwardTo,
      forwardModalOpen,
      createConversationOpen,
      friendsLoading,
      creatingConversation,
      friendsForConversation,
      selectedConversationFriends,
      newConversationTitle,

      chatBodyRef,
      chatInputRef,
      showScrollDown,

      reload,
      openThread,
      send,
      reloadConversation,
      onChatScroll,
      scrollBottom,
      closeThread,
      openPeerProfile,
      showPeerProfile,
      closePeerProfile,

      setReply,
      clearReply,
      clearForward,
      closeForwardModal,
      pickForwardChat,
      openCreateConversationModal,
      closeCreateConversationModal,
      createConversationSubmit,
      removeMessage,
      getMessageReactions,
      myReactionByMessage,
      closeMessageMenu,
      openMessageMenuContext,
      pickReactionFromMenu,
      replyFromMenu,
      copyMessageFromMenu,
      forwardMessageFromMenu,
      deleteFromMenu,
      reactionAuthorsText,
      setMessageReaction,

      parseBody,
      threadPreview,

      formatTime,
      openProfileLogin,

      onAvaErr,
      onPeerAvaErr,

      // typing
      peerTyping,
      onDraftInput,
      stopTyping
    }
  }
}
</script>

<style scoped>
.mv {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 14px;
  height: calc(100vh - 120px);
  min-height: 0;
}

.mv-left,
.mv-right {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #efefef;
  border-radius: 18px;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}

.mv-right,
.mv-right.mv-right-open {
  overflow-x: hidden;
}

.mv-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 14px;
  border-bottom: 1px solid #efefef;
}
.mv-title {
  font-weight: 900;
  font-size: 16px;
}
.mv-create-conversation {
  margin-left: auto;
  height: 40px;
  border-radius: 14px;
  border: 1px solid #111;
  background: #111;
  color: #fff;
  cursor: pointer;
  font-weight: 800;
  padding: 0 14px;
}
.mv-create-conversation:hover {
  background: #222;
}
.mv-refresh {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  border: 1px solid #efefef;
  background: #fff;
  cursor: pointer;
  font-weight: 900;
}
.mv-refresh:disabled {
  opacity: 0.5;
  cursor: default;
}

/* На компьютерной версии убираем кнопки-иконки (как просили). На мобильной оставляем. */
@media (min-width: 981px) {
  .mv-refresh,
  .chat-head-btn {
    display: none !important;
  }
}

.mv-skel {
  padding: 12px;
  display: grid;
  gap: 10px;
}
.skel-row {
  height: 64px;
  border-radius: 16px;
  background: linear-gradient(90deg, #f3f3f3, #fafafa, #f3f3f3);
  background-size: 200% 100%;
  animation: sk 1.2s infinite linear;
}
@keyframes sk {
  0% { background-position: 0% 0; }
  100% { background-position: 200% 0; }
}

.mv-list {
  padding: 10px;
  display: grid;
  gap: 8px;
}

.thread {
  width: 100%;
  overflow: hidden;
  border: 1px solid #efefef;
  background: #fff;
  border-radius: 18px;
  padding: 10px;
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 10px;
  cursor: pointer;
  text-align: left;
  transition: transform 0.06s ease, background 0.15s ease, border-color 0.15s ease;
}
.thread:hover {
  background: #fafafa;
  border-color: #e9e9e9;
}
.thread:active {
  transform: scale(0.99);
}
.thread.active {
  border-color: #111;
}
.thread.unread {
  background: #f6f8ff;
  border-color: #dfe6ff;
}

.thread-ava {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  border: 1px solid #efefef;
  overflow: hidden;
  display: grid;
  place-items: center;
  position: relative;
  background: #fff;
}
.thread-ava-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thread-ava-ph {
  font-size: 18px;
}
.thread-dot {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #2a5bff;
  right: 6px;
  top: 6px;
  border: 2px solid #fff;
}

.thread-mid {
  min-width: 0;
  display: grid;
  gap: 6px;
}
.thread-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.thread-name {
  font-weight: 900;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.thread.unread .thread-name {
  font-weight: 950;
}
.thread-time {
  flex: 0 0 auto;
  font-size: 12px;
  opacity: 0.6;
  white-space: nowrap;
}

.thread-sub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.thread-preview {
  font-size: 13px;
  opacity: 0.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.thread.unread .thread-preview {
  opacity: 0.95;
  font-weight: 800;
}

.thread-pill {
  min-width: 22px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: #2a5bff;
  color: #fff;
  font-weight: 900;
  font-size: 12px;
  display: grid;
  place-items: center;
}

.mv-empty {
  padding: 18px;
}
.mv-empty-title {
  font-weight: 900;
  font-size: 16px;
  margin-bottom: 6px;
}
.mv-empty-text {
  opacity: 0.8;
  margin-bottom: 12px;
}
.mv-empty-btn {
  height: 42px;
  border-radius: 14px;
  border: none;
  background: #111;
  color: #fff;
  font-weight: 900;
  padding: 0 14px;
  cursor: pointer;
}

/* RIGHT */
.chat {
  position: relative;
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
}
.chat-head {
  padding: 12px 14px;
  border-bottom: 1px solid #efefef;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.chat-peer {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.chat-peer-ava {
  width: 44px;
  height: 44px;
  border-radius: 16px;
  border: 1px solid #efefef;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: #fff;
}
.chat-peer-ava-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.chat-peer-ava-ph {
  font-size: 16px;
}
.chat-peer-info {
  min-width: 0;
  cursor: pointer;
}
.chat-peer-name {
  font-weight: 950;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chat-peer-sub {
  font-size: 12px;
  opacity: 0.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 8px;
}
.typing-pill{
  opacity: 1;
  font-weight: 900;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(42,91,255,.10);
  border: 1px solid rgba(42,91,255,.18);
}

.chat-head-btn {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  border: 1px solid #efefef;
  background: #fff;
  cursor: pointer;
  font-weight: 900;
}
.chat-head-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.chat-head-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.chat-back {
  display: none;
  width: 40px;
  height: 40px;
  border-radius: 14px;
  border: 1px solid #efefef;
  background: #fff;
  cursor: pointer;
  font-weight: 900;
}

.chat-body {
  min-height: 0;
  padding: 14px;
  overflow: auto;
  overflow-x: hidden;
  background: #fbfbfb;
}
.scroll-down-btn {
  position: absolute;
  right: 18px;
  bottom: 82px;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  border: 1px solid #e8e8e8;
  background: #111;
  color: #fff;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  z-index: 2;
  box-shadow: 0 6px 18px rgba(0,0,0,.16);
}
.chat-skel {
  display: grid;
  gap: 10px;
}
.chat-skel-bubble {
  height: 38px;
  border-radius: 16px;
  background: linear-gradient(90deg, #f0f0f0, #fafafa, #f0f0f0);
  background-size: 200% 100%;
  animation: sk 1.2s infinite linear;
}
.chat-empty-inner {
  opacity: 0.7;
  font-weight: 800;
}

.chat-msgs {
  display: grid;
  gap: 8px;
}
.msg {
  display: flex;
  transition: transform 0.22s ease, opacity 0.22s ease;
}
.msg.mine,
.msg.their {
  justify-content: flex-start;
}

.msg-bubble {
  max-width: min(560px, 84%);
  overflow: visible;
  border-radius: 18px;
  padding: 10px 12px 8px;
  border: 1px solid #efefef;
  background: #fff;
  position: relative;
}

.msg.mine .msg-bubble {
  background: #e8f0ff;
  border-color: #c9dcff;
  color: #1d2a44;
}

.msg-bubble {
  pointer-events: auto;
}

.msg-menu {
  width: 220px;
  position: absolute;
  top: 38px;
  border: 1px solid #fff;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 10px 24px rgba(0,0,0,0.16);
  overflow: hidden;
  z-index: 4;
}

.msg-menu-stickers {
  width: 200px;
  box-sizing: border-box;
  display: flex;
  gap: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 8px;
  border-bottom: 1px solid #ececec;
}

.msg-menu-stickers::-webkit-scrollbar {
  display: none;
}

.msg.mine .msg-menu-stickers {
  border-bottom-color: rgba(255,255,255,0.16);
}

.msg-menu-sticker {
  flex: 0 0 auto;
  min-width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid #e8e8e8;
  background: #fff;
  cursor: pointer;
}

.msg-menu-item {
  width: 100%;
  border: none;
  border-top: 1px solid #f2f2f2;
  background: transparent;
  text-align: left;
  padding: 10px 12px;
  cursor: pointer;
}

.msg-menu-item:hover {
  background: #f7f7f7;
}

.msg-menu-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.msg-menu-item-danger {
  color: #d9534f;
}

.msg-menu-sticker.active {
  border-color: #2a5bff;
  box-shadow: inset 0 0 0 1px rgba(42,91,255,0.2);
}

/* reply preview inside message */
.msg-reply {
  border-left: 3px solid #2a5bff;
  padding-left: 10px;
  margin-bottom: 8px;
  opacity: 0.95;
}
.msg.mine .msg-reply {
  border-left-color: rgba(255,255,255,0.55);
}
.msg-reply-top {
  font-size: 12px;
  font-weight: 900;
  opacity: 0.85;
}
.msg-reply-who {
  font-weight: 950;
}
.msg-reply-text {
  font-size: 12px;
  opacity: 0.85;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.msg-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  font-size: 14px;
}

.msg-reactions {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.msg-reaction-chip {
  border: 1px solid #e8e8e8;
  background: #fff;
  border-radius: 999px;
  height: 28px;
  padding: 0 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}
.msg.mine .msg-reaction-chip {
  background: rgba(255,255,255,0.12);
  border-color: rgba(255,255,255,0.18);
  color: #000;
}
.msg-reaction-chip.mine {
  border-color: #2a5bff;
  box-shadow: inset 0 0 0 1px rgba(42,91,255,0.2);
}
.msg-reactions {
  position: relative;
  width: fit-content;
}

.msg-reactions-tooltip {
  position: absolute;
  left: 0;
  bottom: calc(100% + 6px);
  min-width: 200px;
  max-width: 280px;
  max-height: 140px;
  overflow-y: auto;
  border: 1px solid #fff;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 18px rgba(0,0,0,0.16);
  padding: 8px;
  display: none;
  z-index: 3;
}

.msg-reactions:hover .msg-reactions-tooltip {
  display: grid;
  gap: 4px;
}

.msg-reactions-tooltip-row {
  font-size: 12px;
  color: #333;
  overflow-wrap: anywhere;
}
.msg-meta {
  margin-top: 6px;
  font-size: 11px;
  opacity: 0.75;
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
}
.msg.mine .msg-meta {
  opacity: 0.7;
}
.msg-check {
  font-weight: 900;
  letter-spacing: -1px;
}
.msg-check.read {
  color: #2a5bff;
}

.msg-list-move,
.msg-list-enter-active,
.msg-list-leave-active {
  transition: transform 0.22s ease, opacity 0.22s ease;
}

.msg-list-enter-from,
.msg-list-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

.msg-list-leave-active {
  position: absolute;
  width: min(86%, 760px);
}

.chat-foot {
  padding: 12px 14px;
  border-top: 1px solid #efefef;
  background: #fff;
  display: grid;
  gap: 10px;
}

/* reply bar above input */
.reply-bar {
  border: 1px solid #efefef;
  border-radius: 16px;
  padding: 10px 10px;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px;
  background: #fafafa;
}
.reply-bar-title {
  font-weight: 950;
  font-size: 12px;
}
.reply-bar-snippet {
  font-size: 12px;
  opacity: 0.75;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.reply-bar-close {
  width: 34px;
  height: 34px;
  border-radius: 14px;
  border: 1px solid #efefef;
  background: #fff;
  cursor: pointer;
  font-weight: 900;
}

.chat-input-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
}

.chat-input {
  height: 44px;
  border-radius: 14px;
  border: 1px solid #efefef;
  padding: 0 12px;
  outline: none;
}
.chat-input:focus {
  border-color: #e2e2e2;
}
.chat-send {
  height: 44px;
  border-radius: 14px;
  border: none;
  background: #111;
  color: #fff;
  font-weight: 900;
  padding: 0 14px;
  cursor: pointer;
}
.chat-send:disabled {
  opacity: 0.6;
  cursor: default;
}

.chat-empty {
  padding: 18px;
}
.chat-empty-title {
  font-weight: 900;
  font-size: 16px;
  margin-bottom: 6px;
}
.chat-empty-text {
  opacity: 0.8;
}


.msg-forward {
  margin-top: 8px;
  border: 1px solid rgba(42, 91, 255, 0.25);
  background: rgba(42, 91, 255, 0.06);
  border-radius: 12px;
  padding: 8px;
}
.msg-forward-top {
  font-size: 12px;
  font-weight: 900;
}
.msg-forward-who {
  color: #2a5bff;
}
.msg-forward-chat {
  font-size: 11px;
  opacity: 0.8;
  margin-top: 2px;
}
.msg-forward-text {
  margin-top: 4px;
  font-size: 13px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.reply-bar-forward {
  border-color: rgba(42, 91, 255, 0.3);
  background: rgba(42, 91, 255, 0.06);
}

.fwd-modal {
  position: fixed;
  inset: 0;
  z-index: 120;
  background: rgba(0,0,0,0.35);
  display: grid;
  place-items: center;
  padding: 14px;
}
.fwd-modal-card {
  width: min(520px, 100%);
  max-height: min(82vh, 720px);
  background: #fff;
  border-radius: 16px;
  border: 1px solid #efefef;
  box-shadow: 0 18px 48px rgba(0,0,0,0.22);
  display: grid;
  grid-template-rows: auto 1fr;
}
.fwd-modal-head {
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.fwd-modal-title { font-size: 16px; font-weight: 950; }
.fwd-modal-close {
  width: 34px; height: 34px; border-radius: 12px; border: 1px solid #efefef; background: #fff; cursor: pointer;
}
.fwd-modal-empty { padding: 16px; opacity: 0.75; }
.fwd-modal-list { padding: 10px; overflow: auto; display: grid; gap: 8px; }
.fwd-chat {
  border: 1px solid #efefef;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  padding: 8px;
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 10px;
  align-items: center;
}
.fwd-chat:hover { border-color: #dfe6ff; background: #f8faff; }
.fwd-chat-ava { width: 40px; height: 40px; border-radius: 12px; object-fit: cover; background: #f1f1f1; }
.fwd-chat-ava-ph { display: grid; place-items: center; }
.fwd-chat-title { font-size: 14px; font-weight: 900; }
.fwd-chat-sub { font-size: 12px; opacity: 0.72; }

.conv-friends-list {
  padding: 10px;
  overflow: auto;
  display: grid;
  gap: 8px;
}
.conv-friend-row {
  border: 1px solid #efefef;
  border-radius: 12px;
  padding: 8px;
  display: grid;
  grid-template-columns: 20px 40px 1fr;
  gap: 10px;
  align-items: center;
}
.conv-friend-name { font-weight: 800; font-size: 14px; }
.conv-create-btn {
  margin: 10px;
}

@media (max-width: 980px) {
  .mv {
    grid-template-columns: 1fr;
    height: auto;
    min-height: calc(100vh - 120px);
    position: relative;
  }

  .mv-left {
    width: 100%;
  }

  .mv-right {
    display: none;
  }

  .mv-right.mv-right-open {
    display: flex;
    position: fixed;
    inset: 74px 8px 88px 8px;
    z-index: 40;
    box-shadow: 0 12px 34px rgba(0,0,0,.18);
  }

  .chat-back {
    display: inline-grid;
    place-items: center;
  }

}
</style>
