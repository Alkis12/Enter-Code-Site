import { api } from "./client";

export async function getMyInfo() {
  const access_token = localStorage.getItem("access_token");
  const refresh_token = localStorage.getItem("refresh_token");
  return await api("/users/profile", {
    method: "POST",
    body: { access_token, refresh_token },
    auth: true,
  });
}

let _cache = null;
let _inflight = null;

export async function getMyInfoOnce({ force = false } = {}) {
  if (force) {
    _cache = null;
    _inflight = null;
  }
  if (_cache) return _cache;
  if (_inflight) return _inflight;

  _inflight = getMyInfo()
    .then((d) => {
      _cache = d;
      _inflight = null;
      return d;
    })
    .catch((e) => {
      _inflight = null;
      throw e;
    });

  return _inflight;
}
