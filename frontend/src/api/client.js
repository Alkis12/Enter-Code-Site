const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8002";

const getToken = () => localStorage.getItem("access_token");

function normalizeErrorMessage(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeErrorMessage(item))
      .filter(Boolean)
      .join("; ");
  }

  if (typeof value === "object") {
    if (typeof value.message === "string") {
      return value.message;
    }
    if (typeof value.detail === "string") {
      return value.detail;
    }
    if (typeof value.msg === "string") {
      return value.msg;
    }
    return JSON.stringify(value);
  }

  return String(value);
}

export async function api(
  path,
  { method = "GET", body, headers = {}, auth = true } = {}
) {
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (auth) {
    const token = getToken();
    if (token) opts.headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(
    `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`,
    opts
  );
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      normalizeErrorMessage(data?.detail ?? data?.message ?? data) ||
      res.statusText;
    const error = new Error(msg);
    error.status = res.status;
    error.data = data;
    error.details = data?.detail ?? data;
    throw error;
  }
  return data;
}
