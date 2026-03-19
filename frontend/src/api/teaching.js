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

export async function listTeachingSessions(groupId, params = {}) {
  const query = new URLSearchParams();
  if (params.date_from) {
    query.set("date_from", params.date_from);
  }
  if (params.date_to) {
    query.set("date_to", params.date_to);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return api(`/teaching/sessions/${groupId}${suffix}`);
}

export async function updateStudentPaymentMode(studentId, courseId, payment_mode) {
  return api(`/teaching/students/${studentId}/courses/${courseId}/payment-mode`, {
    method: "PUT",
    body: { payment_mode },
  });
}

export async function addSubscriptionPayment(studentId, courseId, payload) {
  return api(`/teaching/students/${studentId}/courses/${courseId}/subscription-payments`, {
    method: "POST",
    body: payload,
  });
}

export async function addLessonPrepayment(studentId, courseId, payload) {
  return api(`/teaching/students/${studentId}/courses/${courseId}/prepayments`, {
    method: "POST",
    body: payload,
  });
}
