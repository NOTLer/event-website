<template>
  <div class="page">
    <div class="container">
      <div class="head">
        <div class="h-title">Друзья</div>

        <div class="h-actions">
          <button class="btn" @click="reloadAll" :disabled="loading">
            {{ loading ? '...' : 'Обновить' }}
          </button>
        </div>
      </div>

      <div v-if="needAuth" class="state">
        <div class="s-title">Нужно войти</div>
        <div class="s-sub">Открой профиль (👤) и войди через Google/Telegram.</div>
      </div>

      <div v-else class="grid">
        <!-- LEFT: заявки + друзья -->
        <aside class="left">
          <div class="block">
            <div class="b-title">Заявки в друзья</div>
            <div v-if="incomingRequests.length === 0" class="muted">Нет заявок</div>

            <div v-else class="list">
              <div v-for="r in incomingRequests" :key="r.other.id" class="row">
                <div class="u">
                  <div class="ava">
                    <img v-if="avatar(r.other)" :src="avatar(r.other)" alt="avatar" @error="clearAvatar(r.other)" />
                    <span v-else>{{ letter(r.other) }}</span>
                  </div>
                  <div class="meta">
                    <div class="name">{{ displayName(r.other) }}</div>
                    <div class="sub">@{{ r.other.username || '—' }}</div>
                  </div>
                </div>

                <div class="actions">
                  <button class="btn small" @click="accept(r.other.id)">Принять</button>
                  <button class="btn small ghost" @click="removeFriendOrReq(r.other.id)">Отклонить</button>
                </div>
              </div>
            </div>
          </div>

          <div class="block">
            <div class="b-title">Друзья</div>
            <div v-if="friends.length === 0" class="muted">Пока нет друзей</div>

            <div v-else class="list">
              <div v-for="u in friends" :key="u.id" class="row">
                <div class="u">
                  <div class="ava">
                    <img v-if="avatar(u)" :src="avatar(u)" alt="avatar" @error="clearAvatar(u)" />
                    <span v-else>{{ letter(u) }}</span>
                  </div>
                  <div class="meta">
                    <div class="name">{{ displayName(u) }}</div>
                    <div class="sub">@{{ u.username || '—' }}</div>
                  </div>
                </div>

                <div class="actions">
                  <button class="btn small ghost" @click="openUserProfile(u.id)">Профиль</button>
                  <button class="btn small ghost" @click="goChat(u.id)">Написать</button>

                  <button class="btn small more-btn" type="button" @click.stop="toggleMenu(u.id)" aria-label="Меню">⋯</button>

                  <div v-if="openMenuId === u.id" class="menu" @click.stop>
                    <button class="menu-item" type="button" @click="openFriendsOf(u.id)">Посмотреть друзей</button>

                    <button class="menu-item danger" type="button" @click="openDeleteModal(u)">
                      Удалить из друзей
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <!-- RIGHT: предложка -->
        <main class="right">

          <div v-if="viewingFriendsOfId" class="block">
            <div class="b-title" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
              <span>Друзья пользователя</span>
              <button class="btn small ghost" type="button" @click="closeFriendsOf">Закрыть</button>
            </div>

            <div v-if="friendsOfLoading" class="muted">Загрузка…</div>
            <div v-else-if="friendsOfList.length === 0" class="muted">У пользователя пока нет друзей</div>

            <div v-else class="list">
              <div v-for="fu in friendsOfList" :key="fu.id" class="row">
                <div class="u">
                  <div class="ava">
                    <img v-if="avatar(fu)" :src="avatar(fu)" alt="avatar" @error="clearAvatar(fu)" />
                    <span v-else>{{ letter(fu) }}</span>
                  </div>
                  <div class="meta">
                    <div class="name">{{ displayName(fu) }}</div>
                    <div class="sub">@{{ fu.username || '—' }}</div>
                  </div>
                </div>
                <div class="actions">
                  <div v-if="isMe(fu.id)" class="self-badge">Это вы</div>
                  <template v-else>
                    <button class="btn small ghost" @click="openUserProfile(fu.id)">Профиль</button>
                    <button class="btn small ghost" @click="goChat(fu.id)">Написать</button>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <div class="block">
            <div class="b-title">Предложка знакомых друзей</div>

            <div v-if="suggestionsLoading" class="muted">Подбираем знакомых друзей…</div>

            <div v-else-if="suggestedFriends.length === 0" class="muted">
              Пока нет рекомендаций. Добавь больше друзей, чтобы увидеть знакомых друзей.
            </div>

            <div v-else class="list">
              <div v-for="u in suggestedFriends" :key="u.id" class="row">
                <div class="u">
                  <div class="ava">
                    <img v-if="avatar(u)" :src="avatar(u)" alt="avatar" @error="clearAvatar(u)" />
                    <span v-else>{{ letter(u) }}</span>
                  </div>
                  <div class="meta">
                    <div class="name">{{ displayName(u) }}</div>
                    <div class="sub">@{{ u.username || '—' }} · {{ u.mutualCount }} общих друзей</div>
                  </div>
                </div>

                <div class="actions">
                  <button class="btn small ghost" @click="openUserProfile(u.id)">Профиль</button>
                  <button class="btn small ghost" @click="goChat(u.id)">Написать</button>
                  <button class="btn small" @click="addFriend(u.id)">В друзья</button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="error" class="state error">
            <div class="s-title">Ошибка</div>
            <div class="s-sub">{{ error }}</div>
          </div>
        </main>
      </div>

    <teleport to="body">
      <div v-if="deleteCandidate" class="confirm-root" @click.self="closeDeleteModal">
        <div class="confirm-overlay" @click="closeDeleteModal"></div>
        <div class="confirm-modal" role="dialog" aria-modal="true" aria-label="Подтверждение удаления">
          <div class="confirm-title">Удалить из друзей?</div>
          <div class="confirm-text">
            Пользователь {{ displayName(deleteCandidate) }} будет удалён из списка друзей.
          </div>
          <div class="confirm-actions">
            <button class="btn small ghost" type="button" @click="closeDeleteModal">Отмена</button>
            <button class="btn small" type="button" @click="doDelete">Удалить</button>
          </div>
        </div>
      </div>
    </teleport>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useSupabase, supabase } from '@/composables/useSupabase'

export default {
  name: 'FriendsView',
  setup() {
    const router = useRouter()

    const {
      getUser,
      getMyPublicUser,
      getPublicUserById,
      getFriendships,
      sendFriendRequest,
      acceptFriendRequest,
      removeFriendOrRequest
    } = useSupabase()

    const loading = ref(false)
    const error = ref('')
    const needAuth = ref(false)
    const myId = ref('')

    const friendships = ref([])

    const friends = ref([])
    const incomingRequests = ref([])
    const suggestionsLoading = ref(false)
    const suggestedFriends = ref([])

    // UI menu (⋯) + confirm delete
    const openMenuId = ref('')
    const deleteCandidate = ref(null)

    // "друзья пользователя"
    const viewingFriendsOfId = ref('')
    const friendsOfLoading = ref(false)
    const friendsOfList = ref([])

    // быстрый индекс отношений по userId
    // friend | incoming | outgoing | none
    const relationIndex = ref(new Map())

    let cleanupDocClick = null

    const displayName = (u) => {
      const fn = String(u?.first_name || '').trim()
      const ln = String(u?.last_name || '').trim()
      const full = `${fn} ${ln}`.trim()
      return full || u?.email || 'Пользователь'
    }

    const letter = (u) => (displayName(u)[0] || 'П').toUpperCase()

    const normalizeStoragePublicUrl = (url) => {
      if (!url || typeof url !== 'string') return ''
      const u = url.trim()
      if (!u) return ''
      if (u.includes('/storage/v1/object/public/')) return u
      if (u.includes('/storage/v1/object/')) return u.replace('/storage/v1/object/', '/storage/v1/object/public/')
      return u
    }

    const avatar = (u) => normalizeStoragePublicUrl(u?.image_path || u?.avatar_url || u?.avatar || '')
    const clearAvatar = (u) => {
      if (u && typeof u === 'object') u.image_path = ''
    }

    const rebuildFromFriendships = async () => {
      const list = friendships.value || []

      const acceptedOtherIds = []
      const incomingOtherIds = []

      const idx = new Map()

      for (const f of list) {
        const isRequesterMe = f.requester_id === myId.value
        const otherId = isRequesterMe ? f.addressee_id : f.requester_id

        if (f.status === 'accepted') {
          idx.set(otherId, 'friend')
          acceptedOtherIds.push(otherId)
        }

        if (f.status === 'pending') {
          if (isRequesterMe) idx.set(otherId, 'outgoing')
          else {
            idx.set(otherId, 'incoming')
            incomingOtherIds.push(otherId)
          }
        }
      }

      relationIndex.value = idx

      const loadUsersByIds = async (ids) => {
        const out = []
        for (const id of ids) {
          const { data } = await getPublicUserById(id)
          if (data?.id) out.push(data)
        }
        return out
      }

      friends.value = await loadUsersByIds(acceptedOtherIds)
      const incomingUsers = await loadUsersByIds(incomingOtherIds)
      incomingRequests.value = incomingUsers.map((u) => ({ other: u }))
    }

    const isMe = (userId) => String(userId || '') === String(myId.value || '')

    const reloadFriendships = async () => {
      const { data } = await getFriendships()
      friendships.value = data || []
      await rebuildFromFriendships()
    }

    const loadSuggestedFriends = async () => {
      suggestionsLoading.value = true
      try {
        const acceptedRows = (friendships.value || []).filter((x) => x.status === 'accepted')
        const myFriendIds = acceptedRows.map((x) => (x.requester_id === myId.value ? x.addressee_id : x.requester_id))

        if (myFriendIds.length === 0) {
          suggestedFriends.value = []
          return
        }

        const { data, error: e1 } = await supabase
          .from('friendships')
          .select('*')
          .eq('status', 'accepted')
          .or(`requester_id.in.(${myFriendIds.join(',')}),addressee_id.in.(${myFriendIds.join(',')})`)
        if (e1) throw e1

        const relationMap = relationIndex.value
        const byCandidate = new Map()
        for (const row of data || []) {
          const a = row.requester_id
          const b = row.addressee_id
          const aIsMineFriend = myFriendIds.includes(a)
          const bIsMineFriend = myFriendIds.includes(b)
          if (aIsMineFriend === bIsMineFriend) continue

          const candidateId = aIsMineFriend ? b : a
          if (!candidateId || candidateId === myId.value) continue
          if (relationMap.get(candidateId)) continue

          byCandidate.set(candidateId, (byCandidate.get(candidateId) || 0) + 1)
        }

        const sortedIds = [...byCandidate.entries()]
          .sort((x, y) => y[1] - x[1])
          .slice(0, 30)

        const out = []
        for (const [id, mutualCount] of sortedIds) {
          const { data: u } = await getPublicUserById(id)
          if (u?.id) out.push({ ...u, mutualCount })
        }
        suggestedFriends.value = out
      } catch {
        suggestedFriends.value = []
      } finally {
        suggestionsLoading.value = false
      }
    }

    const addFriend = async (otherId) => {
      error.value = ''
      try {
        await sendFriendRequest(otherId)
        await reloadFriendships()
        await loadSuggestedFriends()
      } catch (e) {
        error.value = String(e?.message || e)
      }
    }

    const accept = async (otherId) => {
      error.value = ''
      try {
        await acceptFriendRequest(otherId)
        await reloadFriendships()
        await loadSuggestedFriends()
      } catch (e) {
        error.value = String(e?.message || e)
      }
    }

    const removeFriendOrReq = async (otherId) => {
      error.value = ''
      try {
        await removeFriendOrRequest(otherId)
        await reloadFriendships()
        await loadSuggestedFriends()
      } catch (e) {
        error.value = String(e?.message || e)
      }
    }


    const toggleMenu = (uid) => {
      openMenuId.value = openMenuId.value === String(uid || '') ? '' : String(uid || '')
    }

    const closeMenus = () => {
      openMenuId.value = ''
    }

    const openDeleteModal = (user) => {
      deleteCandidate.value = user || null
      closeMenus()
    }

    const closeDeleteModal = () => {
      deleteCandidate.value = null
    }

    const doDelete = async () => {
      const uid = deleteCandidate.value?.id
      if (!uid) return
      try {
        closeDeleteModal()
        await removeFriendOrReq(uid)
      } catch {
        // ignore
      }
    }

    const closeFriendsOf = () => {
      viewingFriendsOfId.value = ''
      friendsOfList.value = []
    }

    const openFriendsOf = async (otherId) => {
      closeMenus()
      viewingFriendsOfId.value = String(otherId || '')
      friendsOfList.value = []
      if (!otherId) return

      friendsOfLoading.value = true
      try {
        const { data, error: e1 } = await supabase
          .from('friendships')
          .select('*')
          .eq('status', 'accepted')
          .or(`requester_id.eq.${otherId},addressee_id.eq.${otherId}`)
          .order('created_at', { ascending: false })
        if (e1) throw e1

        const rows = data || []
        const ids = new Set()
        for (const f of rows) {
          const oid = f.requester_id === otherId ? f.addressee_id : f.requester_id
          if (oid) ids.add(oid)
        }

        const out = []
        for (const id of ids) {
          const { data: u } = await getPublicUserById(id)
          if (u?.id) out.push(u)
        }
        friendsOfList.value = out
      } catch {
        friendsOfList.value = []
      } finally {
        friendsOfLoading.value = false
      }
    }

    const goChat = (otherId) => {
      // открываем MessagesView и просим открыть чат сразу
      // MessagesView читает query.with
      router.push({ path: '/messages', query: { with: otherId } })
    }

    const openUserProfile = (otherId) => {
      if (!otherId) return
      router.push({ name: 'user-profile', params: { id: otherId } })
    }

    const reloadAll = async () => {
      loading.value = true
      error.value = ''
      try {
        const { user } = await getUser()
        if (!user?.id) {
          needAuth.value = true
          return
        }
        needAuth.value = false
        myId.value = user.id

        // чтобы профиль точно был
        await getMyPublicUser()

        await reloadFriendships()
        await loadSuggestedFriends()
      } catch (e) {
        error.value = String(e?.message || e)
      } finally {
        loading.value = false
      }
    }

    onMounted(reloadAll)

    

    onBeforeUnmount(() => {
      try {
        if (cleanupDocClick) cleanupDocClick()
      } catch {}
    })

return {
      loading,
      error,
      needAuth,
      myId,

      friends,
      incomingRequests,
      suggestionsLoading,
      suggestedFriends,

      openMenuId,
      deleteCandidate,
      toggleMenu,
      openDeleteModal,
      closeDeleteModal,
      openFriendsOf,
      closeFriendsOf,
      viewingFriendsOfId,
      friendsOfLoading,
      friendsOfList,
      doDelete,

      displayName,
      letter,
      avatar,
      clearAvatar,

      isMe,

      addFriend,
      accept,
      removeFriendOrReq,
      goChat,
      openUserProfile,

      reloadAll
    }
  }
}
</script>

<style scoped>
.page { padding: 12px 0; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 12px; }

.head{
  display:flex; align-items:center; justify-content: space-between; gap: 12px;
  margin-bottom: 12px;
}
.h-title{ font-weight: 900; font-size: 18px; }
.h-actions{ display:flex; gap: 10px; align-items:center; flex: 1 1 auto; justify-content:flex-end; }
.grid{
  display:grid;
  grid-template-columns: 3fr 1fr;
  gap: 12px;
}
@media (max-width: 980px){
  .grid{ grid-template-columns: 1fr; }
}

.left, .right{ min-width: 0; }

.block{
  background:#fff;
  border:1px solid #f3f3f3;
  border-radius: 16px;
  padding: 12px;
  margin-bottom: 12px;
  box-shadow: 0 8px 24px rgba(20,24,27,.04);
}
.b-title{ font-weight: 900; margin-bottom: 10px; }
.muted{ font-size: 12px; opacity: .7; font-weight: 700; }

.list{ display:flex; flex-direction: column; gap: 0; }

.row{
  display:flex; align-items:center; justify-content: space-between; gap: 10px;
  border:none;
  border-radius: 0;
  padding: 11px 2px;
  background:#fff;
}
.row + .row{
  border-top: 1px solid #efefef;
}
.u{ display:flex; align-items:center; gap: 10px; min-width: 0; }
.ava{
  width: 38px; height: 38px; border-radius: 999px;
  display:grid; place-items:center;
  background: #f2f2f2;
  font-weight: 900;
  flex: 0 0 auto;
  overflow: hidden;
}
.ava img{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
}
.meta{ min-width: 0; }
.name{ font-weight: 900; font-size: 13px; white-space: nowrap; overflow:hidden; text-overflow: ellipsis; }
.sub{ font-size: 12px; opacity: .75; white-space: nowrap; overflow:hidden; text-overflow: ellipsis; }
.actions{ display:flex; gap: 8px; flex-wrap: nowrap; justify-content:flex-end; align-items:center; }
.self-badge{
  font-size: 12px;
  font-weight: 900;
  color: #55607b;
  background: #f3f6ff;
  border-radius: 999px;
  padding: 6px 10px;
}

.btn{
  border:none;
  background:#8a75e3;
  color:#fff;
  border-radius: 14px;
  padding: 10px 12px;
  font-weight: 900;
  cursor:pointer;
}
.btn.small{ padding: 8px 12px; border-radius: 12px; font-size: 12px; min-height: 36px; min-width: 98px; display:inline-flex; align-items:center; justify-content:center; line-height:1; }
.more-btn{ min-width: 28px; width: 28px; min-height: 32px; padding: 0; font-size: 16px; }
.btn.ghost{
  background:#fafafa;
  color:#14181b;
  border:1px solid #efefef;
}

.state{
  margin-top: 12px;
  padding: 14px;
  border: 1px solid #efefef;
  border-radius: 16px;
  background:#fff;
}
.state.error{ border-color: rgba(217,83,79,.35); }
.s-title{ font-weight: 900; margin-bottom: 6px; }
.s-sub{ opacity: .8; font-weight: 700; }


/* меню троеточия */
.row{ position: relative; }
.menu{
  position: absolute;
  margin-top: 6px;
  right: 10px;
  top: 100%;
  background: #fff;
  border: 1px solid #efefef;
  border-radius: 14px;
  padding: 8px;
  display: grid;
  gap: 6px;
  z-index: 30;
  box-shadow: 0 12px 30px rgba(20,24,27,.10);
}
.menu-item{
  width: 100%;
  text-align: left;
  border: 1px solid #efefef;
  background: #fff;
  border-radius: 12px;
  padding: 10px 10px;
  font-weight: 900;
  cursor: pointer;
}
.menu-item:hover{ background:#fafafa; }
.menu-item.danger{ border-color: rgba(217,83,79,.28); color: #d9534f; }

.confirm-root{
  position: fixed;
  inset: 0;
  z-index: 70;
}
.confirm-overlay{
  position: absolute;
  inset: 0;
  background: rgba(20,24,27,.45);
}
.confirm-modal{
  position: relative;
  width: min(420px, calc(100vw - 28px));
  margin: 18vh auto 0;
  background: #fff;
  border: 1px solid #efefef;
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 14px 40px rgba(20,24,27,.20);
}
.confirm-title{ font-weight: 900; margin-bottom: 8px; }
.confirm-text{ font-size: 13px; opacity: .82; margin-bottom: 12px; }
.confirm-actions{ display:flex; justify-content:flex-end; gap: 8px; }

@media (max-width: 760px){
  .row{ align-items:flex-start; }
  .actions{ width: 100%; justify-content:flex-end; flex-wrap: wrap; }
  .actions .btn.small:not(.more-btn){ min-width: 88px; }
}

</style>
