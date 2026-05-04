import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api"
});

api.interceptors.request.use((config) => {
  const path = config.url || "";
  if (path.startsWith("/admin") && path !== "/admin/login") {
    const token = localStorage.getItem("adminToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } else if (!path.startsWith("/admin")) {
    const isPublicAuth =
      path === "/auth/register" ||
      path === "/auth/login" ||
      path === "/auth/forgot-password" ||
      path === "/auth/reset-password";
    if (!isPublicAuth) {
      const ct = localStorage.getItem("customerToken");
      if (ct) {
        config.headers.Authorization = `Bearer ${ct}`;
      }
    }
  }
  return config;
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}
