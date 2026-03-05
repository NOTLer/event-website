<template>
  <div class="page">
    <div class="container">
      <button class="back" type="button" @click="goBack">← Назад</button>

      <div v-if="loading" class="state">
        <div class="spinner"></div>
        <div>Загрузка мероприятия…</div>
      </div>

      <div v-else-if="error" class="state error">
        <div class="error-title">Ошибка</div>
        <div class="error-sub">{{ error }}</div>
        <button class="retry" type="button" @click="load(routeId)">Повторить</button>
      </div>

      <template v-else>
        <div class="card">
          <div class="media">
            <div v-if="!photoUrls.length" class="photo-skel"></div>

            <!-- ✅ MAIN carousel -->
            <div
              v-else
              ref="mainCarouselEl"
              class="main-carousel"
              @scroll.passive="onMainScroll"
              aria-label="Фотографии мероприятия"
            >
              <button
                v-for="(url, idx) in photoUrls"
                :key="url + '_' + idx"
                class="main-slide"
                type="button"
                @click="openPhoto(url)"
                aria-label="Открыть фото"
              >
                <ProgressiveImage class="photo" :src="url" alt="event" fit="cover" />
              </button>
            </div>

            <!-- ✅ стрелки для ПК -->
            <div v-if="photoUrls.length > 1" class="main-arrows" aria-hidden="true">
              <button class="main-arrow left" type="button" @click="prevPhoto" aria-label="Предыдущее фото">‹</button>
              <button class="main-arrow right" type="button" @click="nextPhoto" aria-label="Следующее фото">›</button>
            </div>

            <div v-if="event?.is_online" class="badge-online">🟢 Онлайн</div>

            <div v-if="photoUrls.length > 1" class="main-dots" aria-hidden="true">
              <span
                v-for="(_, i) in photoUrls"
                :key="'md_' + i"
                class="main-dot"
                :class="{ on: i === activePhotoIndex }"
              />
            </div>

            <!-- ✅ thumbnails -->
            <div v-if="photoUrls.length > 1" class="thumbs">
              <button
                v-for="(url, idx) in photoUrls"
                :key="'th_' + url + '_' + idx"
                class="thumb"
                :class="{ active: idx === activePhotoIndex }"
                type="button"
                @click="scrollToIndex(idx)"
                aria-label="Переключить фото"
              >
                <img :src="url" alt="thumb" />
              </button>
            </div>
          </div>

          <div class="info">
            <div class="title-row">
              <div class="title">{{ event?.title }}</div>

              <div class="actions">
                <button
                  class="icon-btn"
                  type="button"
                  :class="{ active: isFavorite }"
                  @click="toggleFavorite()"
                  aria-label="В избранное"
                  title="В избранное"
                >
                  <span v-if="isFavorite">❤️</span>
                  <span v-else>🤍</span>
                </button>

                <button class="icon-btn" type="button" @click="shareEvent" aria-label="Поделиться" title="Поделиться">
                  🔗
                </button>
              </div>
            </div>

            <div v-if="copied" class="copied">✅ Ссылка скопирована</div>

            <div class="meta">
              <div class="m"><span>📅</span>{{ formatDate(event?.date_time_event) }}</div>
              <div class="m"><span>📍</span>{{ event?.address || '—' }}</div>
              <div class="m"><span>👤</span>{{ event?.organizer || '—' }}</div>
              <div class="m"><span>💰</span>{{ priceText }}</div>
            </div>

            <div v-if="event?.description" class="desc">{{ event.description }}</div>
          </div>
        </div>

        <div v-if="signupUrl" class="signup-wrap">
          <a
            class="signup-btn"
            :href="signupUrl"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Записаться на мероприятие"
          >
            ✨ Записаться
          </a>
        </div>

        <!-- Организатор / Другие мероприятия -->
        <div class="tabs-wrap">
          <div class="tabs">
            <button class="tab" :class="{ active: tab === 'org' }" type="button" @click="tab = 'org'">
              Профиль организатора
            </button>
            <button class="tab" :class="{ active: tab === 'other' }" type="button" @click="tab = 'other'">
              Похожие мероприятия
            </button>
          </div>

          <div class="panel" v-if="tab === 'org'">
            <div v-if="orgLoading" class="mini-state">Загрузка…</div>

            <div v-else class="org-card">
              <div class="org-avatar">
                <img v-if="orgAvatar" :src="orgAvatar" alt="avatar" @error="orgAvatar = ''" />
                <div v-else class="org-fallback">{{ orgLetter }}</div>
              </div>

              <div class="org-info">
                <div class="org-name">{{ orgName }}</div>
                <div class="org-sub">
                  <span class="pill" v-if="organizerProfile?.It_business">Business</span>
                  <span class="pill" v-else>Аккаунт</span>
                </div>
              </div>

              <div class="org-actions">
                <button
                  v-if="canMessageOrganizer"
                  class="msg-org"
                  type="button"
                  @click="messageOrganizer"
                  aria-label="Написать организатору"
                  title="Написать"
                >
                  💬
                </button>

                <button class="go-org" type="button" @click="goOrganizer" :disabled="!event?.user_id">
                  Перейти →
                </button>
              </div>
            </div>
          </div>

          <div class="panel" v-else>
            <div v-if="otherLoading" class="mini-state">Загрузка…</div>

            <div v-else-if="otherEventsForCards.length === 0" class="mini-state">Похожих мероприятий пока нет</div>

            <div v-else class="events-shell">
              <TransitionGroup name="list" tag="div" class="events-list">
                <EventCard
                  v-for="e in otherEventsForCards"
                  :key="e.id"
                  :event="e"
                  :photos="getPhotosForEvent(e.id)"
                  :photos-loading="isPhotosLoading(e.id)"
                  :category-map="categoryMap"
                  :compact="true"
                  :is-favorite="favoriteIds.has(Number(e.id))"
                  @open-photo="openPhoto"
                  @toggle-favorite="onToggleFavorite"
                  @need-photos="onNeedEventPhotos"
                />
              </TransitionGroup>
            </div>
          </div>
        </div>

        <EventPhotoModal v-if="photoModalUrl" :url="photoModalUrl" @close="photoModalUrl = ''" />
      </template>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EventPhotoModal from '@/components/EventPhotoModal.vue'
import EventCard from '@/components/EventCard.vue'
import ProgressiveImage from '@/components/ProgressiveImage.vue'
import { useSupabase } from '@/composables/useSupabase'
import { getEventsCache } from '@/composables/eventsCache'

const normalizeStoragePublicUrl = (url) => {
  if (!url || typeof url !== 'string') return ''
  const u = url.trim()
  if (!u) return ''
  if (u.includes('/storage/v1/object/public/')) return u
  if (u.includes('/storage/v1/object/')) return u.replace('/storage/v1/object/', '/storage/v1/object/public/')
  return u
}

const copyText = async (text) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {}
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', 'true')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

const makeFavKey = (userId) => (userId ? `fav_event_ids_v1_${userId}` : 'fav_event_ids_v1_guest')
const loadFavLS = (key) => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.map((x) => Number(x)).filter((n) => Number.isFinite(n)) : []
  } catch {
    return []
  }
}
const saveFavLS = (key, idsSet) => {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(idsSet)))
  } catch {}
}

export default {
  name: 'EventView',
  components: { EventPhotoModal, EventCard, ProgressiveImage },
  setup() {
    const route = useRoute()
    const router = useRouter()

    const api = useSupabase()
    const { getEventById, getEventPhotos, getPublicUserById, getUser } = api
    const getOrganizerEvents = api.getOrganizerEvents
    const getEvents = api.getEvents

    const loading = ref(true)
    const error = ref('')

    const event = ref(null)
    const eventPhotos = ref([])

    const photoModalUrl = ref('')

    const mainCarouselEl = ref(null)
    const activePhotoIndex = ref(0)
    const _raf = ref(null)

    const tab = ref('org')

    const organizerProfile = ref(null)
    const orgAvatar = ref('')
    const orgLoading = ref(false)

    const otherLoading = ref(false)
    const cachedAllEvents = ref(null)
    const cachedPhotosByEventId = ref(null)
    const photosLoadingByEventId = ref({})
    const categoryMap = ref({})

    const userId = ref(null)
    const favoriteIds = ref(new Set())
    const favKey = ref(makeFavKey(null))
    const copied = ref(false)

    const routeId = computed(() => route.params.id)

    const photoUrls = computed(() => {
      const list = Array.isArray(eventPhotos.value) ? eventPhotos.value : []
      return list.map((p) => String(p?.photo_url || '').trim()).filter(Boolean)
    })

    const signupUrl = computed(() => {
      const raw = String(event.value?.signup_url || '').trim()
      if (!raw) return ''
      if (/^https?:\/\//i.test(raw)) return raw
      return `https://${raw}`
    })

    const priceText = computed(() => {
      if (!event.value) return '—'
      if (event.value.is_free) return 'Бесплатно'
      const p = Number(event.value.price ?? 0)
      if (!Number.isFinite(p) || p <= 0) return 'Бесплатно'
      return `${p} ₽`
    })

    const orgName = computed(() => {
      const p = organizerProfile.value
      const fn = (p?.first_name || '').trim()
      const ln = (p?.last_name || '').trim()
      const full = `${fn} ${ln}`.trim()
      return full || (p?.email || 'Пользователь')
    })
    const orgLetter = computed(() => (orgName.value || 'П')[0].toUpperCase())

    const formatDate = (v) => {
      if (!v) return '—'
      const d = new Date(v)
      if (Number.isNaN(d.getTime())) return String(v)
      return d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    }

    const openPhoto = (url) => {
      photoModalUrl.value = url || ''
    }

    const buildEventUrl = (id) => {
      let base = import.meta.env.BASE_URL || '/'
      if (base === './' || base === '.') base = '/'
      base = base.replace(/\/+$/, '/')
      return `${window.location.origin}${base}event/${id}`
    }

    const shareEvent = async () => {
      if (!event.value?.id) return
      const url = buildEventUrl(event.value.id)
      const title = event.value?.title || 'Мероприятие'

      copied.value = false

      try {
        if (navigator.share) {
          await navigator.share({ title, url })
          return
        }
      } catch {}

      const ok = await copyText(url)
      if (ok) {
        copied.value = true
        setTimeout(() => (copied.value = false), 1200)
      } else {
        window.prompt('Скопируй ссылку:', url)
      }
    }

    const onToggleFavorite = ({ eventId, makeFavorite }) => {
      const idNum = Number(eventId)
      if (!Number.isFinite(idNum)) return

      const next = new Set(favoriteIds.value)
      if (makeFavorite) next.add(idNum)
      else next.delete(idNum)
      favoriteIds.value = next
      saveFavLS(favKey.value, favoriteIds.value)
    }

    const isFavorite = computed(() => {
      const idNum = Number(event.value?.id)
      if (!Number.isFinite(idNum)) return false
      return favoriteIds.value.has(idNum)
    })

    const toggleFavorite = () => {
      const idNum = Number(event.value?.id)
      if (!Number.isFinite(idNum)) return
      onToggleFavorite({ eventId: idNum, makeFavorite: !favoriteIds.value.has(idNum) })
    }

    const getPhotosForEvent = (eventId) => {
      const idNum = Number(eventId)
      if (!Number.isFinite(idNum)) return []
      const map = cachedPhotosByEventId.value
      if (map && map[idNum]) return map[idNum]
      return []
    }

    const isPhotosLoading = (eventId) => {
      const idNum = Number(eventId)
      if (!Number.isFinite(idNum)) return false
      return !!photosLoadingByEventId.value?.[idNum]
    }

    const eventCategoryKeys = computed(() => {
      const raw = event.value?.selectCategory
      const list = Array.isArray(raw) ? raw : String(raw || '').split(/[,;|]+/g)
      return new Set(
        list
          .map((x) => String(x || '').trim().toLowerCase())
          .filter(Boolean)
      )
    })

    const categoryOverlapScore = (candidate) => {
      const own = eventCategoryKeys.value
      if (!own.size) return 0
      const raw = candidate?.selectCategory
      const list = Array.isArray(raw) ? raw : String(raw || '').split(/[,;|]+/g)
      let score = 0
      for (const c of list.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean)) {
        if (own.has(c)) score += 1
      }
      return score
    }

    const otherEventsForCards = computed(() => {
      const currentId = Number(event.value?.id)
      const source = Array.isArray(cachedAllEvents.value) ? cachedAllEvents.value : []
      if (!source.length) return []

      return source
        .filter((e) => Number(e?.id) !== currentId)
        .filter((e) => e?.is_published !== false)
        .map((e) => ({ event: e, score: categoryOverlapScore(e) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.event)
    })


    const goBack = () => {
      router.push({ name: 'home', query: { tab: 'feed' } })
    }

    const goOrganizer = () => {
      if (!event.value?.user_id) return
      router.push({ path: `/organizer/${event.value.user_id}` })
    }

    const loadFromCache = () => {
      const cache = getEventsCache()
      cachedAllEvents.value = Array.isArray(cache?.events) ? cache.events : null
      cachedPhotosByEventId.value = cache?.photosByEventId || null
      categoryMap.value = cache?.categoryMap || {}
    }

    const loadUserFavs = async () => {
      const { user } = await getUser()
      userId.value = user?.id || null
      favKey.value = makeFavKey(userId.value)
      favoriteIds.value = new Set(loadFavLS(favKey.value))
    }

    const canMessageOrganizer = computed(() => {
      const my = String(userId.value || '')
      const other = String(event.value?.user_id || '')
      return Boolean(my && other && my !== other)
    })

    const messageOrganizer = () => {
      const other = String(event.value?.user_id || '').trim()
      if (!other) return
      router.push({ path: '/messages', query: { with: other } })
    }

    const loadOrganizerBlock = async () => {
      if (!event.value?.user_id) return
      orgLoading.value = true
      try {
        const { data: p } = await getPublicUserById(String(event.value.user_id))
        organizerProfile.value = p || null
        const a = (p?.avatar_url || '').trim()
        const b = (p?.image_path || '').trim()
        orgAvatar.value = normalizeStoragePublicUrl(a || b)
      } finally {
        orgLoading.value = false
      }
    }

    const ensurePhotosForEventIds = async (idsRaw) => {
      const ids = (Array.isArray(idsRaw) ? idsRaw : [])
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n))

      if (!ids.length) return

      // какие уже есть
      const map = cachedPhotosByEventId.value && typeof cachedPhotosByEventId.value === 'object' ? cachedPhotosByEventId.value : {}
      const missing = ids.filter((id) => !Array.isArray(map[id]) || map[id].length === 0)
      if (!missing.length) return

      const { data: ph, error: e } = await getEventPhotos(missing)
      if (e) return

      const next = { ...map }
      for (const row of (ph || [])) {
        const eid = Number(row?.event_id)
        if (!Number.isFinite(eid)) continue
        if (!next[eid]) next[eid] = []
        next[eid].push(row)
      }
      cachedPhotosByEventId.value = next
    }

    const onNeedEventPhotos = async ({ eventId } = {}) => {
      const id = Number(eventId)
      if (!Number.isFinite(id)) return
      if (isPhotosLoading(id)) return
      if (Array.isArray(cachedPhotosByEventId.value?.[id]) && cachedPhotosByEventId.value[id].length > 0) return

      photosLoadingByEventId.value = { ...photosLoadingByEventId.value, [id]: true }
      try {
        await ensurePhotosForEventIds([id])
      } finally {
        photosLoadingByEventId.value = { ...photosLoadingByEventId.value, [id]: false }
      }
    }

    const loadOtherFallbackIfNoCache = async () => {
      if (Array.isArray(cachedAllEvents.value) && cachedAllEvents.value.length) return

      otherLoading.value = true
      try {
        if (typeof getEvents === 'function') {
          const { data } = await getEvents()
          cachedAllEvents.value = Array.isArray(data) ? data : []
        } else if (event.value?.user_id && typeof getOrganizerEvents === 'function') {
          const { data } = await getOrganizerEvents(String(event.value.user_id), {
            publishedOnly: true,
            excludeEventId: event.value.id
          })
          cachedAllEvents.value = Array.isArray(data) ? data : []
        } else {
          cachedAllEvents.value = []
        }

      } finally {
        otherLoading.value = false
      }
    }

    const onMainScroll = () => {
      try {
        const el = mainCarouselEl.value
        if (!el) return

        if (_raf.value) cancelAnimationFrame(_raf.value)
        _raf.value = requestAnimationFrame(() => {
          const w = el.clientWidth || 1
          const i = Math.round(el.scrollLeft / w)
          const clamped = Math.max(0, Math.min(i, photoUrls.value.length - 1))
          activePhotoIndex.value = clamped
        })
      } catch {}
    }

    const scrollToIndex = (idx) => {
      try {
        const el = mainCarouselEl.value
        if (!el) return
        const i = Number(idx)
        if (!Number.isFinite(i)) return
        const w = el.clientWidth || 1
        el.scrollTo({ left: w * i, behavior: 'smooth' })
        activePhotoIndex.value = Math.max(0, Math.min(i, photoUrls.value.length - 1))
      } catch {}
    }

    const prevPhoto = () => {
      const i = Math.max(0, activePhotoIndex.value - 1)
      scrollToIndex(i)
    }
    const nextPhoto = () => {
      const i = Math.min(photoUrls.value.length - 1, activePhotoIndex.value + 1)
      scrollToIndex(i)
    }

    const resetGallery = () => {
      activePhotoIndex.value = 0
      try {
        const el = mainCarouselEl.value
        if (el) el.scrollLeft = 0
      } catch {}
    }

    const load = async (idRaw) => {
      loading.value = true
      error.value = ''
      event.value = null
      eventPhotos.value = []
      organizerProfile.value = null
      orgAvatar.value = ''
      tab.value = 'org'
      resetGallery()

      try {
        const id = Number(idRaw)
        if (!Number.isFinite(id)) throw new Error('Некорректный id мероприятия')

        loadFromCache()
        await loadUserFavs()

        const fromCache =
          Array.isArray(cachedAllEvents.value) && cachedAllEvents.value.length
            ? cachedAllEvents.value.find((e) => Number(e?.id) === id)
            : null

        if (fromCache) {
          event.value = fromCache
          const ph = cachedPhotosByEventId.value && cachedPhotosByEventId.value[id]
          eventPhotos.value = Array.isArray(ph) ? ph.filter((x) => x?.photo_url) : []
        } else {
          const { data: e, error: e1 } = await getEventById(id)
          if (e1) throw e1
          if (!e) throw new Error('Мероприятие не найдено')
          event.value = e

          const { data: ph, error: e2 } = await getEventPhotos([id])
          if (e2) throw e2
          eventPhotos.value = (ph || []).filter((x) => x?.photo_url)
        }

        await loadOrganizerBlock()
        await loadOtherFallbackIfNoCache()
      } catch (e) {
        error.value = String(e?.message || e)
      } finally {
        loading.value = false
      }
    }

    onMounted(() => load(routeId.value))

    watch(
      () => routeId.value,
      (v) => {
        if (v) load(v)
      }
    )

    watch(
      () => photoUrls.value.join('|'),
      () => resetGallery()
    )

    return {
      routeId,
      loading,
      error,
      event,
      eventPhotos,
      photoUrls,

      photoModalUrl,
      openPhoto,

      mainCarouselEl,
      activePhotoIndex,
      onMainScroll,
      scrollToIndex,
      prevPhoto,
      nextPhoto,

      signupUrl,
      priceText,
      formatDate,

      tab,
      organizerProfile,
      orgAvatar,
      orgName,
      orgLetter,
      orgLoading,
      goBack,
      goOrganizer,

      canMessageOrganizer,
      messageOrganizer,

      otherLoading,
      otherEventsForCards,
      getPhotosForEvent,
      isPhotosLoading,
      onNeedEventPhotos,
      categoryMap,

      favoriteIds,
      isFavorite,
      toggleFavorite,
      onToggleFavorite,

      shareEvent,
      copied,

      load
    }
  }
}
</script>

<style scoped>
.page { padding: 12px 0; }
.container { max-width: 1100px; margin: 0 auto; padding: 0 12px; }

.back{
  border: 1px solid #efefef; background: #fff; border-radius: 14px;
  padding: 10px 12px; font-weight: 900; cursor: pointer;
  margin-bottom: 10px;
}

.state{
  padding: 18px; border: 1px solid #efefef; border-radius: 18px; background:#fff;
  display:flex; align-items:center; gap: 10px; font-weight: 800;
}
.state.error{ color:#d9534f; display:block; }
.error-title{ font-weight: 900; margin-bottom: 6px; }
.error-sub{ opacity: .85; margin-bottom: 10px; }
.retry{
  border: 1px solid #efefef;
  background: #fafafa;
  border-radius: 14px;
  padding: 10px 12px;
  font-weight: 900;
  cursor: pointer;
}

.spinner{
  width: 18px; height: 18px; border-radius: 999px;
  border: 2px solid #eaeaea; border-top-color: #8a75e3;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.card{
  border: 1px solid #efefef; background:#fff; border-radius: 18px;
  overflow:hidden; display:grid; grid-template-columns: 420px 1fr;
}
@media (max-width: 900px){
  .card{ grid-template-columns: 1fr; }
}

.media{ position: relative; background:#f2f2f2; padding-bottom: 10px; }
.photo-skel{ width:100%; height: 280px; background:#f0f0f0; }

.main-carousel{
  width:100%;
  height: 280px;
  display:flex;
  overflow-x:auto;
  overflow-y:hidden;
  scroll-snap-type:x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.main-carousel::-webkit-scrollbar{ display:none; }

.main-slide{
  flex: 0 0 100%;
  width: 100%;
  height: 280px;
  scroll-snap-align: start;
  border:none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}
.photo{
  width:100%;
  height: 280px;
  object-fit: cover;
  display:block;
}

/* ✅ arrows for PC */
.main-arrows{
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.main-arrow{
  pointer-events: auto;
  position: absolute;
  top: 140px;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.55);
  background: rgba(0,0,0,.25);
  backdrop-filter: blur(6px);
  color:#fff;
  font-size: 26px;
  font-weight: 900;
  cursor: pointer;
  display: none;
  align-items:center;
  justify-content:center;
}
.main-arrow.left{ left: 10px; }
.main-arrow.right{ right: 10px; }
@media (min-width: 900px){
  .media:hover .main-arrow{ display:inline-flex; }
}
@media (max-width: 899px){
  .main-arrow{ display:none !important; }
}

.badge-online{
  position:absolute; left: 12px; top: 12px;
  padding: 7px 10px; border-radius: 999px;
  background: rgba(0,0,0,.35);
  border: 1px solid rgba(255,255,255,.25);
  color:#fff; font-weight: 900; font-size: 12px;
  backdrop-filter: blur(6px);
}

.main-dots{
  position:absolute;
  left: 12px;
  bottom: 86px;
  display:flex;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 999px;
  background: rgba(0,0,0,.18);
  border: 1px solid rgba(255,255,255,.22);
  backdrop-filter: blur(6px);
}
.main-dot{
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255,255,255,.55);
}
.main-dot.on{ background: rgba(255,255,255,1); }

.thumbs{
  margin-top: 10px;
  padding: 0 10px;
  display:flex;
  gap: 8px;
  overflow:auto;
  padding-bottom: 2px;
}
.thumbs::-webkit-scrollbar{ height: 6px; }
.thumbs::-webkit-scrollbar-thumb{ background: rgba(0,0,0,.15); border-radius: 999px; }

.thumb{
  width: 62px; height: 62px;
  border-radius: 14px;
  overflow:hidden;
  border: 1px solid rgba(0,0,0,.08);
  background: #fff;
  flex: 0 0 auto;
  padding: 0;
  cursor: pointer;
  opacity: .85;
}
.thumb.active{
  opacity: 1;
  border-color: rgba(138,117,227,.45);
  box-shadow: 0 2px 10px rgba(138,117,227,.12);
}
.thumb img{ width:100%; height:100%; object-fit: cover; display:block; }

.info{ padding: 14px; display:grid; gap: 10px; }
.title-row{ display:flex; align-items:flex-start; gap: 10px; flex-wrap: wrap; }
.title{ flex:1 1 auto; font-weight: 900; font-size: 20px; overflow-wrap:anywhere; }

.actions{ display:flex; gap: 8px; flex: 0 0 auto; margin-left: auto; order: -1; }
.icon-btn{
  width: 40px; height: 40px; border-radius: 14px;
  border: 1px solid #efefef; background:#fafafa;
  cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  font-size: 16px;
}
.icon-btn.active{ background: rgba(217,83,79,.10); border-color: rgba(217,83,79,.22); }

.copied{
  width: fit-content;
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid rgba(46,125,50,.22);
  background: rgba(46,125,50,.10);
  color:#2e7d32;
  font-weight: 900;
  font-size: 12px;
}

.meta{ display:grid; gap: 8px; font-weight: 800; }
.m{ display:flex; gap: 8px; align-items:flex-start; opacity:.9; }
.m span{ width: 18px; }

.desc{ white-space: pre-line; line-height: 1.35; opacity:.9; }

.signup-wrap{
  margin-top: 14px;
  display:flex;
  justify-content: center;
}

.signup-btn{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap: 8px;
  min-width: 240px;
  padding: 14px 22px;
  border-radius: 16px;
  text-decoration:none;
  font-weight: 900;
  color:#fff;
  background: linear-gradient(135deg, #8a75e3 0%, #5f4cc6 55%, #3d2ea1 100%);
  box-shadow: 0 14px 34px rgba(95, 76, 198, .28);
  transition: transform .15s ease, box-shadow .15s ease, filter .15s ease;
}
.signup-btn:hover{
  transform: translateY(-1px);
  box-shadow: 0 18px 36px rgba(95, 76, 198, .34);
  filter: brightness(1.02);
}
.signup-btn:active{ transform: translateY(0); }

.tabs-wrap{
  margin-top: 12px;
  border: 1px solid #efefef;
  background:#fff;
  border-radius: 18px;
  overflow:hidden;
}
.tabs{
  display:flex;
  border-bottom: 1px solid #f2f2f2;
}
.tab{
  flex: 1 1 50%;
  padding: 12px 14px;
  font-weight: 900;
  background:#fff;
  border:none;
  cursor:pointer;
}
.tab.active{ background: rgba(138,117,227,.10); }

.panel{ padding: 14px; }
.mini-state{ font-weight: 900; opacity:.8; }

.org-card{
  display:flex; align-items:center; gap: 12px;
  border: 1px solid #efefef; border-radius: 18px; padding: 12px;
}
.org-avatar{
  width: 56px; height: 56px; border-radius: 999px; overflow:hidden;
  border: 1px solid #efefef; background:#f2f2f2; display:grid; place-items:center;
}
.org-avatar img{ width:100%; height:100%; object-fit:cover; display:block; }
.org-fallback{
  font-weight: 900; font-size: 18px; color:#fff;
  background: linear-gradient(135deg,#8a75e3,#2e2a4a);
  width:100%; height:100%; display:grid; place-items:center;
}

.org-info{ flex: 1 1 auto; min-width:0; }
.org-name{ font-weight: 900; font-size: 16px; overflow-wrap:anywhere; }
.org-sub{ margin-top: 6px; display:flex; gap: 8px; flex-wrap: wrap; }
.pill{
  font-size: 12px; font-weight: 900; padding: 6px 10px; border-radius: 999px;
  background: rgba(0,0,0,.06); border: 1px solid rgba(0,0,0,.06);
}

.go-org{
  border:none; border-radius: 14px;
  padding: 10px 12px;
  background:#8a75e3; color:#fff;
  font-weight: 900; cursor:pointer;
}
.go-org:disabled{ opacity:.6; cursor:not-allowed; }

.org-actions{ display:flex; gap: 10px; align-items:center; }
.msg-org{
  width: 44px; height: 44px;
  border-radius: 14px;
  border: 1px solid #efefef;
  background:#fafafa;
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size: 18px;
}

.events-shell { margin-top: 10px; }
.events-list{
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(280px, 520px);
  justify-content: center;
}

@media (max-width: 760px){
  .main-carousel, .main-slide, .photo{ height: 230px; }
  .main-arrow{ top: 115px; }
  .main-dots{ bottom: 74px; }

  .events-list{
    grid-template-columns: 1fr;
    justify-content: stretch;
  }
}

.list-enter-active, .list-leave-active { transition: all .18s ease; }
.list-enter-from, .list-leave-to { opacity: 0; transform: translateY(6px); }
</style>
