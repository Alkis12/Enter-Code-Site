import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { Link, Navigate } from "react-router-dom";

import Header from "../components/Header/Header";
import { getDashboard } from "../api/account";
import { getCurrentUserType, isAuthenticated } from "../api/auth";
import { getCourseDetail, getMyCourses } from "../api/learning";
import { listTeachingSessions, saveAttendanceSession } from "../api/teaching";

function getTodayValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(value, delta) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  date.setDate(date.getDate() + delta);
  return date.toISOString().slice(0, 10);
}

function startOfCurrentWeek(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const weekday = date.getDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + delta);
  return date.toISOString().slice(0, 10);
}

function endOfCurrentWeek(value) {
  return shiftDate(startOfCurrentWeek(value), 6);
}

function startOfCurrentMonth(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function endOfCurrentMonth(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  date.setMonth(date.getMonth() + 1, 0);
  return date.toISOString().slice(0, 10);
}

function applyDefaultRange(group, today = getTodayValue()) {
  return {
    from: group?.start_date || shiftDate(today, -45),
    to: today,
  };
}

function formatDateLabel(value) {
  if (!value) return "Без даты";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "Без даты";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function buildSessionEditor(session, groupStudents) {
  const entryMap = new Map((session.entries || []).map((entry) => [entry.student_id, entry]));
  return {
    sourceDate: session.date,
    date: session.date,
    original_date: session.original_date || "",
    start_time: session.start_time || "",
    end_time: session.end_time || "",
    comment: session.comment || "",
    is_cancelled: false,
    entries: groupStudents.map((student) => {
      const saved = entryMap.get(student.user_id);
      return {
        student_id: student.user_id,
        name: student.name,
        surname: student.surname,
        tg_username: student.tg_username,
        present: Boolean(saved?.present),
        paid: Boolean(saved?.paid),
        note: saved?.note || "",
      };
    }),
  };
}

function TeachingPage() {
  const authed = isAuthenticated();
  const userType = getCurrentUserType();
  const canTeach = userType === "teacher" || userType === "admin";

  const [dashboard, setDashboard] = useState(null);
  const [courses, setCourses] = useState([]);
  const [courseDetail, setCourseDetail] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [rangeFrom, setRangeFrom] = useState(shiftDate(getTodayValue(), -45));
  const [rangeTo, setRangeTo] = useState(getTodayValue());
  const [rangeMode, setRangeMode] = useState("default");
  const [sessions, setSessions] = useState([]);
  const [sessionEditor, setSessionEditor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [courseLoading, setCourseLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadInitial = async () => {
      try {
        setLoading(true);
        const [dashboardResponse, coursesResponse] = await Promise.all([
          getDashboard(),
          getMyCourses(),
        ]);
        const nextCourses = coursesResponse.courses || [];
        setDashboard(dashboardResponse);
        setCourses(nextCourses);
        setSelectedCourseId((prev) => prev || nextCourses[0]?.id || "");
        setError("");
      } catch (err) {
        setError(err.message || "Не удалось загрузить раздел преподавателя");
      } finally {
        setLoading(false);
      }
    };

    if (authed && canTeach) {
      loadInitial();
    }
  }, [authed, canTeach]);

  useEffect(() => {
    const loadCourse = async () => {
      if (!selectedCourseId) {
        setCourseDetail(null);
        setSelectedGroupId("");
        return;
      }

      try {
        setCourseLoading(true);
        const response = await getCourseDetail(selectedCourseId);
        const groups = response.groups || [];
        setCourseDetail(response);
        setSelectedGroupId((prev) =>
          groups.some((group) => group.id === prev) ? prev : groups[0]?.id || ""
        );
        setError("");
      } catch (err) {
        setError(err.message || "Не удалось загрузить курс");
      } finally {
        setCourseLoading(false);
      }
    };

    if (selectedCourseId) {
      loadCourse();
    }
  }, [selectedCourseId]);

  const selectedGroup = useMemo(
    () => (courseDetail?.groups || []).find((group) => group.id === selectedGroupId) || null,
    [courseDetail, selectedGroupId]
  );

  const groupStudents = useMemo(() => {
    if (!selectedGroup || !courseDetail) return [];
    const ids = new Set(selectedGroup.students || []);
    return (courseDetail.students || []).filter((student) => ids.has(student.user_id));
  }, [courseDetail, selectedGroup]);

  useEffect(() => {
    if (!selectedGroup) {
      return;
    }
    const nextRange = applyDefaultRange(selectedGroup);
    setRangeMode("default");
    setRangeFrom(nextRange.from);
    setRangeTo(nextRange.to);
  }, [selectedGroup]);

  useEffect(() => {
    const loadSessions = async () => {
      if (!selectedGroupId) {
        setSessions([]);
        return;
      }

      try {
        setSessionsLoading(true);
        const response = await listTeachingSessions(selectedGroupId, {
          date_from: rangeFrom,
          date_to: rangeTo,
        });
        setSessions(response || []);
        setError("");
      } catch (err) {
        setError(err.message || "Не удалось загрузить занятия группы");
      } finally {
        setSessionsLoading(false);
      }
    };

    if (selectedGroupId) {
      loadSessions();
    }
  }, [selectedGroupId, rangeFrom, rangeTo]);

  if (!authed) {
    return <Navigate to="/login" replace />;
  }

  if (!canTeach) {
    return <Navigate to="/profile" replace />;
  }

  const pendingReviews = dashboard?.pending_reviews || [];
  const courseRequests = dashboard?.course_requests || [];

  const applyWeekRange = () => {
    const today = getTodayValue();
    setRangeMode("week");
    setRangeFrom(startOfCurrentWeek(today));
    setRangeTo(endOfCurrentWeek(today));
  };

  const applyMonthRange = () => {
    const today = getTodayValue();
    setRangeMode("month");
    setRangeFrom(startOfCurrentMonth(today));
    setRangeTo(endOfCurrentMonth(today));
  };

  const applyRegularRange = () => {
    const nextRange = applyDefaultRange(selectedGroup);
    setRangeMode("default");
    setRangeFrom(nextRange.from);
    setRangeTo(nextRange.to);
  };

  const handleSessionField = (field, value) => {
    setSessionEditor((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSessionEntry = (studentId, field, value) => {
    setSessionEditor((prev) => ({
      ...prev,
      entries: prev.entries.map((entry) =>
        entry.student_id === studentId ? { ...entry, [field]: value } : entry
      ),
    }));
  };

  const openSessionEditor = (session) => {
    setSessionEditor(buildSessionEditor(session, groupStudents));
    setMessage("");
    setError("");
  };

  const reloadSessions = async () => {
    if (!selectedGroupId) {
      return;
    }
    const response = await listTeachingSessions(selectedGroupId, {
      date_from: rangeFrom,
      date_to: rangeTo,
    });
    setSessions(response || []);
  };

  const handleSaveSession = async (isCancelled = false) => {
    if (!selectedGroupId || !sessionEditor) {
      return;
    }

    try {
      setSaving(true);
      await saveAttendanceSession(selectedGroupId, sessionEditor.sourceDate, {
        date: sessionEditor.date,
        start_time: sessionEditor.start_time || null,
        end_time: sessionEditor.end_time || null,
        comment: sessionEditor.comment,
        is_cancelled: isCancelled,
        entries: sessionEditor.entries.map((entry) => ({
          student_id: entry.student_id,
          present: entry.present,
          paid: entry.paid,
          note: entry.note,
        })),
      });
      await reloadSessions();
      setSessionEditor(null);
      setMessage(isCancelled ? "Занятие удалено." : "Занятие сохранено.");
      setError("");
    } catch (err) {
      setError(err.message || "Не удалось сохранить занятие");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <Header />
      <Content>
        {message && <StatusCard>{message}</StatusCard>}
        {error && <StatusCard $error>{error}</StatusCard>}

        <HeroCard>
          <div>
            <Eyebrow>Раздел преподавателя</Eyebrow>
            <Title>Занятия и проверка</Title>
            <HeroText>
              Здесь собраны реальные занятия группы, их переносы, комментарии,
              отметка посещаемости и оплата по разовым посещениям.
            </HeroText>
          </div>
          <HeroStats>
            <StatBox>
              <span>Ручная проверка</span>
              <strong>{pendingReviews.length}</strong>
            </StatBox>
            <StatBox>
              <span>Заявки</span>
              <strong>{courseRequests.length}</strong>
            </StatBox>
            <StatBox>
              <span>Курсы</span>
              <strong>{courses.length}</strong>
            </StatBox>
          </HeroStats>
        </HeroCard>

        <Grid>
          <MainColumn>
            <SectionCard>
              <SectionHeader>
                <div>
                  <SectionTitle>Занятия группы</SectionTitle>
                </div>
              </SectionHeader>

              {loading ? (
                <EmptyState>Загрузка...</EmptyState>
              ) : courses.length === 0 ? (
                <EmptyState>У вас пока нет курсов для управления.</EmptyState>
              ) : (
                <>
                  <SelectorRow>
                    <Field>
                      <Label>Курс</Label>
                      <Select
                        value={selectedCourseId}
                        onChange={(event) => setSelectedCourseId(event.target.value)}
                      >
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field>
                      <Label>Группа</Label>
                      <Select
                        value={selectedGroupId}
                        onChange={(event) => setSelectedGroupId(event.target.value)}
                        disabled={!courseDetail || (courseDetail.groups || []).length === 0}
                      >
                        {(courseDetail?.groups || []).map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </SelectorRow>

                  <QuickFilters>
                    <QuickButton
                      type="button"
                      $active={rangeMode === "default"}
                      onClick={applyRegularRange}
                    >
                      Обычный режим
                    </QuickButton>
                    <QuickButton
                      type="button"
                      $active={rangeMode === "week"}
                      onClick={applyWeekRange}
                    >
                      Показать на этой неделе
                    </QuickButton>
                    <QuickButton
                      type="button"
                      $active={rangeMode === "month"}
                      onClick={applyMonthRange}
                    >
                      В этом месяце
                    </QuickButton>
                  </QuickFilters>

                  {rangeMode !== "week" && rangeMode !== "month" && (
                    <CalendarRow>
                      <Field>
                        <Label>С</Label>
                        <Input
                          type="date"
                          value={rangeFrom}
                          onChange={(event) => {
                            setRangeMode("custom");
                            setRangeFrom(event.target.value);
                          }}
                        />
                      </Field>
                      <Field>
                        <Label>По</Label>
                        <Input
                          type="date"
                          value={rangeTo}
                          onChange={(event) => {
                            setRangeMode("custom");
                            setRangeTo(event.target.value);
                          }}
                        />
                      </Field>
                    </CalendarRow>
                  )}

                  {courseLoading || sessionsLoading ? (
                    <EmptyState>Загрузка занятий...</EmptyState>
                  ) : !selectedGroup ? (
                    <EmptyState>В этом курсе пока нет групп.</EmptyState>
                  ) : (
                    <>
                      <GroupMetaCard>
                        <strong>{selectedGroup.name}</strong>
                        {selectedGroup.schedule_summary && (
                          <SectionHint>{selectedGroup.schedule_summary}</SectionHint>
                        )}
                        {selectedGroup.start_date && (
                          <SectionHint>Старт группы: {formatDateLabel(selectedGroup.start_date)}</SectionHint>
                        )}
                        <SectionHint>Учеников в группе: {groupStudents.length}</SectionHint>
                      </GroupMetaCard>

                      {sessions.length === 0 ? (
                        <EmptyState>В выбранном диапазоне занятий нет.</EmptyState>
                      ) : (
                        <SessionList>
                          {sessions.map((session) => {
                            const presentCount = (session.entries || []).filter(
                              (entry) => entry.present
                            ).length;
                            const paidCount = (session.entries || []).filter(
                              (entry) => entry.paid
                            ).length;

                            return (
                              <SessionCard key={`${session.original_date || session.date}:${session.date}`}>
                                <SessionTop>
                                  <div>
                                    <SessionTitleLine>{formatDateLabel(session.date)}</SessionTitleLine>
                                    <SessionMeta>
                                      {(session.start_time || "00:00") +
                                        (session.end_time ? `-${session.end_time}` : "")}
                                    </SessionMeta>
                                    {session.original_date && session.original_date !== session.date && (
                                      <SessionMeta>
                                        Перенесено с {formatDateLabel(session.original_date)}
                                      </SessionMeta>
                                    )}
                                  </div>
                                  <SecondaryButton
                                    type="button"
                                    onClick={() => openSessionEditor(session)}
                                  >
                                    Изменить
                                  </SecondaryButton>
                                </SessionTop>

                                <SessionStats>
                                  <SessionStat>
                                    <span>Посещаемость</span>
                                    <strong>{presentCount}/{groupStudents.length}</strong>
                                  </SessionStat>
                                  <SessionStat>
                                    <span>Оплачено разово</span>
                                    <strong>{paidCount}</strong>
                                  </SessionStat>
                                </SessionStats>

                                {session.comment && <SessionComment>{session.comment}</SessionComment>}
                              </SessionCard>
                            );
                          })}
                        </SessionList>
                      )}
                    </>
                  )}
                </>
              )}
            </SectionCard>
          </MainColumn>

          <SideColumn>
            <SectionCard>
              <SectionHeader>
                <SectionTitle>Ручная проверка</SectionTitle>
                <CountBadge>{pendingReviews.length}</CountBadge>
              </SectionHeader>
              {pendingReviews.length === 0 ? (
                <EmptyState>Очередь сейчас пустая.</EmptyState>
              ) : (
                <Stack>
                  {pendingReviews.map((review) => (
                    <QueueItem key={`${review.task_id}:${review.student_user_id}`}>
                      <div>
                        <strong>
                          {review.student_name} {review.student_surname}
                        </strong>
                        <QueueMeta>{review.course_name} · {review.lesson_name}</QueueMeta>
                        <QueueMeta>{review.task_title} · попыток: {review.attempts}</QueueMeta>
                        <QueueMeta>
                          @{review.student_tg_username} · {formatDateTime(review.last_submission?.created_at)}
                        </QueueMeta>
                      </div>
                      <QueueLink to={`/mycourses/${review.course_id}/lessons/${review.lesson_id}`}>
                        К уроку
                      </QueueLink>
                    </QueueItem>
                  ))}
                </Stack>
              )}
            </SectionCard>

            <SectionCard>
              <SectionHeader>
                <SectionTitle>Заявки на курсы</SectionTitle>
                <CountBadge>{courseRequests.length}</CountBadge>
              </SectionHeader>
              {courseRequests.length === 0 ? (
                <EmptyState>Новых заявок пока нет.</EmptyState>
              ) : (
                <Stack>
                  {courseRequests.map((request) => (
                    <QueueItem key={request.id}>
                      <div>
                        <strong>{request.course_name}</strong>
                        <QueueMeta>
                          {request.contact_name || "Без имени"} · {request.contact_value}
                        </QueueMeta>
                        {request.comment && <QueueMeta>{request.comment}</QueueMeta>}
                        <QueueMeta>{formatDateTime(request.created_at)}</QueueMeta>
                      </div>
                      <QueueActions>
                        <QueueLink to={`/courses/${request.course_id}`}>
                          Публичная страница
                        </QueueLink>
                        <QueueLink to={`/mycourses/${request.course_id}`}>
                          Внутренний курс
                        </QueueLink>
                      </QueueActions>
                    </QueueItem>
                  ))}
                </Stack>
              )}
            </SectionCard>
          </SideColumn>
        </Grid>
      </Content>

      {sessionEditor && (
        <ModalOverlay onClick={() => setSessionEditor(null)}>
          <ModalCard onClick={(event) => event.stopPropagation()}>
            <ModalHeader>
              <div>
                <SectionTitle>{formatDateLabel(sessionEditor.date)}</SectionTitle>
                {sessionEditor.original_date &&
                  sessionEditor.original_date !== sessionEditor.date && (
                    <SectionHint>
                      Перенос с {formatDateLabel(sessionEditor.original_date)}
                    </SectionHint>
                  )}
              </div>
              <IconButton type="button" onClick={() => setSessionEditor(null)}>
                ×
              </IconButton>
            </ModalHeader>

            <FilterRow>
              <Field>
                <Label>Дата</Label>
                <Input
                  type="date"
                  value={sessionEditor.date}
                  onChange={(event) => handleSessionField("date", event.target.value)}
                />
              </Field>
              <Field>
                <Label>Начало</Label>
                <Input
                  type="time"
                  value={sessionEditor.start_time}
                  onChange={(event) => handleSessionField("start_time", event.target.value)}
                />
              </Field>
              <Field>
                <Label>Конец</Label>
                <Input
                  type="time"
                  value={sessionEditor.end_time}
                  onChange={(event) => handleSessionField("end_time", event.target.value)}
                />
              </Field>
            </FilterRow>

            <Field>
              <Label>Комментарий преподавателя</Label>
              <Textarea
                rows={3}
                value={sessionEditor.comment}
                onChange={(event) => handleSessionField("comment", event.target.value)}
              />
            </Field>

            <AttendanceList>
              {sessionEditor.entries.map((entry) => (
                <AttendanceRow key={entry.student_id}>
                  <StudentLine>
                    <strong>
                      {entry.name} {entry.surname}
                    </strong>
                    <span>@{entry.tg_username}</span>
                  </StudentLine>

                  <ToggleWrap>
                    <CheckInput
                      type="checkbox"
                      checked={entry.present}
                      onChange={(event) =>
                        handleSessionEntry(entry.student_id, "present", event.target.checked)
                      }
                    />
                    <ToggleText>Был</ToggleText>
                  </ToggleWrap>

                  <ToggleWrap>
                    <CheckInput
                      type="checkbox"
                      checked={entry.paid}
                      onChange={(event) =>
                        handleSessionEntry(entry.student_id, "paid", event.target.checked)
                      }
                    />
                    <ToggleText>Оплачено</ToggleText>
                  </ToggleWrap>

                  <NoteInput
                    placeholder="Комментарий"
                    value={entry.note}
                    onChange={(event) =>
                      handleSessionEntry(entry.student_id, "note", event.target.value)
                    }
                  />
                </AttendanceRow>
              ))}
            </AttendanceList>

            <ActionRow>
              <DangerButton
                type="button"
                onClick={() => handleSaveSession(true)}
                disabled={saving}
              >
                Удалить занятие
              </DangerButton>
              <SecondaryButton type="button" onClick={() => setSessionEditor(null)}>
                Отмена
              </SecondaryButton>
              <PrimaryButton type="button" onClick={() => handleSaveSession(false)} disabled={saving}>
                {saving ? "Сохраняю..." : "Сохранить"}
              </PrimaryButton>
            </ActionRow>
          </ModalCard>
        </ModalOverlay>
      )}
    </Page>
  );
}

export default TeachingPage;

const Page = styled.div`
  min-height: 100vh;
`;

const Content = styled.main`
  max-width: 1240px;
  margin: 0 auto;
  padding: 36px 24px 80px;
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const HeroCard = styled.section`
  background: linear-gradient(135deg, #eef7ff 0%, #ffffff 62%);
  border: 1px solid var(--border);
  border-radius: 28px;
  box-shadow: var(--shadow);
  padding: 28px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 24px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Eyebrow = styled.div`
  color: #23598d;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const Title = styled.h1`
  font-size: clamp(34px, 5vw, 52px);
  margin-top: 10px;
`;

const HeroText = styled.p`
  color: var(--muted);
  line-height: 1.7;
  margin-top: 12px;
  max-width: 760px;
`;

const HeroStats = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(110px, 1fr));
  gap: 12px;
`;

const StatBox = styled.div`
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid #d8e6f3;
  border-radius: 18px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  span {
    color: var(--muted);
    font-size: 13px;
  }

  strong {
    font-size: 28px;
  }
`;

const Grid = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.8fr);
  gap: 24px;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const MainColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const SideColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const SectionCard = styled.section`
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 24px;
  box-shadow: var(--shadow);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const SectionTitle = styled.h2`
  font-size: clamp(24px, 3vw, 34px);
`;

const SectionHint = styled.p`
  color: var(--muted);
  line-height: 1.6;
  margin-top: 6px;
`;

const QuickFilters = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const QuickButton = styled.button`
  border: 1px solid ${(props) => (props.$active ? "#3d82c4" : "#d8dee8")};
  border-radius: 999px;
  padding: 11px 16px;
  font: inherit;
  font-weight: 700;
  background: ${(props) => (props.$active ? "#eef5fb" : "#fff")};
  color: ${(props) => (props.$active ? "#23598d" : "var(--text)")};
  cursor: pointer;
`;

const SelectorRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 620px) {
    grid-template-columns: 1fr;
  }
`;

const CalendarRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 620px) {
    grid-template-columns: 1fr;
  }
`;

const FilterRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 920px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 620px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.span`
  font-weight: 700;
`;

const Select = styled.select`
  width: 100%;
  border: 1px solid #d8dee8;
  border-radius: 14px;
  padding: 12px 14px;
  font: inherit;
  background: #fff;
`;

const Input = styled.input`
  width: 100%;
  border: 1px solid #d8dee8;
  border-radius: 14px;
  padding: 12px 14px;
  font: inherit;
  background: #fff;
`;

const Textarea = styled.textarea`
  width: 100%;
  border: 1px solid #d8dee8;
  border-radius: 16px;
  padding: 14px;
  font: inherit;
  resize: vertical;
  background: #fff;
`;

const GroupMetaCard = styled.div`
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid #e6ebf2;
  padding: 16px;
`;

const SessionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SessionCard = styled.div`
  border-radius: 20px;
  background: #f8fafc;
  border: 1px solid #e6ebf2;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const SessionTop = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
`;

const SessionTitleLine = styled.h3`
  font-size: 22px;
`;

const SessionMeta = styled.div`
  color: var(--muted);
  line-height: 1.5;
`;

const SessionStats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
`;

const SessionStat = styled.div`
  border-radius: 16px;
  background: #fff;
  border: 1px solid #e6ebf2;
  padding: 12px 14px;

  span {
    display: block;
    color: var(--muted);
    margin-bottom: 8px;
  }
`;

const SessionComment = styled.div`
  color: var(--muted);
  line-height: 1.6;
`;

const AttendanceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const AttendanceRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px 140px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 14px;
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid #e6ebf2;

  @media (max-width: 920px) {
    grid-template-columns: 1fr;
  }
`;

const StudentLine = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;

  span {
    color: var(--muted);
  }
`;

const ToggleWrap = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
`;

const CheckInput = styled.input`
  width: 18px;
  height: 18px;
`;

const ToggleText = styled.span`
  white-space: nowrap;
`;

const NoteInput = styled(Input)``;

const PrimaryButton = styled.button`
  border: none;
  border-radius: 16px;
  padding: 13px 18px;
  font: inherit;
  font-weight: 800;
  background: #3d82c4;
  color: #fff;
  cursor: pointer;
`;

const SecondaryButton = styled.button`
  border: 1px solid #d8dee8;
  border-radius: 14px;
  padding: 12px 16px;
  font: inherit;
  font-weight: 700;
  background: #fff;
  cursor: pointer;
`;

const DangerButton = styled.button`
  border: none;
  border-radius: 14px;
  padding: 12px 16px;
  font: inherit;
  font-weight: 800;
  background: #f05d5d;
  color: #fff;
  cursor: pointer;
`;

const CountBadge = styled.div`
  min-width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #eef5fb;
  color: #23598d;
  display: grid;
  place-items: center;
  font-weight: 800;
`;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const QueueItem = styled.div`
  padding: 16px;
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid #e6ebf2;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const QueueActions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const QueueMeta = styled.div`
  color: var(--muted);
  line-height: 1.55;
`;

const QueueLink = styled(Link)`
  text-decoration: none;
  align-self: flex-start;
  border-radius: 14px;
  padding: 10px 14px;
  background: #eef5fb;
  color: #23598d;
  font-weight: 800;
`;

const StatusCard = styled.div`
  border-radius: 18px;
  padding: 16px 18px;
  background: ${(props) => (props.$error ? "#fff1f1" : "#effaf5")};
  color: ${(props) => (props.$error ? "#b94a48" : "#1f7a52")};
  border: 1px solid ${(props) => (props.$error ? "#f2c9c9" : "#cdeedc")};
`;

const EmptyState = styled.div`
  padding: 18px;
  border-radius: 18px;
  background: #f8fafc;
  color: var(--muted);
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(20, 25, 37, 0.46);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 40;
`;

const ModalCard = styled.div`
  width: min(1080px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
  background: #fff;
  border-radius: 28px;
  border: 1px solid #e8ebf2;
  box-shadow: 0 28px 80px rgba(19, 24, 34, 0.2);
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
`;

const IconButton = styled.button`
  width: 44px;
  height: 44px;
  border: 1px solid #d7dbe4;
  border-radius: 999px;
  background: #fff;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-top: 6px;
`;
