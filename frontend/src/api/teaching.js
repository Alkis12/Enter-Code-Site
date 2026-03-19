import { api } from "./client";

export async function getAttendanceSession(groupId, date) {
  return api(`/teaching/attendance/${groupId}?date=${encodeURIComponent(date)}`);
}

export async function saveAttendanceSession(groupId, date, payload) {
  return api(`/teaching/attendance/${groupId}?date=${encodeURIComponent(date)}`, {
    method: "PUT",
    body: payload,
  });
}
