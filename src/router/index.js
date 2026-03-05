import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import EventView from './views/EventView.vue'
import MyEventsView from './views/MyEventsView.vue'
import MessagesView from './views/MessagesView.vue'
import FriendsView from './views/FriendsView.vue'
import UserProfileView from './views/UserProfileView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/event/:id', name: 'event', component: EventView, props: true },
    { path: '/organizer/:id', name: 'organizer', component: UserProfileView, props: true },

    { path: '/my-events', name: 'my-events', component: MyEventsView },

    { path: '/messages', name: 'messages', component: MessagesView },
    { path: '/friends', name: 'friends', component: FriendsView },
    { path: '/profile/:id', name: 'user-profile', component: UserProfileView, props: true }
  ]
})

export default router
