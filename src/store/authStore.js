import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      
      setUser: (user) => set({ user }),
      
      setAccessToken: (token) => set({ accessToken: token }),
      
      login: (user, token) => set({ user, accessToken: token }),
      
      logout: () => set({ user: null, accessToken: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
)
