/**
 * API service for communicating with the backend
 */

import type {
  MigrationEstimateRequest,
  MigrationEstimateResponse,
} from "@/components/utils/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const API_V1_PREFIX = process.env.NEXT_PUBLIC_API_V1_PREFIX || "/api/v1";

// Types for authentication
export type UserResponse = {
  _id: string;
  username: string;
  role: "user" | "admin";
  created_at: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  user: UserResponse;
};

export type LoginCredentials = {
  username: string;
  password: string;
};

export type RegisterData = {
  username: string;
  password: string;
};

/**
 * Get authentication token from localStorage
 * First tries auth_token, then falls back to auth-storage (Zustand persist)
 */
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  
  // Try direct token first
  let token = localStorage.getItem("auth_token");
  
  // If not found, try to get from Zustand persisted state
  if (!token) {
    try {
      const authStorage = localStorage.getItem("auth-storage");
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        token = parsed.state?.token || null;
      }
    } catch (e) {
      console.error("Error parsing auth storage:", e);
    }
  }
  
  return token;
}

/**
 * Base API client with error handling
 */
async function apiClient<T>(
  endpoint: string,
  options?: RequestInit,
  requiresAuth: boolean = false
): Promise<T> {
  const url = `${API_BASE_URL}${API_V1_PREFIX}${endpoint}`;
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options?.headers as Record<string, string>,
  };

  // Add auth token if required
  if (requiresAuth) {
    const token = getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        detail: `HTTP error! status: ${response.status}`,
      }));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("An unexpected error occurred");
  }
}

/**
 * Submit migration estimation request
 */
export async function submitEstimation(
  request: MigrationEstimateRequest
): Promise<MigrationEstimateResponse> {
  return apiClient<MigrationEstimateResponse>("/estimation", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Get available migration types
 */
export async function getMigrationTypes(): Promise<{
  migration_types: Array<{ value: string; label: string }>;
}> {
  return apiClient("/migration-types", {
    method: "GET",
  });
}

/**
 * Health check for the estimation service
 */
export async function healthCheck(): Promise<{
  status: string;
  service: string;
}> {
  return apiClient("/health", {
    method: "GET",
  });
}

/**
 * Register a new user
 */
export async function register(data: RegisterData): Promise<TokenResponse> {
  return apiClient<TokenResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Login user
 */
export async function login(credentials: LoginCredentials): Promise<TokenResponse> {
  return apiClient<TokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<UserResponse> {
  return apiClient<UserResponse>("/auth/me", {
    method: "GET",
  }, true);
}

/**
 * Save token to localStorage
 */
export function saveAuthToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("auth_token", token);
  }
}

/**
 * Remove token from localStorage
 */
export function removeAuthToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("auth_token");
  }
}

/**
 * Get rules.yaml content (Admin only)
 */
export async function getRules(): Promise<{
  content: string;
  file_path: string;
  file_size: number;
}> {
  return apiClient("/admin/rules", {
    method: "GET",
  }, true);
}

/**
 * Update rules.yaml content (Admin only)
 */
export async function updateRules(content: string): Promise<{
  message: string;
  backup_created: string;
  updated_by: string;
}> {
  return apiClient("/admin/rules", {
    method: "PUT",
    body: JSON.stringify({ content }),
  }, true);
}

/**
 * Get weights.yaml content (Admin only)
 */
export async function getWeights(): Promise<{
  content: string;
  file_path: string;
}> {
  return apiClient("/admin/weights", {
    method: "GET",
  }, true);
}

/**
 * Get assumptions.yaml content (Admin only)
 */
export async function getAssumptions(): Promise<{
  content: string;
  file_path: string;
}> {
  return apiClient("/admin/assumptions", {
    method: "GET",
  }, true);
}

/**
 * Save estimation to database (requires auth)
 */
export async function saveEstimation(data: {
  name?: string;
  request_data: MigrationEstimateRequest;
  response_data: MigrationEstimateResponse;
}): Promise<{
  _id: string;
  user_id: string;
  name?: string;
  created_at: string;
  updated_at: string;
}> {
  return apiClient("/estimations/", {
    method: "POST",
    body: JSON.stringify(data),
  }, true);
}

/**
 * Get user's saved estimations (requires auth)
 */
export async function getSavedEstimations(): Promise<Array<{
  _id: string;
  name?: string;
  migration_type: string;
  number_of_environments: number;
  total_migration_days: number;
  created_at: string;
}>> {
  return apiClient("/estimations/", {
    method: "GET",
  }, true);
}
