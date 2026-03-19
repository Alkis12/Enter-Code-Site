import { api } from "./client";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8002";

const getAdminKey = () => localStorage.getItem("admin_key");

const adminHeaders = () => {
  const key = getAdminKey();
  return key ? { "X-Admin-Key": key } : {};
};

export async function getWeekEvents(date) {
  const query = date ? `?date=${date}` : "";
  return api(`/events/week${query}`);
}

export async function listEvents() {
  return api("/events", { auth: false, headers: adminHeaders() });
}

export async function createEvent(payload) {
  return api("/events", {
    method: "POST",
    body: payload,
    auth: false,
    headers: adminHeaders(),
  });
}

export async function updateEvent(eventId, payload) {
  return api(`/events/${eventId}`, {
    method: "PUT",
    body: payload,
    auth: false,
    headers: adminHeaders(),
  });
}

export async function deleteEvent(eventId) {
  return api(`/events/${eventId}`, {
    method: "DELETE",
    auth: false,
    headers: adminHeaders(),
  });
}

export async function uploadEventImage(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/events/upload`, {
    method: "POST",
    headers: adminHeaders(),
    body: formData,
  });

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
