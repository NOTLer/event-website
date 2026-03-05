<template>
  <div id="app">
    <header class="header">
      <div class="header-container">
        <div class="header-left">
          <div ref="searchBoxRef" class="search-container">
            <div class="search-icon">🔍</div>
            <input
              v-model="searchTerm"
              type="text"
              placeholder="Поиск людей: ФИО или @username"
              class="search-input"
              @focus="onSearchFocus"
            />

            <div v-if="showPeopleDropdown" class="people-dropdown">
              <div v-if="peopleSearchLoading" class="people-dropdown-state">Ищу пользователей…</div>
              <div v-else-if="peopleResults.length === 0" class="people-dropdown-state">Никого не найдено</div>

              <div v-else class="people-list">
                <div v-for="u in peopleResults" :key="u.id" class="people-item">
                  <div class="people-avatar-wrap">
                    <img v-if="u.avatar" :src="u.avatar" class="people-avatar" alt="avatar" />
                    <div v-else class="people-avatar-ph">👤</div>
                  </div>

                  <div class="people-main">
                    <div class="people-name">{{ u.title }}</div>
                    <div class="people-username">@{{ u.username || '—' }}</div>
                    <div class="people-mutual">{{ formatMutualFriendsText(u.mutualFriendsCount) }}</div>
                  </div>

                  <div class="people-actions">
                    <button class="people-btn" type="button" @click="messageUser(u)">Написать</button>
                    <button class="people-btn" type="button" @click="openUserProfile(u)">Профиль</button>
                    <button
                      class="people-btn people-btn-primary"
                      type="button"
                      :disabled="u.friendActionDisabled"
                      @click="addFriendFromSearch(u)"
                    >
                      {{ u.friendActionLabel }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="header-right">
          <button class="profile-button desktop-only" @click="openProfileModal" aria-label="Профиль">
            <img
              v-if="showHeaderAvatar"
              class="header-avatar"
              :src="headerAvatarUrl"
              alt="avatar"
              @error="onHeaderImgError"
            />
            <div v-else class="header-placeholder">👤</div>
          </button>

          <div class="build-version" :title="versionTitle">{{ versionLabel }}</div>
        </div>
      </div>
    </header>

    <div class="layout">
      <!-- DESKTOP SIDEBAR (в мобилке превращается в bottom-bar через CSS) -->
      <aside class="sidebar" aria-label="Разделы">
        <!-- 1: Лента -->
        <button class="nav-item" :class="{ active: isActiveRoute('home') }" type="button" @click="go('home')">
          <span class="ni-ico">📰</span>
          <span class="ni-txt">Лента</span>
        </button>

        <!-- 2: Друзья (поиск друзей) -->
        <button class="nav-item" :class="{ active: isActiveRoute('friends') }" type="button" @click="go('friends')">
          <span class="ni-ico">👥</span>
          <span class="ni-txt">Друзья</span>
        </button>

        <!-- 3: Сообщения (центральная на мобилке) -->
        <button class="nav-item nav-item-messages" :class="{ active: isActiveRoute('messages') }" type="button" @click="go('messages')">
          <span class="ni-ico ni-ico-wrap ni-ico-messages">
            <span class="ni-ico-inner">💬</span>
            <span v-if="unreadCount > 0" class="badge" aria-label="Непрочитанные сообщения">{{ badgeText }}</span>
          </span>
          <span class="ni-txt">Сообщения</span>
        </button>

        <!-- 4: Меню (в мобилке между сообщениями и профилем) -->
        <!-- Меню нужно только на мобильной версии -->
        <button v-if="showMobileMenuButton" class="nav-item nav-item-menu mobile-only" type="button" @click="openMenu">
          <span class="ni-ico">☰</span>
          <span class="ni-txt">Меню</span>
        </button>

        <!-- 5: Профиль (в мобилке справа) -->
        <button class="nav-item" type="button" @click="openProfileOrAuth">
          <span class="ni-ico ni-ico-profile">
            <img
              v-if="showHeaderAvatar"
              class="ni-avatar"
              :src="headerAvatarUrl"
              alt="avatar"
              @error="onHeaderImgError"
            />
            <span v-else>👤</span>
          </span>
          <span class="ni-txt">Профиль</span>
        </button>
      </aside>

      <main class="content">
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </main>
    </div>

    <!-- MENU DRAWER -->
    <teleport to="body">
      <div v-if="menuOpen && showMobileMenuButton" class="menu-root" @keydown.esc="closeMenu" tabindex="-1">
        <div class="overlay" @click="closeMenu"></div>

        <aside class="menu-drawer" role="dialog" aria-modal="true" aria-label="Меню">
          <div class="menu-head">
            <div class="menu-title">Меню</div>
            <button class="close-btn" @click="closeMenu" aria-label="Закрыть">✕</button>
          </div>

          <div class="menu-body">
            <button class="menu-item" @click="go('home'); closeMenu()">📰 Лента</button>
            <button class="menu-item" @click="go('friends'); closeMenu()">👥 Друзья</button>

            <button class="menu-item menu-item-with-badge" @click="go('messages'); closeMenu()">
              <span class="mib-left">💬 Сообщения</span>
              <span v-if="unreadCount > 0" class="menu-badge">{{ badgeText }}</span>
            </button>

            <!-- будущие разделы добавляй сюда -->
            <div class="menu-note">Здесь будут остальные разделы позже</div>

            <button class="menu-item" @click="openProfileOrAuth">👤 Профиль / Вход</button>
          </div>

          <div class="menu-foot">
            <button class="apply-btn" @click="closeMenu">Закрыть</button>
          </div>
        </aside>
      </div>
    </teleport>

    <!-- ✅ ВСЕ МОДАЛКИ В BODY -->
    <teleport to="body">
      <AuthModal
        v-if="showAuth"
        :telegram-bot-username="telegramBotUsername"
        @close="showAuth = false"
        @google="loginGoogle"
        @telegram="handleTelegramLogin"
      />
    </teleport>

    <teleport to="body">
      <ProfileModal
        v-if="showProfileEdit"
        :profile="profile"
        :telegram-link="telegramLink"
        :saving="saving"
        :categories="categories"
        @close="showProfileEdit = false"
        @save="saveProfile"
        @pick-avatar="onPickedAvatar"
        @logout="logout"
        @open-create-event="openCreateEvent"
      />
    </teleport>

    <teleport to="body">
      <CreateEventModal
        v-if="showCreateEvent"
        :open="showCreateEvent"
        :categories="categories"
        :create-business-event="createBusinessEvent"
        @close="showCreateEvent = false"
        @created="onCreatedEvent"
      />
    </teleport>

    <teleport to="body">
      <AvatarCropModal
        v-if="showAvatarCrop && cropSourceAvatar"
        :file="cropSourceAvatar"
        @close="onAvatarCropClose"
        @done="onAvatarCropDone"
      />
    </teleport>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthModal from './components/AuthModal.vue'
import ProfileModal from './components/ProfileModal.vue'
import CreateEventModal from './components/CreateEventModal.vue'
import AvatarCropModal from './components/AvatarCropModal.vue'
import { useSupabase, supabase, toAvatarPublicUrl } from './composables/useSupabase.js'
import { useUnreadMessages } from './composables/unreadMessages.js'

const pickUserAvatar = (user) => {
  const custom = toAvatarPublicUrl(user?.image_path)
  if (custom) return custom
  return toAvatarPublicUrl(user?.avatar_url)
}

const userTitle = (u) => {
  if (!u) return 'Пользователь'
  const fn = String(u.first_name || '').trim()
  const ln = String(u.last_name || '').trim()
  const full = `${fn} ${ln}`.trim()
  const uname = String(u.username || '').trim()
  const email = String(u.email || '').trim()
  return full || uname || email || 'Пользователь'
}

export default {
  name: 'App',
  components: { AuthModal, ProfileModal, CreateEventModal, AvatarCropModal },
  setup() {
    const router = useRouter()
    const route = useRoute()

    const {
      getSession,
      getUser,
      signInWithGoogle,
      signOut,
      ensurePublicUserRow,
      getMyPublicUser,
      updateMyPublicUser,
      uploadAvatar,
      linkTelegramViaEdgeFunction,
      getMyTelegramLink,
      getMyUnreadMessagesCount,
      subscribeToMyMessages,
      getCategories,
      createBusinessEvent,
      searchUsers,
      getFriendships,
      sendFriendRequest,
      acceptFriendRequest,
      removeFriendOrRequest
    } = useSupabase()

    const { unreadCount, setUnreadCount } = useUnreadMessages()
    let rtMessagesChannel = null

    const telegramBotUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || ''
    const appVersion = import.meta.env.VITE_APP_VERSION || 'dev'
    const appCommitName = import.meta.env.VITE_APP_COMMIT_NAME || ''

    const searchTerm = ref('')
    const searchBoxRef = ref(null)
    const peopleResults = ref([])
    const peopleSearchLoading = ref(false)
    const showPeopleDropdown = ref(false)
    const myFriendsSet = ref(new Set())
    const friendshipIndex = ref(new Map())
    const mutualFriendsCache = new Map()
    let searchDebounce = null

    const session = ref(null)
    const profile = ref(null)
    const telegramLink = ref(null)

    const categories = ref([])
    const saving = ref(false)

    const showAuth = ref(false)
    const showProfileEdit = ref(false)
    const showCreateEvent = ref(false)

    const showAvatarCrop = ref(false)
    const cropSourceAvatar = ref(null)

    const menuOpen = ref(false)

    const headerAvatarUrl = computed(() => pickUserAvatar(profile.value))
    const showHeaderAvatar = ref(false)

    const badgeText = computed(() => {
      const n = Number(unreadCount.value || 0)
      if (n <= 0) return ''
      if (n > 99) return '99+'
      return String(n)
    })

    const versionLabel = computed(() => {
      if (appCommitName) return appCommitName
      return `v${appVersion}`
    })

    const versionTitle = computed(() => {
      if (appCommitName) return `Коммит: ${appCommitName}`
      return `Версия сборки: ${appVersion}`
    })

    const isMobileChatFocused = computed(() => {
      return route.name === 'messages' && String(route.query.with || '').trim().length > 0
    })

    const showMobileMenuButton = computed(() => !isMobileChatFocused.value)

    const onHeaderImgError = () => {
      showHeaderAvatar.value = false
    }

    const loadSessionAndProfile = async () => {
      const { session: s } = await getSession()
      session.value = s || null

      const { user } = await getUser()
      if (user) {
        await loadMyFriendsSet()
        await ensurePublicUserRow(user)
        const { data } = await getMyPublicUser()
        profile.value = data || null

        const { data: tg } = await getMyTelegramLink()
        telegramLink.value = tg || null

        const { count } = await getMyUnreadMessagesCount()
        setUnreadCount(count || 0)
      } else {
        myFriendsSet.value = new Set()
        friendshipIndex.value = new Map()
        profile.value = null
        telegramLink.value = null
        setUnreadCount(0)
      }

      showHeaderAvatar.value = !!(session.value && headerAvatarUrl.value)
    }

    const loadCategories = async () => {
      const { data } = await getCategories()
      categories.value = data || []
    }

    const loadAcceptedFriendsFor = async (uid) => {
      const id = String(uid || '').trim()
      if (!id) return new Set()
      const { data } = await supabase
        .from('friendships')
        .select('requester_id,addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${id},addressee_id.eq.${id}`)

      const set = new Set()
      for (const row of (data || [])) {
        const requester = String(row?.requester_id || '')
        const addressee = String(row?.addressee_id || '')
        if (requester === id && addressee) set.add(addressee)
        if (addressee === id && requester) set.add(requester)
      }
      return set
    }

    const loadMyFriendsSet = async () => {
      const { data } = await getFriendships()
      const me = String(profile.value?.id || session.value?.user?.id || '')
      const set = new Set()
      const idx = new Map()
      for (const row of (data || [])) {
        const requester = String(row?.requester_id || '')
        const addressee = String(row?.addressee_id || '')
        const isRequesterMe = requester === me
        const otherId = isRequesterMe ? addressee : requester
        if (!otherId) continue

        if (row?.status === 'accepted') {
          set.add(otherId)
          idx.set(otherId, 'friend')
        } else if (row?.status === 'pending') {
          idx.set(otherId, isRequesterMe ? 'outgoing' : 'incoming')
        }
      }
      myFriendsSet.value = set
      friendshipIndex.value = idx
      mutualFriendsCache.clear()
    }

    const friendshipState = (userId) => {
      const id = String(userId || '')
      const me = String(profile.value?.id || session.value?.user?.id || '')
      if (!id || !me) return 'guest'
      return friendshipIndex.value.get(id) || 'none'
    }

    const getMutualFriendsCount = async (otherId) => {
      const id = String(otherId || '').trim()
      if (!id || !session.value?.user?.id) return null
      if (mutualFriendsCache.has(id)) return mutualFriendsCache.get(id)
      const theirSet = await loadAcceptedFriendsFor(id)
      let common = 0
      for (const myFriendId of myFriendsSet.value) {
        if (theirSet.has(myFriendId)) common++
      }
      mutualFriendsCache.set(id, common)
      return common
    }

    const enrichUsersForDropdown = async (list) => {
      const out = (list || []).map((u) => {
        const state = friendshipState(u.id)
        const actionLabel = state === 'friend'
          ? 'В друзьях'
          : state === 'incoming'
            ? 'Принять заявку'
            : state === 'outgoing'
              ? 'Заявка отправлена'
              : 'Добавить в друзья'
        return {
          ...u,
          title: userTitle(u),
          avatar: pickUserAvatar(u),
          friendActionLabel: actionLabel,
          friendActionDisabled: state === 'friend',
          mutualFriendsCount: null
        }
      })

      await Promise.all(
        out.map(async (u, idx) => {
          const count = await getMutualFriendsCount(u.id)
          out[idx].mutualFriendsCount = count
        })
      )

      return out
    }

    const runPeopleSearch = async () => {
      const raw = String(searchTerm.value || '').trim()
      if (!raw) {
        peopleResults.value = []
        showPeopleDropdown.value = false
        return
      }

      const usernameOnly = raw.startsWith('@')
      const pureQuery = usernameOnly ? raw.slice(1).trim() : raw
      if (!pureQuery) {
        peopleResults.value = []
        showPeopleDropdown.value = false
        return
      }

      peopleSearchLoading.value = true
      showPeopleDropdown.value = true
      try {
        if (session.value?.user?.id) await loadMyFriendsSet()

        const seed = usernameOnly ? pureQuery : pureQuery.split(/\s+/)[0]
        const { data } = await searchUsers(seed, 8, { usernameOnly })
        const myId = String(profile.value?.id || session.value?.user?.id || '')
        const qLower = pureQuery.toLowerCase()

        let base = (data || []).filter((u) => String(u?.id || '') !== myId)
        base = base.filter((u) => {
          const full = `${String(u?.first_name || '').trim()} ${String(u?.last_name || '').trim()}`.trim().toLowerCase()
          const uname = String(u?.username || '').toLowerCase()
          if (usernameOnly) return uname.startsWith(qLower)
          return full.includes(qLower) || uname.includes(qLower)
        })

        peopleResults.value = await enrichUsersForDropdown(base)
      } finally {
        peopleSearchLoading.value = false
      }
    }

    const onSearchFocus = () => {
      if (searchTerm.value.trim()) showPeopleDropdown.value = true
    }

    const onGlobalClick = (e) => {
      const root = searchBoxRef.value
      if (!root) return
      if (!root.contains(e.target)) showPeopleDropdown.value = false
    }

    const formatMutualFriendsText = (count) => {
      if (count === null || count === undefined) return 'Общие друзья: —'
      return `Общие друзья: ${count}`
    }

    const messageUser = (u) => {
      const otherId = String(u?.id || '').trim()
      if (!otherId) return
      if (!session.value?.user?.id) {
        showAuth.value = true
        return
      }
      showPeopleDropdown.value = false
      searchTerm.value = ''
      router.push({ name: 'messages', query: { with: otherId } })
    }

    const openUserProfile = (u) => {
      const otherId = String(u?.id || '').trim()
      if (!otherId) return
      showPeopleDropdown.value = false
      searchTerm.value = ''
      router.push({ name: 'user-profile', params: { id: otherId } })
    }

    const addFriendFromSearch = async (u) => {
      const otherId = String(u?.id || '').trim()
      if (!otherId) return
      if (!session.value?.user?.id) {
        showAuth.value = true
        return
      }
      const state = friendshipState(otherId)
      const action = state === 'incoming'
        ? acceptFriendRequest(otherId)
        : state === 'outgoing'
          ? removeFriendOrRequest(otherId)
          : sendFriendRequest(otherId)

      const { error } = await action
      if (error) return
      await loadMyFriendsSet()
      mutualFriendsCache.delete(otherId)
      await runPeopleSearch()
    }

    const openMenu = () => {
      menuOpen.value = true
      nextTick(() => {})
    }
    const closeMenu = () => {
      menuOpen.value = false
    }

    const openProfileModal = async () => {
      const { session: s } = await getSession()
      if (!s) {
        showAuth.value = true
        return
      }
      showProfileEdit.value = true
    }

    const openProfileOrAuth = () => {
      if (!session.value) showAuth.value = true
      else showProfileEdit.value = true
      closeMenu()
    }

    const loginGoogle = async () => {
      await signInWithGoogle()
      await loadSessionAndProfile()
      showAuth.value = false
    }

    const handleTelegramLogin = async (payload) => {
      const { session: s } = await getSession()
      if (!s) return
      await linkTelegramViaEdgeFunction(payload)
      await loadSessionAndProfile()
      showAuth.value = false
    }

    const logout = async () => {
      await signOut()
      showProfileEdit.value = false
      showCreateEvent.value = false
      await loadSessionAndProfile()
    }

    const saveProfile = async (form) => {
      saving.value = true
      try {
        const payload = {
          ...form,
          description: String(form?.description || '').trim().slice(0, 200) || null
        }
        const { data, error } = await updateMyPublicUser(payload)
        if (error) throw error
        if (data) {
          profile.value = data
        }
      } finally {
        saving.value = false
      }
    }

    const onPickedAvatar = (fileOrBlob) => {
      if (!fileOrBlob) return
      cropSourceAvatar.value = fileOrBlob
      showAvatarCrop.value = true
    }

    const onAvatarCropClose = () => {
      showAvatarCrop.value = false
      cropSourceAvatar.value = null
    }

    const onAvatarCropDone = async (croppedFile) => {
      if (!croppedFile) return
      saving.value = true
      try {
        const { data, error } = await uploadAvatar(croppedFile)
        if (error) throw error
        const { data: nextProfile } = await updateMyPublicUser({ image_path: data?.publicUrl || data?.url || profile.value?.image_path })
        if (nextProfile) profile.value = nextProfile
      } finally {
        saving.value = false
        onAvatarCropClose()
      }
    }

    const openCreateEvent = () => {
      showCreateEvent.value = true
    }

    const onCreatedEvent = async () => {
      showCreateEvent.value = false
    }

    const go = (name) => router.push({ name })
    const isActiveRoute = (name) => route.name === name

    const onOpenProfileEvent = () => openProfileModal()

    onMounted(async () => {
      window.addEventListener('open-profile', onOpenProfileEvent)
      window.addEventListener('click', onGlobalClick)
      await loadCategories()
      await loadSessionAndProfile()

      const { channel } = await subscribeToMyMessages({
        onInsert: async () => {
          const { count } = await getMyUnreadMessagesCount()
          setUnreadCount(count || 0)
        },
        onUpdate: async () => {
          const { count } = await getMyUnreadMessagesCount()
          setUnreadCount(count || 0)
        }
      })
      rtMessagesChannel = channel
    })

    const teardown = () => {
      window.removeEventListener('open-profile', onOpenProfileEvent)
      window.removeEventListener('click', onGlobalClick)
      if (searchDebounce) clearTimeout(searchDebounce)
      try {
        if (rtMessagesChannel?.unsubscribe) rtMessagesChannel.unsubscribe()
      } catch {
        // ignore
      }
      rtMessagesChannel = null
    }

    onBeforeUnmount(() => teardown())

    watch(
      () => headerAvatarUrl.value,
      () => {
        showHeaderAvatar.value = !!(session.value && headerAvatarUrl.value)
      }
    )

    watch(
      () => searchTerm.value,
      () => {
        if (searchDebounce) clearTimeout(searchDebounce)
        searchDebounce = setTimeout(() => {
          runPeopleSearch()
        }, 220)
      }
    )


    watch(
      () => isMobileChatFocused.value,
      (focused) => {
        if (focused) closeMenu()
      }
    )

    return {
      telegramBotUsername,
      appVersion,
      versionLabel,
      versionTitle,
      searchTerm,
      searchBoxRef,
      peopleResults,
      peopleSearchLoading,
      showPeopleDropdown,
      onSearchFocus,
      messageUser,
      openUserProfile,
      addFriendFromSearch,
      formatMutualFriendsText,

      showAuth,
      showProfileEdit,
      showCreateEvent,
      showAvatarCrop,
      cropSourceAvatar,

      session,
      profile,
      telegramLink,
      categories,
      saving,

      headerAvatarUrl,
      showHeaderAvatar,
      onHeaderImgError,

      menuOpen,
      openMenu,
      closeMenu,

      openProfileModal,
      openProfileOrAuth,
      loginGoogle,
      handleTelegramLogin,
      logout,
      saveProfile,
      onPickedAvatar,
      onAvatarCropClose,
      onAvatarCropDone,
      openCreateEvent,
      onCreatedEvent,

      go,
      isActiveRoute,
      createBusinessEvent,

      unreadCount,
      badgeText,
      showMobileMenuButton
    }
  }
}
</script>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: #fff;
  border-bottom: 1px solid #efefef;
}
.header-container {
  max-width: 1300px;
  margin: 0 auto;
  padding: 12px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.header-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}
.build-version {
  margin-left: auto;
  font-size: 12px;
  font-weight: 800;
  color: #6f6f7a;
  background: #f4f3ff;
  border: 1px solid #e8e4ff;
  border-radius: 999px;
  padding: 6px 10px;
  white-space: nowrap;
}
.menu-button {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid #efefef;
  background: #fff;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.menu-icon {
  width: 18px;
  height: 14px;
  display: grid;
  gap: 3px;
}
.menu-icon span {
  display: block;
  height: 2px;
  border-radius: 999px;
  background: #111;
  opacity: 0.9;
}
.search-container {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
}
.search-icon {
  position: absolute;
  left: 12px;
  font-size: 14px;
  opacity: 0.6;
}
.search-input {
  height: 42px;
  width: min(520px, 52vw);
  border-radius: 14px;
  border: 1px solid #efefef;
  padding: 0 14px 0 36px;
  outline: none;
}
.search-input:focus {
  border-color: #e2e2e2;
}
.people-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: min(620px, 88vw);
  max-height: min(68vh, 560px);
  overflow: auto;
  background: #fff;
  border: 1px solid #efefef;
  border-radius: 16px;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.14);
  z-index: 45;
  padding: 8px;
}
.people-dropdown-state {
  padding: 14px;
  font-weight: 700;
  opacity: 0.72;
}
.people-list {
  display: grid;
  gap: 8px;
}
.people-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid #f1f1f1;
}
.people-avatar-wrap {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #efefef;
  background: #f7f7f7;
  display: grid;
  place-items: center;
}
.people-avatar { width: 100%; height: 100%; object-fit: cover; }
.people-avatar-ph { font-size: 18px; }
.people-main { min-width: 0; }
.people-name { font-weight: 900; }
.people-username,
.people-mutual {
  font-size: 12px;
  opacity: 0.75;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.people-actions {
  display: grid;
  gap: 6px;
}
.people-btn {
  height: 32px;
  border-radius: 10px;
  border: 1px solid #e8e8e8;
  background: #fff;
  padding: 0 10px;
  font-weight: 800;
  cursor: pointer;
}
.people-btn-primary {
  background: #111;
  color: #fff;
  border-color: #111;
}
.people-btn:disabled {
  opacity: 0.55;
  cursor: default;
}
.profile-button {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid #efefef;
  background: #fff;
  cursor: pointer;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.header-avatar {
  width: 135%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  border-radius: 50%;
  display: block;
  transform: none;
}
.header-placeholder {
  font-size: 18px;
}

.layout {
  max-width: 1300px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 18px;
  padding: 18px;
}
.sidebar {
  position: sticky;
  top: 72px;
  align-self: start;
  border: 1px solid #efefef;
  border-radius: 18px;
  background: #fff;
  padding: 10px;
  height: fit-content;
}
.nav-item {
  width: 100%;
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 10px;
  align-items: center;
  padding: 10px 10px;
  border-radius: 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
}
.nav-item:hover {
  background: #f7f7f7;
}
.nav-item.active {
  background: #111;
  color: #fff;
}
.ni-ico {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: #f3f3f3;
  font-size: 18px;
}
.ni-ico-profile {
  overflow: hidden;
}
.ni-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.nav-item.active .ni-ico {
  background: rgba(255, 255, 255, 0.14);
}
.ni-txt {
  font-weight: 600;
  font-size: 14px;
}

/* messages icon with badge */
.ni-ico-wrap {
  position: relative;
}
.ni-ico-inner {
  display: inline-block;
  line-height: 1;
}
.badge {
  position: absolute;
  top: -6px;
  right: -8px;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: #ff2f2f;
  color: #fff;
  font-weight: 800;
  font-size: 11px;
  display: grid;
  place-items: center;
  border: 2px solid #fff;
}

.content {
  min-width: 0;
}

/* MENU */
.menu-root {
  position: fixed;
  inset: 0;
  z-index: 50;
}
.overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
}
.menu-drawer {
  position: absolute;
  top: 0;
  left: 0;
  width: min(380px, 86vw);
  height: 100%;
  background: #fff;
  border-right: 1px solid #efefef;
  display: grid;
  grid-template-rows: auto 1fr auto;
}
.menu-head {
  padding: 14px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #efefef;
}
.menu-title {
  font-weight: 900;
}
.close-btn {
  width: 38px;
  height: 38px;
  border-radius: 14px;
  border: 1px solid #efefef;
  background: #fff;
  cursor: pointer;
}
.menu-body {
  padding: 14px;
  display: grid;
  gap: 10px;
}
.menu-item {
  width: 100%;
  padding: 12px 12px;
  border-radius: 14px;
  border: 1px solid #efefef;
  background: #fff;
  cursor: pointer;
  text-align: left;
  font-weight: 700;
}
.menu-item:hover {
  background: #f7f7f7;
}
.menu-note {
  font-size: 12px;
  opacity: 0.6;
  padding: 0 4px;
}
.menu-foot {
  padding: 14px;
  border-top: 1px solid #efefef;
}
.apply-btn {
  width: 100%;
  height: 44px;
  border-radius: 14px;
  border: none;
  background: #111;
  color: #fff;
  font-weight: 900;
  cursor: pointer;
}

.menu-item-with-badge {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.mib-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.menu-badge {
  min-width: 22px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: #ff2f2f;
  color: #fff;
  font-weight: 900;
  font-size: 12px;
  display: grid;
  place-items: center;
}

/* Показываем некоторые элементы только на мобильной версии */
.mobile-only {
  display: none !important;
}

/* ===== MOBILE BOTTOM BAR ===== */

@media (max-width: 760px) {
  .people-item {
    grid-template-columns: auto 1fr;
  }
  .people-actions {
    grid-column: 1 / -1;
    grid-template-columns: 1fr 1fr;
  }
  .search-input {
    width: min(540px, 76vw);
  }
}
@media (max-width: 980px) {
  .mobile-only {
    display: inline-flex !important;
  }
  .layout {
    grid-template-columns: 1fr;
    padding-left: 10px;
    padding-right: 10px;
    padding-bottom: 92px; /* место под нижнюю панель */
  }

  .desktop-only {
    display: none !important;
  }

  .build-version {
    display: none;
  }

  .sidebar {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: 12px;
    top: auto;
    z-index: 30;

    border-radius: 22px;
    padding: 10px;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;

    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  }

  .nav-item {
    grid-template-columns: 1fr;
    justify-items: center;
    padding: 9px 4px;
    border-radius: 18px;
  }

  .ni-txt {
    display: none;
  }

  .ni-ico {
    width: 46px;
    height: 46px;
    border-radius: 18px;
    font-size: 20px;
  }

  /* центральная кнопка сообщения — чуть выделяем */
  .nav-item-messages .ni-ico {
    width: 54px;
    height: 54px;
    border-radius: 20px;
    font-size: 22px;
    transform: translateY(-10px);
    border: 1px solid #efefef;
    background: #fff;
    box-shadow: 0 10px 22px rgba(0, 0, 0, 0.08);
  }
  .nav-item.active .nav-item-messages .ni-ico {
    background: #fff;
  }
  .badge {
    top: -8px;
    right: -10px;
    border-color: #fff;
  }
}
</style>
