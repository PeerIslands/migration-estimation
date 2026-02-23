"use client";

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { 
  login as apiLogin, 
  register as apiRegister,
  getCurrentUser,
  saveAuthToken,
  removeAuthToken,
  type UserResponse,
  type LoginCredentials,
  type RegisterData
} from "@/lib/api";
import { useFormStore } from "@/components/store/formStore";

type AuthState = {
  user: UserResponse | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
};

type AuthActions = {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  clearError: () => void;
};

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

export const useAuthStore = create<AuthState & AuthActions>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        login: async (credentials) => {
          set({ isLoading: true, error: null });
          try {
            const response = await apiLogin(credentials);
            saveAuthToken(response.access_token);
            set({
              user: response.user,
              token: response.access_token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Login failed";
            set({ 
              isLoading: false, 
              error: errorMessage,
              isAuthenticated: false,
              user: null,
              token: null 
            });
            throw error;
          }
        },

        register: async (data) => {
          set({ isLoading: true, error: null });
          try {
            const response = await apiRegister(data);
            saveAuthToken(response.access_token);
            set({
              user: response.user,
              token: response.access_token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Registration failed";
            set({ 
              isLoading: false, 
              error: errorMessage,
              isAuthenticated: false,
              user: null,
              token: null 
            });
            throw error;
          }
        },

        logout: () => {
          removeAuthToken();
          sessionStorage.removeItem("admin_access_allowed");
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            error: null,
          });
          // Clear form state on logout to prevent data persistence across sessions
          useFormStore.getState().reset();
        },

        loadUser: async () => {
          const token = get().token;
          if (!token) return;

          set({ isLoading: true });
          try {
            const user = await getCurrentUser();
            set({
              user,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch (error) {
            // Token might be expired or invalid
            removeAuthToken();
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        },

        clearError: () => set({ error: null }),
      }),
      {
        name: "auth-storage",
        partialize: (state) => ({
          token: state.token,
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    { name: "authStore" }
  )
);
