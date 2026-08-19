import axios, { AxiosError, AxiosInstance } from "axios";
import type { ApiError } from "@/types";

const ACCESS_KEY = "auth.access";
const REFRESH_KEY = "auth.refresh";
const TENANT_KEY = "tenant.slug";

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export function getTenantSlug(): string | null {
  return localStorage.getItem(TENANT_KEY);
}
export function setTenantSlug(slug: string | null) {
  if (slug) localStorage.setItem(TENANT_KEY, slug);
  else localStorage.removeItem(TENANT_KEY);
}

export const api: AxiosInstance = axios.create({ baseURL: "/api/v1" });

api.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const slug = getTenantSlug();
  if (slug) config.headers["X-Restaurant-Slug"] = slug;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStore.refresh;
  if (!refresh) return null;
  try {
    const { data } = await axios.post("/api/v1/auth/refresh/", { refresh });
    tokenStore.set(data.access, data.refresh);
    return data.access as string;
  } catch {
    tokenStore.clear();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiError>) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !("_retried" in original)) {
      (original as unknown as Record<string, unknown>)._retried = true;
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null;
      });
      const token = await refreshing;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(normalizeError(error));
  }
);

function normalizeError(error: AxiosError<ApiError>): ApiError {
  const data = error.response?.data;
  if (data && typeof data === "object" && "code" in data) {
    return { ...data, errors: flattenErrors(data.errors) };
  }
  return {
    code: "network_error",
    message: error.message || "Network error",
  };
}

/**
 * Flatten DRF-style nested error bodies into `{ field: string[] }`.
 * The backend returns shapes like:
 *   { "password": { "errors": ["msg"] } }            -> field error
 *   { "errors": { "errors": ["msg"] } }              -> non-field error
 *   { "email": ["msg"] }                              -> already flat
 */
function flattenErrors(
  errors: ApiError["errors"] | Record<string, unknown> | undefined
): Record<string, string[]> | undefined {
  if (!errors || typeof errors !== "object") return undefined;
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(errors)) {
    if (Array.isArray(value)) {
      out[key] = value.map(String);
    } else if (value && typeof value === "object" && "errors" in value) {
      const inner = (value as { errors: unknown }).errors;
      const msgs = Array.isArray(inner) ? inner.map(String) : [String(inner)];
      // The backend wraps non-field (object-level) errors under a bare
      // "errors" key; map those to the conventional non_field_errors bucket.
      out[key === "errors" ? "non_field_errors" : key] = msgs;
    } else if (value != null) {
      out[key] = [String(value)];
    }
  }
  return Object.keys(out).length ? out : undefined;
}
