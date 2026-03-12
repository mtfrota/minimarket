export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

function isFormDataBody(body: BodyInit | null | undefined): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

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
  const isFormData = isFormDataBody(options?.body);

  const headers: HeadersInit = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers || {}),
    ...(!isFormData ? { "Content-Type": "application/json" } : {}),
  };

  let response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();

    if (newToken) {
      response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${newToken}`,
          ...(options?.headers || {}),
          ...(!isFormData ? { "Content-Type": "application/json" } : {}),
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

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}
