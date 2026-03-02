<template>
  <div class="up-overlay" @click.self="goBack">
    <div class="up-modal" role="dialog" aria-modal="true" aria-label="Профиль пользователя">
      <div class="up-top">
        <div class="up-title">Профиль</div>
        <button class="up-x" type="button" @click="goBack" aria-label="Закрыть">✕</button>
      </div>

      <div class="up-body" v-if="loading">Загрузка профиля…</div>
      <div class="up-body up-error" v-else-if="error">{{ error }}</div>
      <div class="up-body" v-else-if="!profile">Пользователь не найден.</div>

      <div v-else class="up-body">
        <div class="up-head">
          <div class="up-avatar">
            <img v-if="profile.image_path" :src="profile.image_path" alt="avatar" />
            <span v-else>{{ initial }}</span>
          </div>

          <div class="up-main">
            <h1 class="up-name">{{ displayName(profile) }}</h1>
            <div class="up-sub">@{{ profile.username || 'без username' }}</div>
            <div class="up-sub">Общих друзей: {{ mutualFriendsCount }}</div>
            <div class="up-tags">
              <span class="tag" :class="profile?.It_business ? 'biz' : 'plain'">
                {{ profile?.It_business ? 'Business' : 'Пользователь' }}
              </span>
              <span v-if="profile.about" class="tag soft">{{ profile.about }}</span>
            </div>
          </div>
        </div>

        <div class="up-actions">
          <button class="btn" @click="openChat" v-if="!isMe">Написать</button>
          <button class="btn ghost" @click="toggleFriend" v-if="!isMe">{{ friendBtnText }}</button>
        </div>

        <div class="tabs">
          <button type="button" class="tab" :class="{ on: activeTab === 'about' }" @click="activeTab = 'about'">О пользователе</button>
          <button type="button" class="tab" :class="{ on: activeTab === 'friends' }" @click="activeTab = 'friends'">Друзья</button>
          <button type="button" class="tab" :class="{ on: activeTab === 'events' }" @click="activeTab = 'events'">Мероприятия</button>
        </div>

        <div v-if="activeTab === 'about'" class="up-block">
          <div class="up-field" v-if="profile.first_name || profile.last_name">Имя: {{ displayName(profile) }}</div>
          <div class="up-field" v-if="profile.gender">Пол: {{ profile.gender }}</div>
          <div class="up-field" v-if="profile.birth_day">Дата рождения: {{ profile.birth_day }}</div>
          <div class="up-field" v-if="profile.phone">Телефон: {{ profile.phone }}</div>
          <div class="up-field" v-if="profile.email">Email: {{ profile.email }}</div>
          <div class="up-field" v-if="profile.about">О себе: {{ profile.about }}</div>
        </div>

        <div v-else-if="activeTab === 'friends'" class="up-block">
          <div v-if="friends.length === 0" class="up-sub">Пока нет друзей</div>
          <div v-else class="friends-list">
            <button class="friend-row" v-for="f in friends" :key="f.id" @click="goProfile(f.id)">
              <span>{{ displayName(f) }}</span>
              <small>@{{ f.username || '—' }}</small>
            </button>
          </div>
        </div>

        <div v-else class="up-block">
          <div v-if="eventsLoading" class="up-sub">Загрузка мероприятий…</div>
          <div v-else-if="publishedEvents.length === 0" class="up-sub">Пользователь пока не публиковал мероприятия</div>
          <div v-else class="events-grid">
            <article class="event-card" v-for="ev in publishedEvents" :key="ev.id" @click="openEvent(ev.id)">
              <h3>{{ ev.title || 'Без названия' }}</h3>
              <p>{{ ev.description || 'Без описания' }}</p>
              <small>{{ formatDate(ev.date_time_event) }}</small>
            </article>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSupabase } from '@/composables/useSupabase'

export default {
  name: 'UserProfileView',
  props: {
    userId: {
      type: String,
      default: ''
    }
  },
  emits: ['close'],
  setup(props, { emit }) {
    const route = useRoute()
    const router = useRouter()
    const {
      getUser,
      getPublicUserById,
      getFriendships,
      getAcceptedFriendsOf,
      sendFriendRequest,
      removeFriendOrRequest,
      acceptFriendRequest,
      getOrganizerEvents
    } = useSupabase()

    const loading = ref(false)
    const eventsLoading = ref(false)
    const error = ref('')
    const myId = ref('')
    const profile = ref(null)
    const friends = ref([])
    const publishedEvents = ref([])
    const relation = ref('none')
    const mutualFriendsCount = ref(0)
    const activeTab = ref('about')

    const isMe = computed(() => String(profile.value?.id || '') === String(myId.value || ''))
    const initial = computed(() => (displayName(profile.value)[0] || 'П').toUpperCase())

    const displayName = (u) => {
      const full = `${String(u?.first_name || '').trim()} ${String(u?.last_name || '').trim()}`.trim()
      return full || u?.email || 'Пользователь'
    }

    const formatDate = (v) => {
      if (!v) return 'Дата не указана'
      const d = new Date(v)
      if (Number.isNaN(d.getTime())) return String(v)
      return d.toLocaleString('ru-RU')
    }

    const buildRelationIndex = (rows = []) => {
      const idx = new Map()
      for (const f of rows) {
        const isRequesterMe = f.requester_id === myId.value
        const otherId = isRequesterMe ? f.addressee_id : f.requester_id
        if (!otherId) continue
        if (f.status === 'accepted') idx.set(otherId, 'friend')
        else if (f.status === 'pending') idx.set(otherId, isRequesterMe ? 'outgoing' : 'incoming')
      }
      return idx
    }

    const loadEvents = async (targetId) => {
      eventsLoading.value = true
      try {
        const { data } = await getOrganizerEvents(targetId, { publishedOnly: true })
        publishedEvents.value = data || []
      } finally {
        eventsLoading.value = false
      }
    }

    const targetId = computed(() => {
      const fromProp = String(props.userId || '').trim()
      if (fromProp) return fromProp
      return String(route.params.id || '').trim()
    })

    const load = async () => {
      loading.value = true
      error.value = ''
      try {
        const profileId = targetId.value
        if (!profileId) {
          profile.value = null
          friends.value = []
          publishedEvents.value = []
          relation.value = 'none'
          mutualFriendsCount.value = 0
          return
        }

        const { user } = await getUser()
        myId.value = user?.id || ''

        const { data: p } = await getPublicUserById(profileId)
        profile.value = p
        if (!p?.id) return

        await loadEvents(profileId)

        const { data: friendIds } = await getAcceptedFriendsOf(profileId)
        const friendUsers = await Promise.all(friendIds.map(async (id) => (await getPublicUserById(id)).data))
        friends.value = friendUsers.filter((x) => x?.id)

        if (myId.value) {
          const { data: rows } = await getFriendships()
          const idx = buildRelationIndex(rows || [])
          relation.value = idx.get(profileId) || 'none'

          const myFriends = new Set([...idx.entries()].filter((x) => x[1] === 'friend').map((x) => x[0]))
          let common = 0
          for (const fid of friendIds) if (myFriends.has(fid)) common += 1
          mutualFriendsCount.value = common
        }
      } catch (e) {
        error.value = String(e?.message || e)
      } finally {
        loading.value = false
      }
    }

    const friendBtnText = computed(() => {
      if (relation.value === 'friend') return 'Удалить из друзей'
      if (relation.value === 'incoming') return 'Принять заявку'
      if (relation.value === 'outgoing') return 'Заявка отправлена'
      return 'Добавить в друзья'
    })

    const toggleFriend = async () => {
      const uid = profile.value?.id
      if (!uid) return
      if (relation.value === 'incoming') await acceptFriendRequest(uid)
      else if (relation.value === 'friend' || relation.value === 'outgoing') await removeFriendOrRequest(uid)
      else await sendFriendRequest(uid)
      await load()
    }

    const openChat = () => router.push({ name: 'messages', query: { with: profile.value?.id } })
    const goProfile = (id) => router.push({ name: 'user-profile', params: { id } })
    const openEvent = (id) => router.push({ name: 'event', params: { id } })
    const goBack = () => {
      if (targetId.value && String(props.userId || '').trim()) {
        emit('close')
        return
      }
      if (window.history.length > 1) router.back()
      else router.push({ name: 'home' })
    }

    watch(targetId, load)
    onMounted(load)

    return {
      loading,
      eventsLoading,
      error,
      profile,
      friends,
      publishedEvents,
      mutualFriendsCount,
      friendBtnText,
      isMe,
      initial,
      activeTab,
      displayName,
      formatDate,
      toggleFriend,
      openChat,
      goProfile,
      openEvent,
      goBack
    }
  }
}
</script>

<style scoped>
.up-overlay{position:fixed;inset:0;background:rgba(19,18,23,.5);z-index:80;display:grid;place-items:center;padding:14px}
.up-modal{width:min(980px,100%);max-height:calc(100vh - 28px);overflow:auto;background:#fff;border-radius:18px;border:1px solid #efefef;box-shadow:0 20px 50px rgba(0,0,0,.2)}
.up-top{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #efefef;position:sticky;top:0;background:#fff;z-index:2}
.up-title{font-weight:900}.up-x{border:1px solid #efefef;background:#fff;border-radius:10px;padding:6px 9px;cursor:pointer}
.up-body{padding:16px}
.up-head{display:flex;gap:14px;align-items:center}
.up-main{min-width:0}
.up-avatar{width:88px;height:88px;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,#8a75e3,#2f2752);display:grid;place-items:center;color:#fff;font-weight:900;font-size:28px}
.up-avatar img{width:100%;height:100%;object-fit:cover}
.up-name{margin:0}
.up-sub{opacity:.75}
.up-tags{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
.tag{padding:5px 10px;border-radius:999px;font-size:12px;font-weight:800}
.tag.biz{background:rgba(59,130,246,.13);color:#1d4ed8}
.tag.plain{background:rgba(15,23,42,.08)}
.tag.soft{background:rgba(138,117,227,.11);color:#4c3d8f}
.up-actions{display:flex;gap:8px;margin:14px 0;flex-wrap:wrap}
.btn{border:0;border-radius:12px;padding:10px 14px;background:#8A75E3;color:#fff;font-weight:800;cursor:pointer}
.ghost{background:#f2efff;color:#3a3174}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.tab{border:1px solid #efefef;background:#fff;border-radius:999px;padding:8px 12px;cursor:pointer;font-weight:800}
.tab.on{background:#f1ecff;border-color:#d9d0ff;color:#463b89}
.up-field{margin-bottom:8px}
.friends-list{display:grid;gap:8px}
.friend-row{text-align:left;border:1px solid #ece7ff;border-radius:12px;padding:10px;background:#fff;cursor:pointer}
.events-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.event-card{border:1px solid #efefef;border-radius:14px;padding:10px;background:#fff;cursor:pointer}
.event-card h3{margin:0 0 6px;font-size:14px}.event-card p{margin:0 0 8px;font-size:12px;opacity:.8}
.up-error{color:#b00020}
</style>
