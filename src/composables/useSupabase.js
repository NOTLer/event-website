import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

const normalizeStoragePublicUrl = (url) => {
  if (!url || typeof url !== 'string') return ''
  const u = url.trim()
  if (!u) return ''
  if (u.includes('/storage/v1/object/public/')) return u
  if (u.includes('/storage/v1/object/')) return u.replace('/storage/v1/object/', '/storage/v1/object/public/')
  return u
}

const compact = (obj) => {
  const out = {}
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined) out[k] = v
  }
  return out
}

// File -> data:image/... base64
const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    try {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    } catch (e) {
      reject(e)
    }
  })

// helper: stable conversation channel name
const convoKey = (a, b) => {
  const A = String(a || '')
  const B = String(b || '')
  return [A, B].sort().join(':')
}

export const useSupabase = () => {
  // =======================
  // Events
  // =======================

  // ✅ НОВОЕ: пагинация вместо getEvents()
  // from/to — индексы range (0-based)
  const getEventsPage = async ({ from = 0, to = 9, publishedOnly = true } = {}) => {
    let q = supabase.from('events').select('*').order('date_time_event', { ascending: true }).range(from, to)
    if (publishedOnly) q = q.eq('is_published', true)
    const { data, error } = await q
    return { data: data ?? [], error }
  }

  // Старое (оставляем если где-то используется)
  const getEvents = async () => {
    const { data, error } = await supabase.from('events').select('*').order('date_time_event', { ascending: true })
    return { data, error }
  }

  const searchEvents = async (query) => {
    const q = String(query || '').trim()
    if (!q) return getEvents()

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .ilike('title', `%${q}%`)
      .order('date_time_event', { ascending: true })

    return { data, error }
  }

  const getCategories = async () => {
    const { data, error } = await supabase.from('category').select('*').order('id', { ascending: true })
    return { data, error }
  }

  // ids: number[]
  const getEventPhotos = async (eventIds) => {
    const ids = Array.isArray(eventIds) ? eventIds.filter((x) => x !== null && x !== undefined) : []
    if (!ids.length) return { data: [], error: null }

    const { data, error } = await supabase
      .from('event_photos')
      .select('id,event_id,photo_url')
      .in('event_id', ids)
      .order('id', { ascending: true })

    return { data: data ?? [], error }
  }

  const getEventById = async (id) => {
    const { data, error } = await supabase.from('events').select('*').eq('id', id).maybeSingle()
    return { data: data ?? null, error }
  }

  const getOrganizerEvents = async (userId, opts = {}) => {
    const { publishedOnly = true, excludeEventId = null } = opts || {}

    let q = supabase.from('events').select('*').eq('user_id', userId).order('date_time_event', { ascending: true })

    if (publishedOnly) q = q.eq('is_published', true)
    if (excludeEventId !== null && excludeEventId !== undefined) q = q.neq('id', excludeEventId)

    const { data, error } = await q
    return { data: data ?? [], error }
  }

  const getMyEvents = async (includeUnpublished = true) => {
    const { user } = await getUser()
    if (!user?.id) return { data: [], error: new Error('Not authorized') }

    let q = supabase.from('events').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    if (!includeUnpublished) q = q.eq('is_published', true)

    const { data, error } = await q
    return { data: data ?? [], error }
  }

  const createBusinessEvent = async (payload) => {
    const { user } = await getUser()
    if (!user?.id) return { data: null, error: new Error('Not authorized') }

    const {
      title,
      description,
      date_time_event,
      address,
      organizer,
      price,
      is_online,
      is_free,
      selectCategory,
      photo_file
    } = payload || {}

    const { data: created, error: e1 } = await supabase
      .from('events')
      .insert([
        compact({
          title,
          description,
          date_time_event,
          address,
          organizer,
          price,
          is_online,
          is_free,
          user_id: user.id,
          selectCategory,
          is_published: false
        })
      ])
      .select('*')
      .maybeSingle()

    if (e1) return { data: null, error: e1 }
    if (!created?.id) return { data: null, error: new Error('Event not created') }

    if (photo_file) {
      const dataUrl = await readFileAsDataUrl(photo_file)
      const { error: e2 } = await supabase.from('event_photos').insert([{ event_id: created.id, photo_url: dataUrl }])
      if (e2) return { data: created, error: e2 }
    }

    return { data: created, error: null }
  }

  // =======================
  // Auth
  // =======================
  const getSession = async () => {
    const { data, error } = await supabase.auth.getSession()
    return { session: data?.session ?? null, error }
  }

  const getUser = async () => {
    const { data, error } = await supabase.auth.getUser()
    return { user: data?.user ?? null, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const signInWithGoogle = async ({ redirectTo } = {}) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    })
    return { data, error }
  }

  // =======================
  // Profile (public.users)
  // =======================
  const ensurePublicUserRow = async (authUser) => {
    if (!authUser?.id) return { data: null, error: new Error('No auth user') }

    const { data: existing, error: e1 } = await supabase.from('users').select('*').eq('id', authUser.id).maybeSingle()
    if (e1 && e1.code !== 'PGRST116') {
      // ignore
    }
    if (existing) return { data: existing, error: null }

    const email = authUser.email || ''
    const name = (authUser.user_metadata?.full_name || authUser.user_metadata?.name || '').trim()

    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          id: authUser.id,
          email,
          first_name: name ? name.split(' ')[0] : '',
          last_name: name ? name.split(' ').slice(1).join(' ') : '',
          It_business: false,
          interests: []
        }
      ])
      .select('*')
      .maybeSingle()

    return { data: data ?? null, error }
  }

  const getMyPublicUser = async () => {
    const { user } = await getUser()
    if (!user?.id) return { data: null, error: new Error('Not authorized') }

    const { data, error } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle()
    return { data: data ?? null, error }
  }

  const updateMyPublicUser = async (patch) => {
    const { user } = await getUser()
    if (!user?.id) return { data: null, error: new Error('Not authorized') }

    const { data, error } = await supabase.from('users').update(compact(patch)).eq('id', user.id).select('*').maybeSingle()
    return { data: data ?? null, error }
  }

  const getPublicUserById = async (userId) => {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle()
    return { data: data ?? null, error }
  }

  const uploadAvatar = async (file) => {
    const { user } = await getUser()
    if (!user?.id) return { publicUrl: '', error: new Error('Not authorized') }
    if (!file) return { publicUrl: '', error: new Error('No file') }

    const fileName = typeof file.name === 'string' ? file.name : ''
    const fromName = fileName.includes('.') ? fileName.split('.').pop() : ''
    const fromType = String(file.type || '').toLowerCase().includes('jpeg') ? 'jpg' : ''
    const ext = (fromName || fromType || 'png').toLowerCase()

    // основной путь по требованию проекта:
    // storage / avatars / ProfileImage / <userId> / <timestamp>.<ext>
    const preferredBucket = 'avatars'
    const preferredFolder = 'ProfileImage'
    const timestamp = Date.now()
    const preferredPath = `${preferredFolder}/${user.id}/${timestamp}.${ext}`

    const uploadOptions = {
      upsert: true,
      cacheControl: '3600',
      contentType: file.type || 'image/png'
    }

    let uploadedBucket = preferredBucket
    let uploadedPath = preferredPath

    let { error: upErr } = await supabase.storage.from(uploadedBucket).upload(uploadedPath, file, uploadOptions)

    // fallback на env-конфиг, если в окружении задан другой bucket/folder
    if (upErr) {
      const envBucket = String(import.meta.env.VITE_AVATAR_BUCKET || '').trim()
      const envFolder = String(import.meta.env.VITE_AVATAR_FOLDER || '').trim() || preferredFolder
      if (envBucket && envBucket !== preferredBucket) {
        const envPath = `${envFolder}/${user.id}/${timestamp}.${ext}`
        const res = await supabase.storage.from(envBucket).upload(envPath, file, uploadOptions)
        upErr = res.error
        if (!upErr) {
          uploadedBucket = envBucket
          uploadedPath = envPath
        }
      }
    }

    if (upErr) return { publicUrl: '', error: upErr }

    const { data } = supabase.storage.from(uploadedBucket).getPublicUrl(uploadedPath)
    const basePublicUrl = normalizeStoragePublicUrl(data?.publicUrl || '')
    const publicUrl = basePublicUrl ? `${basePublicUrl}${basePublicUrl.includes('?') ? '&' : '?'}v=${timestamp}` : ''
    return { publicUrl, error: null, data: { publicUrl } }
  }

  const getMyUnreadMessagesCount = async () => {
    const { user } = await getUser()
    if (!user?.id) return { count: 0, error: null }

    const { count, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .is('read_at', null)

    return { count: Number(count || 0), error }
  }

  // =======================
  // Telegram
  // =======================
  const linkTelegramViaEdgeFunction = async (telegramAuthData) => {
    const { user } = await getUser()
    if (!user?.id) return { data: null, error: new Error('Not authorized') }

    const { data, error } = await supabase.functions.invoke('telegram-link', {
      body: { telegramAuthData }
    })
    return { data, error }
  }

  const getMyTelegramLink = async () => {
    const { user } = await getUser()
    if (!user?.id) return { data: null, error: new Error('Not authorized') }

    const { data, error } = await supabase.from('user_telegram').select('*').eq('user_id', user.id).maybeSingle()
    return { data: data ?? null, error }
  }

  // =======================
  // Social: Users search
  // =======================
  const searchUsers = async (query, limit = 20, opts = {}) => {
    const q = String(query || '').trim()
    if (!q) return { data: [], error: null }

    const { usernameOnly = false } = opts || {}
    let req = supabase
      .from('users')
      .select('id,first_name,last_name,email,username,image_path,It_business')
      .limit(limit)

    if (usernameOnly) {
      req = req.ilike('username', `${q}%`)
    } else {
      const pattern = `%${q}%`
      req = req.or(`username.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}`)
    }

    const { data, error } = await req
    return { data: data ?? [], error }
  }

  // =======================
  // Social: Friendships
  // =======================
  const getFriendships = async () => {
    const { user } = await getUser()
    if (!user?.id) return { data: [], error: new Error('Not authorized') }

    const { data, error } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    return { data: data ?? [], error }
  }

  const getAcceptedFriendsOf = async (userId) => {
    const uid = String(userId || '').trim()
    if (!uid) return { data: [], error: new Error('No userId') }

    const { data, error } = await supabase
      .from('friendships')
      .select('requester_id,addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)

    const out = []
    for (const row of (data || [])) {
      const requester = String(row?.requester_id || '')
      const addressee = String(row?.addressee_id || '')
      const other = requester === uid ? addressee : requester
      if (other) out.push(other)
    }

    return { data: [...new Set(out)], error }
  }

  const sendFriendRequest = async (otherId) => {
    const { user } = await getUser()
    if (!user?.id) return { data: null, error: new Error('Not authorized') }
    if (!otherId) return { data: null, error: new Error('No otherId') }
    if (otherId === user.id) return { data: null, error: new Error('Cannot add self') }

    const { data, error } = await supabase
      .from('friendships')
      .upsert([{ requester_id: user.id, addressee_id: otherId, status: 'pending' }], { onConflict: 'requester_id,addressee_id' })
      .select('*')
      .maybeSingle()

    return { data: data ?? null, error }
  }

  const acceptFriendRequest = async (otherId) => {
    const { user } = await getUser()
    if (!user?.id) return { data: null, error: new Error('Not authorized') }
    if (!otherId) return { data: null, error: new Error('No otherId') }

    const { data, error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('requester_id', otherId)
      .eq('addressee_id', user.id)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle()

    return { data: data ?? null, error }
  }

  const removeFriendOrRequest = async (otherId) => {
    const { user } = await getUser()
    if (!user?.id) return { data: null, error: new Error('Not authorized') }
    if (!otherId) return { data: null, error: new Error('No otherId') }

    const q = supabase
      .from('friendships')
      .delete()
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${user.id})`
      )

    const { data, error } = await q.select('*')
    return { data: data ?? [], error }
  }

  // =======================
  // Social: Messages
  // =======================
  const getConversation = async (otherId, limit = 200) => {
    const { user } = await getUser()
    if (!user?.id) return { data: [], error: new Error('Not authorized') }
    if (!otherId) return { data: [], error: new Error('No otherId') }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(limit)

    return { data: data ?? [], error }
  }

  const sendMessage = async (otherId, body) => {
    const { user } = await getUser()
    if (!user?.id) return { data: null, error: new Error('Not authorized') }
    const text = String(body || '').trim()
    if (!text) return { data: null, error: new Error('Empty message') }

    const { data, error } = await supabase
      .from('messages')
      .insert([{ sender_id: user.id, receiver_id: otherId, body: text }])
      .select('*')
      .maybeSingle()

    return { data: data ?? null, error }
  }

  const deleteMessage = async (messageId) => {
    const { user } = await getUser()
    if (!user?.id) return { data: null, error: new Error('Not authorized') }
    if (!messageId) return { data: null, error: new Error('No messageId') }

    const tryRpcDelete = async () => {
      const { data, error } = await supabase.rpc('delete_own_message', {
        p_message_id: messageId
      })

      if (error) return { data: null, error }
      if (!data) return { data: null, error: new Error('Message was not deleted in database') }

      return { data: [{ id: data }], error: null }
    }

    const rpcResult = await tryRpcDelete()
    const rpcErrorCode = String(rpcResult?.error?.code || '')
    const rpcErrorMessage = String(rpcResult?.error?.message || '').toLowerCase()
    const rpcErrorDetails = String(rpcResult?.error?.details || '').toLowerCase()
    const rpcStatus = Number(rpcResult?.error?.status || 0)
    const rpcMissingFn =
      rpcStatus === 404 ||
      rpcErrorCode === 'PGRST202' ||
      rpcErrorCode === '42883' ||
      rpcErrorMessage.includes('delete_own_message') ||
      rpcErrorMessage.includes('not found') ||
      rpcErrorDetails.includes('delete_own_message')

    // Fallback для окружений, где SQL-функция ещё не применена
    // или PostgREST отвечает 404 на RPC.
    if (!rpcResult.error) return rpcResult
    if (!rpcMissingFn) return rpcResult

    const { data, error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)
      .select('id')

    if (!error && (!data || data.length === 0)) {
      return { data: null, error: new Error('Message was not deleted in database') }
    }

    return { data: data ?? null, error }
  }


  const markConversationRead = async (otherId) => {
    const { user } = await getUser()
    if (!user?.id) return { data: null, error: new Error('Not authorized') }

    const { data, error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', otherId)
      .eq('receiver_id', user.id)
      .is('read_at', null)
      .select('*')

    return { data: data ?? [], error }
  }

  const getInboxThreads = async (limit = 250) => {
    const { user } = await getUser()
    if (!user?.id) return { data: [], error: new Error('Not authorized') }

    const take = Math.max(300, limit * 3)

    const { data, error } = await supabase
      .from('messages')
      .select('id,sender_id,receiver_id,body,created_at,read_at')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(take)

    if (error) return { data: [], error }

    const rows = data ?? []
    const seen = new Set()
    const out = []

    for (const m of rows) {
      const otherUserId = m.sender_id === user.id ? m.receiver_id : m.sender_id
      if (!otherUserId) continue
      if (seen.has(otherUserId)) continue
      seen.add(otherUserId)
      out.push({ otherUserId, lastMessage: m })
      if (out.length >= limit) break
    }

    return { data: out, error: null }
  }

  const getMyConversations = async (limit = 250) => {
    const { user } = await getUser()
    if (!user?.id) return { data: [], error: new Error('Not authorized') }

    const { data: memberships, error: membershipError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id)
      .limit(limit)

    if (membershipError) return { data: [], error: membershipError }

    const conversationIds = [...new Set((memberships || []).map((x) => String(x?.conversation_id || '')).filter(Boolean))]
    if (conversationIds.length === 0) return { data: [], error: null }

    const { data: conversations, error: conversationsError } = await supabase
      .from('conversations')
      .select('id,title,created_at,updated_at')
      .in('id', conversationIds)

    if (conversationsError) return { data: [], error: conversationsError }

    return { data: conversations ?? [], error: null }
  }

  const createConversation = async ({ title = '', participantIds = [] } = {}) => {
    const { user } = await getUser()
    if (!user?.id) return { data: null, error: new Error('Not authorized') }

    const cleanIds = [...new Set((participantIds || []).map((id) => String(id || '').trim()).filter(Boolean))]
    const allParticipants = [...new Set([user.id, ...cleanIds])]

    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert([{ title: String(title || '').trim() || null, created_by: user.id }])
      .select('*')
      .maybeSingle()

    if (convError) return { data: null, error: convError }
    if (!conversation?.id) return { data: null, error: new Error('Conversation not created') }

    const rows = allParticipants.map((userId) => ({ conversation_id: conversation.id, user_id: userId }))
    const { error: participantsError } = await supabase.from('conversation_participants').insert(rows)
    if (participantsError) return { data: null, error: participantsError }

    return { data: conversation, error: null }
  }

  const addParticipantsToConversation = async (conversationId, userIds = []) => {
    const cid = String(conversationId || '').trim()
    if (!cid) return { data: [], error: new Error('No conversationId') }

    const uniqueIds = [...new Set((userIds || []).map((id) => String(id || '').trim()).filter(Boolean))]
    if (uniqueIds.length === 0) return { data: [], error: null }

    const rows = uniqueIds.map((userId) => ({ conversation_id: cid, user_id: userId }))
    const { data, error } = await supabase.from('conversation_participants').insert(rows).select('*')
    return { data: data ?? [], error }
  }

  // =======================
  // Realtime: new messages
  // =======================
  const subscribeToMyMessages = async ({ onInsert, onUpdate } = {}) => {
    const { user } = await getUser()
    if (!user?.id) return { channel: null, error: new Error('Not authorized') }

    const ch = supabase.channel(`rt:messages:${user.id}`)

    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
      (payload) => onInsert?.(payload.new)
    )

    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` },
      (payload) => onInsert?.(payload.new)
    )

    ch.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
      (payload) => onUpdate?.(payload.new)
    )

    // ✅ важно для "двух галочек": когда собеседник читает сообщение,
    // обновляется read_at у сообщений, где *я* sender_id, а receiver_id = другой пользователь.
    // Поэтому слушаем UPDATE и по sender_id.
    ch.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` },
      (payload) => onUpdate?.(payload.new)
    )

    const { error } = await ch.subscribe()
    return { channel: ch, error }
  }

  // =======================
  // Realtime: typing indicator (broadcast)
  // =======================
  const joinTypingChannel = async ({ otherId, onTyping } = {}) => {
    const { user } = await getUser()
    if (!user?.id) return { channel: null, error: new Error('Not authorized') }
    if (!otherId) return { channel: null, error: new Error('No otherId') }

    const key = convoKey(user.id, otherId)
    const ch = supabase.channel(`rt:typing:${key}`)

    ch.on('broadcast', { event: 'typing' }, (payload) => {
      const p = payload?.payload || {}
      if (p.from === otherId && p.to === user.id) onTyping?.(!!p.typing)
    })

    const { error } = await ch.subscribe()
    return { channel: ch, error }
  }

  const sendTyping = async ({ otherId, typing }) => {
    const { user } = await getUser()
    if (!user?.id) return { error: new Error('Not authorized') }
    if (!otherId) return { error: new Error('No otherId') }

    const key = convoKey(user.id, otherId)
    const ch = supabase.channel(`rt:typing:${key}`)

    const res = await ch.send({
      type: 'broadcast',
      event: 'typing',
      payload: { from: user.id, to: otherId, typing: !!typing, ts: Date.now() }
    })
    return { error: null, result: res }
  }

  return {
    // events
    getEventsPage, // ✅ новое
    getEvents,
    searchEvents,
    getCategories,
    getEventPhotos,
    getEventById,
    getOrganizerEvents,
    getMyEvents,
    createBusinessEvent,

    // auth
    getSession,
    getUser,
    signInWithGoogle,
    signOut,

    // profile
    ensurePublicUserRow,
    getMyPublicUser,
    getPublicUserById,
    updateMyPublicUser,
    uploadAvatar,

    // telegram
    linkTelegramViaEdgeFunction,
    getMyTelegramLink,

    // social
    searchUsers,

    getFriendships,
    getAcceptedFriendsOf,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriendOrRequest,

    getInboxThreads,
    getMyConversations,
    createConversation,
    addParticipantsToConversation,
    getConversation,
    sendMessage,
    deleteMessage,
    markConversationRead,
    getMyUnreadMessagesCount,

    // realtime
    subscribeToMyMessages,
    joinTypingChannel,
    sendTyping
  }
}
