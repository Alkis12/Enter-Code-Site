const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const getToken = () => localStorage.getItem("access_token");

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
    const msg = (data && (data.detail || data.message)) || res.statusText;
    throw new Error(msg);
  }
  return data;
}
