<template>
  <div class="pm-overlay" @click.self="$emit('close')">
    <div class="pm-modal" role="dialog" aria-modal="true" aria-label="Профиль">
      <div class="pm-top">
        <div class="pm-title">Профиль</div>
        <button class="pm-x" @click="$emit('close')" aria-label="Закрыть">✕</button>
      </div>

      <div class="pm-sub" v-if="telegramLink">
        Telegram привязан: <b>@{{ telegramLink.username || 'без username' }}</b>
      </div>
      <div class="pm-sub" v-else>
        Telegram не привязан (вход → Telegram)
      </div>

      <!-- Business -->
      <div class="pm-biz">
        <div class="pm-biz-row">
          <div class="pm-biz-title">Business аккаунт</div>
          <span v-if="isBusiness" class="pm-badge on">Активен</span>
          <span v-else class="pm-badge off">Не активен</span>
        </div>

        <div class="pm-biz-actions">
          <button class="pm-btn ghost" @click="showBizInfo = true">Узнать о бизнес аккаунте</button>
          <button v-if="isBusiness" class="pm-btn" @click="$emit('open-create-event')">➕ Добавить мероприятие</button>
        </div>
      </div>

      <!-- Interests -->
      <div class="pm-box">
        <div class="pm-box-top">
          <div class="pm-box-title">Интересы</div>
          <div class="pm-box-sub">Выбери категории — по ним настроится «Моя лента»</div>
        </div>

        <div v-if="!categories?.length" class="pm-muted">Категории не загружены</div>

        <div v-else class="pm-chips">
          <button
            v-for="c in categories"
            :key="c.id"
            type="button"
            class="pm-chip"
            :class="{ on: isInterestSelected(c.name) }"
            @click="toggleInterest(c.name)"
            :aria-pressed="isInterestSelected(c.name)"
          >
            {{ c.name }}
          </button>
        </div>
      </div>

      <!-- Avatar -->
      <div class="pm-ava-row">
        <button class="pm-ava" @click="triggerPick" aria-label="Изменить аватар">
          <img v-if="showLocalAvatar" :src="localAvatarUrl" alt="avatar" />
          <img v-else-if="showProfileAvatar" :src="profileAvatarUrl" alt="avatar" @error="onProfileImgError" />
          <div v-else class="pm-ava-fallback" :style="{ background: avatarGradient }">{{ avatarLetter }}</div>
        </button>

        <div class="pm-ava-hint">Нажми на аватар, чтобы поменять</div>

        <input ref="fileInput" class="pm-hidden" type="file" accept="image/*" @change="onPick" />
      </div>

      <!-- Form -->
      <div class="pm-grid">
        <label class="pm-field">
          <span>Username</span>
          <input v-model="form.username" type="text" placeholder="например: koksaralya" />
          <small class="pm-help">Только латиница/цифры/_ (3–20 символов)</small>
        </label>

        <label class="pm-field">
          <span>Имя</span>
          <input v-model="form.first_name" type="text" />
        </label>

        <label class="pm-field">
          <span>Фамилия</span>
          <input v-model="form.last_name" type="text" />
        </label>

        <label class="pm-field">
          <span>Дата рождения</span>
          <input v-model="form.birth_day" type="date" />
        </label>

        <label class="pm-field">
          <span>Телефон</span>
          <input v-model="form.phone" type="text" placeholder="+7..." />
        </label>

        <label class="pm-field">
          <span>Email</span>
          <input v-model="form.email" type="email" />
        </label>

        <label class="pm-field">
          <span>Пол</span>
          <select v-model="form.gender">
            <option value="">Не выбран</option>
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
          </select>
        </label>

        <label class="pm-field pm-field-full">
          <span>О себе (до 200 символов)</span>
          <textarea
            v-model="form.description"
            rows="4"
            maxlength="200"
            placeholder="Расскажите немного о себе"
          ></textarea>
          <small class="pm-help">Осталось {{ descriptionLeft }} символов</small>
        </label>
      </div>

      <div class="pm-actions">
        <div class="pm-autosave-status">{{ saving ? 'Сохранение изменений…' : 'Изменения сохраняются автоматически' }}</div>
        <button class="pm-btn danger" @click="$emit('logout')">Выйти из аккаунта</button>
      </div>
    </div>

    <!-- Biz info -->
    <teleport to="body">
      <div v-if="showBizInfo" class="pm-biz-root" @click.self="showBizInfo = false">
        <div class="pm-biz-modal" role="dialog" aria-modal="true" aria-label="О бизнес аккаунте">
          <div class="pm-top">
            <div class="pm-title">О Business аккаунте</div>
            <button class="pm-x" @click="showBizInfo = false" aria-label="Закрыть">✕</button>
          </div>

          <div class="pm-biz-body">
            <p><b>Business аккаунт</b> позволяет публиковать мероприятия.</p>
            <p>Стоимость — <b>200 рублей в месяц</b>.</p>
            <p>Для приобретения — напиши администратору.</p>
          </div>

          <div class="pm-actions">
            <button class="pm-btn" @click="showBizInfo = false">Понятно</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script>
import { reactive, watch, ref, computed, onBeforeUnmount } from 'vue'
import { toAvatarPublicUrl } from '../composables/useSupabase.js'

export default {
  name: 'ProfileModal',
  emits: ['close', 'save', 'pick-avatar', 'logout', 'open-create-event'],
  props: {
    profile: { type: Object, default: null },
    telegramLink: { type: Object, default: null },
    saving: { type: Boolean, default: false },
    categories: { type: Array, default: () => [] }
  },
  setup(props, { emit }) {
    const showBizInfo = ref(false)
    const syncingFromProfile = ref(false)
    const lastAutosavedSnapshot = ref('')
    let autosaveTimer = null

    const form = reactive({
      username: '',
      first_name: '',
      last_name: '',
      birth_day: '',
      phone: '',
      email: '',
      gender: '',
      description: '',
      interests: []
    })

    watch(
      () => props.profile,
      (p) => {
        syncingFromProfile.value = true
        form.username = p?.username || ''
        form.first_name = p?.first_name || ''
        form.last_name = p?.last_name || ''
        form.birth_day = p?.birth_day || ''
        form.phone = p?.phone || ''
        form.email = p?.email || ''
        form.gender = p?.gender || ''
        form.description = p?.description || ''
        form.interests = Array.isArray(p?.interests) ? [...p.interests] : []
        lastAutosavedSnapshot.value = JSON.stringify(form)
        syncingFromProfile.value = false
      },
      { immediate: true }
    )

    watch(
      () => JSON.stringify(form),
      (snapshot) => {
        if (syncingFromProfile.value) return
        if (snapshot === lastAutosavedSnapshot.value) return
        if (autosaveTimer) clearTimeout(autosaveTimer)
        autosaveTimer = setTimeout(() => {
          lastAutosavedSnapshot.value = snapshot
          emit('save', { ...form })
        }, 450)
      }
    )

    const descriptionLeft = computed(() => Math.max(0, 200 - String(form.description || '').length))

    const isBusiness = computed(() => props.profile?.It_business === true)

    const norm = (s) => String(s || '').trim()
    const isInterestSelected = (name) => form.interests.includes(norm(name))
    const toggleInterest = (name) => {
      const n = norm(name)
      if (!n) return
      const set = new Set(form.interests)
      if (set.has(n)) set.delete(n)
      else set.add(n)
      form.interests = Array.from(set)
    }

    // Avatar pick
    const fileInput = ref(null)
    const localAvatarUrl = ref('')
    const localErrored = ref(false)
    const profileErrored = ref(false)

    const triggerPick = () => fileInput.value?.click()

    const clearLocalAvatarPreview = () => {
      if (localAvatarUrl.value) URL.revokeObjectURL(localAvatarUrl.value)
      localAvatarUrl.value = ''
    }

    const onPick = (e) => {
      const file = e?.target?.files?.[0]
      if (!file) return

      clearLocalAvatarPreview()
      localAvatarUrl.value = URL.createObjectURL(file)
      localErrored.value = false
      profileErrored.value = false

      emit('pick-avatar', file)
      e.target.value = ''
    }

    const profileAvatarUrl = computed(() => {
      const custom = toAvatarPublicUrl(props.profile?.image_path)
      const google = toAvatarPublicUrl(props.profile?.avatar_url)
      return custom || google
    })

    const showLocalAvatar = computed(() => !!localAvatarUrl.value && !localErrored.value)
    const showProfileAvatar = computed(() => !!profileAvatarUrl.value && !profileErrored.value && !showLocalAvatar.value)

    const onProfileImgError = () => {
      profileErrored.value = true
    }

    watch(
      () => profileAvatarUrl.value,
      (nextUrl) => {
        if (nextUrl) clearLocalAvatarPreview()
      }
    )

    onBeforeUnmount(() => {
      clearLocalAvatarPreview()
      if (autosaveTimer) clearTimeout(autosaveTimer)
    })

    const avatarLetter = computed(() => {
      const n = (form.first_name || form.email || 'П')[0] || 'П'
      return String(n).toUpperCase()
    })

    const avatarGradient = computed(() => `linear-gradient(135deg,#8a75e3,#2e2a4a)`)

    return {
      form,
      isBusiness,
      showBizInfo,

      isInterestSelected,
      toggleInterest,

      fileInput,
      localAvatarUrl,
      clearLocalAvatarPreview,
      triggerPick,
      onPick,

      profileAvatarUrl,
      showLocalAvatar,
      showProfileAvatar,
      onProfileImgError,
      avatarLetter,
      avatarGradient,
      descriptionLeft
    }
  }
}
</script>

<style scoped>
/* ✅ overlay всегда в "камере" */
.pm-overlay{
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0,0,0,.35);
  backdrop-filter: blur(2px);

  /* ✅ ключ: даём отступы и держим модалку ВСЕГДА в пределах экрана */
  padding: 14px;

  display: flex;
  align-items: flex-start;     /* НЕ центр по Y (чтобы верх не уезжал) */
  justify-content: center;
  overflow: hidden;
}

/* ✅ модалка всегда в пределах viewport, внутри — свой скролл */
.pm-modal{
  width: min(760px, 100%);
  max-height: calc(100vh - 28px);  /* учитываем padding overlay */
  overflow: auto;

  background: #fff;
  border: 1px solid rgba(0,0,0,.10);
  border-radius: 18px;
  box-shadow: 0 18px 60px rgba(0,0,0,.18);
  padding: 14px;
}

.pm-top{
  display:flex; align-items:center; gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(0,0,0,.06);
  margin-bottom: 10px;
}
.pm-title{ font-weight: 900; }
.pm-x{
  margin-left:auto;
  border: 1px solid rgba(0,0,0,.10);
  background:#fff;
  border-radius: 12px;
  padding: 8px 10px;
  cursor:pointer;
}

.pm-sub{ font-size: 13px; opacity: .8; margin-bottom: 12px; }

.pm-biz{
  border: 1px solid rgba(138,117,227,.22);
  border-radius: 16px;
  background: #fcfcff;
  padding: 12px;
  display:grid;
  gap: 10px;
  margin-bottom: 12px;
}
.pm-biz-row{ display:flex; align-items:center; gap:10px; }
.pm-biz-title{ font-weight: 900; }

.pm-badge{
  margin-left:auto;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  font-weight: 900;
  border: 1px solid transparent;
}
.pm-badge.on{ background: rgba(46,125,50,.10); border-color: rgba(46,125,50,.20); color:#2e7d32; }
.pm-badge.off{ background: rgba(217,83,79,.10); border-color: rgba(217,83,79,.20); color:#d9534f; }

.pm-biz-actions{ display:flex; gap:10px; flex-wrap:wrap; }

.pm-box{
  border: 1px solid rgba(0,0,0,.10);
  border-radius: 16px;
  padding: 12px;
  display:grid;
  gap: 10px;
  margin-bottom: 12px;
}
.pm-box-title{ font-weight: 900; }
.pm-box-sub{ font-size: 12px; opacity: .75; }
.pm-muted{ font-size: 13px; opacity: .7; font-weight: 700; }

.pm-chips{ display:flex; flex-wrap:wrap; gap: 8px; }
.pm-chip{
  border: 1px solid rgba(0,0,0,.10);
  background:#fff;
  border-radius: 999px;
  padding: 8px 10px;
  font-weight: 900;
  font-size: 12px;
  cursor: pointer;
}
.pm-chip.on{ background: rgba(138,117,227,.14); border-color: rgba(138,117,227,.32); }

.pm-ava-row{ display:flex; align-items:center; gap: 12px; margin: 12px 0; }
.pm-ava{
  width: 74px; height: 74px;
  border-radius: 999px;
  overflow: hidden;
  border: 2px solid rgba(0,0,0,.10);
  background:#fff;
  cursor:pointer;
  display:grid; place-items:center;
  padding: 0;
}

.pm-ava img{ width:100%; height:100%; object-fit:cover; display:block; }
.pm-ava-fallback{ width:100%; height:100%; display:grid; place-items:center; color:#fff; font-weight:900; font-size:22px; }
.pm-ava-hint{ font-size: 13px; opacity: .8; font-weight: 700; }
.pm-hidden{ display:none; }

.pm-grid{ display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 720px){ .pm-grid{ grid-template-columns: 1fr; } }

.pm-field{ display:grid; gap: 6px; }
.pm-field-full{ grid-column: 1 / -1; }
.pm-field span{ font-size: 12px; opacity: .76; font-weight: 900; }
.pm-field input, .pm-field select{
  border: 2px solid rgba(0,0,0,.10);
  border-radius: 14px;
  padding: 10px 12px;
  outline:none;
  font-weight: 700;
}
.pm-field textarea{
  border: 2px solid rgba(0,0,0,.10);
  border-radius: 14px;
  padding: 10px 12px;
  outline:none;
  font-weight: 700;
  resize: vertical;
  min-height: 88px;
  font-family: inherit;
}
.pm-help{ font-size: 11px; opacity: .7; font-weight: 700; margin-top: -2px; }

.pm-actions{ margin-top: 14px; display:flex; gap: 10px; flex-wrap: wrap; align-items:center; }
.pm-autosave-status{ font-size:12px; opacity:.75; font-weight:800; margin-right:auto; }

.pm-btn{
  border:none;
  background:#8a75e3;
  color:#fff;
  border-radius: 14px;
  padding: 12px 16px;
  font-weight: 900;
  cursor:pointer;
}
.pm-btn:disabled{ opacity:.6; cursor:not-allowed; }
.pm-btn.ghost{
  background:#fff;
  color:#14181b;
  border: 1px solid rgba(0,0,0,.10);
}
.pm-btn.danger{ background:#d9534f; }

/* Biz info */
.pm-biz-root{
  position: fixed;
  inset: 0;
  z-index: 11000;
  background: rgba(0,0,0,.45);
  backdrop-filter: blur(2px);
  padding: 14px;
  display:flex;
  align-items:flex-start;
  justify-content:center;
}
.pm-biz-modal{
  width: min(520px, 100%);
  max-height: calc(100vh - 28px);
  overflow:auto;
  background:#fff;
  border: 1px solid rgba(0,0,0,.10);
  border-radius: 18px;
  box-shadow: 0 18px 60px rgba(0,0,0,.18);
  padding: 14px;
}
.pm-biz-body{ display:grid; gap: 10px; }
</style>
