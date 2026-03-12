import { API_URL, apiFetch } from "@/lib/api";
import { AuthUser } from "@/types/auth";

const USER_STORAGE_KEY = "minimkt:user";

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("user:updated"));
}

export function clearStoredUser() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_STORAGE_KEY);
  window.dispatchEvent(new Event("user:updated"));
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = (await apiFetch("/auth/me")) as { user: AuthUser };
  setStoredUser(response.user);
  return response.user;
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  clearStoredUser();
  sessionStorage.clear();
}

export async function logoutServerSession() {
  if (typeof window === "undefined") return;

  const refreshToken = localStorage.getItem("refreshToken");
  if (refreshToken) {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // ignore network failures and clear client session anyway
    }
  }

  clearAuthSession();
}
