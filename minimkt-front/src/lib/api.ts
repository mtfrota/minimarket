export const API_URL = "http://192.168.1.42:3000";

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return null;

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as { accessToken: string; refreshToken?: string };
  localStorage.setItem("accessToken", data.accessToken);
  if (data.refreshToken) {
    localStorage.setItem("refreshToken", data.refreshToken);
  }
  return data.accessToken;
}

export async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("accessToken");

  let response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();

    if (newToken) {
      response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${newToken}`,
          ...(options?.headers || {}),
        },
      });
    }
  }

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      message?: string;
      errors?: string[];
    };
    const joinedErrors = Array.isArray(error.errors) ? error.errors.join(" | ") : "";
    throw new Error(error.message || joinedErrors || "Erro na requisicao");
  }

  return response.json();
}
