<template>
  <div class="wrap">
    <div class="card">
      <h2 class="title">Профиль</h2>

      <div v-if="loading" class="muted">Загрузка...</div>

      <div v-else>
        <!-- Если не авторизован / или нет подтверждения - показываем подсказку -->
        <div v-if="!session" class="muted">
          Нажми «Открыть вход» и выбери способ.
        </div>

        <div v-else class="muted">
          Аккаунт: {{ profile?.email || session.user.email }}
        </div>

        <div class="actions-top">
          <button class="btn" @click="openAuth">Открыть вход</button>
          <button v-if="session" class="btn danger" @click="logout">Выйти</button>
        </div>

        <!-- Форма после авторизации -->
        <div v-if="session" class="form">
          <h3 class="h">Данные профиля</h3>

          <div class="grid">
            <label class="field">
              <span>Имя</span>
              <input v-model="form.first_name" type="text" placeholder="Володя" />
            </label>

            <label class="field">
              <span>Фамилия</span>
              <input v-model="form.last_name" type="text" placeholder="..." />
            </label>

            <label class="field">
              <span>Дата рождения</span>
              <input v-model="form.birth_day" type="text" placeholder="ДД.ММ.ГГГГ" />
            </label>

            <label class="field">
              <span>Телефон</span>
              <input v-model="form.phone" type="text" placeholder="+7..." />
            </label>

            <label class="field">
              <span>Email</span>
              <input v-model="form.email" type="email" placeholder="mail@example.com" />
            </label>

            <label class="field">
              <span>Пол</span>
              <select v-model="form.gender">
                <option value="">Не выбран</option>
                <option value="male">Мужской</option>
                <option value="female">Женский</option>
              </select>
            </label>

            <label class="field field-full">
              <span>О себе (до 1000 символов)</span>
              <textarea
                v-model="form.about"
                maxlength="1000"
                rows="3"
                placeholder="Расскажите о себе..."
              ></textarea>
              <small class="counter">{{ aboutLeft }} символов осталось</small>
            </label>
          </div>

          <div class="avatar-block">
            <div class="avatar">
              <img v-if="previewAvatarUrl" :src="previewAvatarUrl" alt="" />
              <img v-else-if="profileAvatarUrl" :src="profileAvatarUrl" alt="" />
              <div v-else class="ph">👤</div>
            </div>

            <div class="avatar-actions">
              <input type="file" accept="image/*" @change="onPickAvatar" />
              <button class="btn" @click="saveProfile" :disabled="saving">
                {{ saving ? 'Сохранение...' : 'Сохранить' }}
              </button>
            </div>
          </div>

          <!-- Telegram статус -->
          <div class="tg-status">
            <b>Telegram:</b>
            <span v-if="telegramLink">привязан (@{{ telegramLink.username || 'без username' }})</span>
            <span v-else>не привязан (открой вход → Telegram)</span>
          </div>

          <div class="business-block">
            <b>Мероприятия:</b>
            <template v-if="profile?.It_business">
              <button class="btn" type="button" @click="goToMyEvents">Добавить / управлять мероприятиями</button>
            </template>
            <p v-else class="muted no-margin">
              Добавлять мероприятия могут только бизнес аккаунты.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Модалка входа -->
    <AuthModal
      v-if="showAuth"
      :telegram-bot-username="telegramBotUsername"
      @close="showAuth = false"
      @google="loginGoogle"
      @telegram-auth="onTelegramAuth"
    />
  </div>
</template>

<script>
import { ref, reactive, onMounted, computed } from 'vue'
import AuthModal from '../../components/AuthModal.vue'
import { useRouter } from 'vue-router'
import { useSupabase, toAvatarPublicUrl } from '../../composables/useSupabase'

export default {
  name: 'ProfileView',
  components: { AuthModal },
  setup() {
    const router = useRouter()

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
      getMyTelegramLink
    } = useSupabase()

    const telegramBotUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || ''

    const loading = ref(true)
    const saving = ref(false)

    const session = ref(null)
    const profile = ref(null)
    const telegramLink = ref(null)

    const showAuth = ref(false)

    const form = reactive({
      first_name: '',
      last_name: '',
      birth_day: '',
      phone: '',
      email: '',
      gender: '',
      about: ''
    })

    const pickedAvatarFile = ref(null)
    const previewAvatarUrl = ref('')
    const profileAvatarUrl = computed(() => toAvatarPublicUrl(profile.value?.image_path) || toAvatarPublicUrl(profile.value?.avatar_url))

    const openAuth = () => {
      showAuth.value = true
    }

    const fillFormFromProfile = (p) => {
      form.first_name = p?.first_name ?? ''
      form.last_name = p?.last_name ?? ''
      form.birth_day = p?.birth_day ?? ''
      form.phone = p?.phone ?? ''
      form.email = p?.email ?? ''
      form.gender = p?.gender ?? ''
      form.about = p?.about ?? ''
    }

    const load = async () => {
      loading.value = true
      try {
        const { session: s } = await getSession()
        session.value = s

        if (!s) {
          profile.value = null
          telegramLink.value = null
          return
        }

        // гарантируем строку в public.users
        const { user } = await getUser()
        if (user) await ensurePublicUserRow(user)

        const { data: p } = await getMyPublicUser()
        profile.value = p
        fillFormFromProfile(p)

        const { data: tg } = await getMyTelegramLink()
        telegramLink.value = tg
      } catch (e) {
        console.error('Profile load error:', e)
      } finally {
        loading.value = false
      }
    }

    const loginGoogle = async () => {
      const { error } = await signInWithGoogle()
      if (error) {
        console.error(error)
        alert('Ошибка входа через Google (см. консоль)')
      }
      // после редиректа /profile -> load()
    }

    const onTelegramAuth = async (telegramData) => {
      // Telegram auth без Supabase-сессии некуда привязывать (у тебя users.id FK на auth.users)
      if (!session.value) {
        alert('Сначала войди через Google, затем привяжи Telegram.')
        return
      }

      const { error } = await linkTelegramViaEdgeFunction(telegramData)
      if (error) {
        console.error(error)
        alert('Ошибка Telegram подтверждения (см. консоль)')
        return
      }

      await load()
      showAuth.value = false
    }

    const onPickAvatar = (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      pickedAvatarFile.value = file
      previewAvatarUrl.value = URL.createObjectURL(file)
    }

    const saveProfile = async () => {
      saving.value = true
      try {
        let avatarUrl = null

        if (pickedAvatarFile.value) {
          const { publicUrl, error } = await uploadAvatar(pickedAvatarFile.value)
          if (error) throw error
          avatarUrl = publicUrl
        }

        const patch = {
          first_name: form.first_name || null,
          last_name: form.last_name || null,
          birth_day: form.birth_day || null,
          phone: form.phone || null,
          email: form.email || null,
          gender: form.gender || null
        }

        patch.about = String(form.about || '').trim().slice(0, 1000) || null

        if (avatarUrl) patch.image_path = avatarUrl

        const { data, error } = await updateMyPublicUser(patch)
        if (error) throw error

        profile.value = data
        pickedAvatarFile.value = null
        previewAvatarUrl.value = ''
        alert('Сохранено')
      } catch (e) {
        console.error('Save profile error:', e)
        alert('Ошибка сохранения (см. консоль)')
      } finally {
        saving.value = false
      }
    }

    const logout = async () => {
      await signOut()
      showAuth.value = false
      await load()
    }


    const aboutLeft = computed(() => Math.max(0, 1000 - String(form.about || '').length))

    const goToMyEvents = () => {
      router.push({ name: 'my-events' })
    }

    onMounted(async () => {
      await load()
      // по твоему требованию — при переходе на профиль сразу показываем рамку входа
      showAuth.value = true
    })

    return {
      telegramBotUsername,
      loading,
      saving,
      session,
      profile,
      profileAvatarUrl,
      telegramLink,
      showAuth,
      openAuth,
      loginGoogle,
      onTelegramAuth,
      logout,
      form,
      onPickAvatar,
      pickedAvatarFile,
      previewAvatarUrl,
      saveProfile,
      aboutLeft,
      goToMyEvents
    }
  }
}
</script>

<style scoped>
.wrap { max-width: 1200px; margin: 0 auto; padding: 20px; }
.card { background:linear-gradient(180deg,#ffffff,#fcfbff); border-radius:20px; padding:22px; box-shadow:0 14px 40px rgba(67,43,132,.08); border:1px solid rgba(138,117,227,.14); }
.title { margin: 0 0 12px; }

.muted { opacity:.7; margin-bottom: 10px; }

.actions-top { display:flex; gap:10px; margin: 10px 0 16px; }

.btn {
  border: none;
  border-radius: 12px;
  padding: 10px 14px;
  cursor: pointer;
  background: #8A75E3;
  color:#fff;
  font-weight:700;
}
.btn.danger { background:#d9534f; }

.form { margin-top: 8px; }
.h { margin: 0 0 12px; }

.grid {
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.field { display:flex; flex-direction:column; gap:6px; }
.field span { font-size:12px; opacity:.7; }

input, select, textarea {
  border: 1px solid #efefef;
  border-radius: 12px;
  padding: 10px 12px;
  outline: none;
}

textarea{resize:vertical;min-height:82px;font-family:inherit;}
.field-full{grid-column:1/-1;}
.counter{opacity:.7;font-size:12px;}
.business-block{margin-top:14px;padding-top:14px;border-top:1px solid #efefef;display:flex;flex-direction:column;gap:10px;}
.no-margin{margin:0;}

.avatar-block { display:flex; gap:14px; align-items:center; margin-top: 14px; }
.avatar {
  width: 72px; height:72px; border-radius:50%;
  background:#f5f5f5; overflow:hidden;
  display:flex; align-items:center; justify-content:center;
}
.avatar img { width:100%; height:100%; object-fit:cover; }
.ph { font-size:22px; }

.avatar-actions { display:flex; flex-direction:column; gap:10px; }

.tg-status { margin-top: 14px; padding-top: 14px; border-top: 1px solid #efefef; }
</style>
