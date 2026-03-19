import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { Link, Navigate } from "react-router-dom";

import Header from "../components/Header/Header";
import { getDashboard } from "../api/account";
import { getCurrentUserType, isAuthenticated } from "../api/auth";
import { getCourseDetail, getMyCourses } from "../api/learning";
import { getAttendanceSession, saveAttendanceSession } from "../api/teaching";

function getTodayValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function TeachingPage() {
  const authed = isAuthenticated();
  const userType = getCurrentUserType();
  const canTeach = userType === "teacher" || userType === "admin";

  const [dashboard, setDashboard] = useState(null);
  const [courses, setCourses] = useState([]);
  const [courseDetail, setCourseDetail] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedDate, setSelectedDate] = useState(getTodayValue());
  const [attendanceForm, setAttendanceForm] = useState({});
  const [attendanceComment, setAttendanceComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [courseLoading, setCourseLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
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
        setDashboard(dashboardResponse);
        const nextCourses = coursesResponse.courses || [];
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
        setCourseDetail(response);
        const groups = response.groups || [];
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
    const loadAttendance = async () => {
      if (!selectedGroupId || !selectedDate) {
        setAttendanceForm({});
        setAttendanceComment("");
        return;
      }

      try {
        setAttendanceLoading(true);
        const response = await getAttendanceSession(selectedGroupId, selectedDate);
        const entriesMap = {};
        (groupStudents || []).forEach((student) => {
          const saved = (response.entries || []).find(
            (entry) => entry.student_id === student.user_id
          );
          entriesMap[student.user_id] = {
            present: Boolean(saved?.present),
            note: saved?.note || "",
          };
        });
        setAttendanceForm(entriesMap);
        setAttendanceComment(response.comment || "");
        setError("");
      } catch (err) {
        setError(err.message || "Не удалось загрузить посещаемость");
      } finally {
        setAttendanceLoading(false);
      }
    };

    if (selectedGroupId && selectedDate && courseDetail) {
      loadAttendance();
    }
  }, [selectedDate, selectedGroupId, groupStudents, courseDetail]);

  if (!authed) {
    return <Navigate to="/login" replace />;
  }

  if (!canTeach) {
    return <Navigate to="/profile" replace />;
  }

  const pendingReviews = dashboard?.pending_reviews || [];
  const courseRequests = dashboard?.course_requests || [];

  const handleAttendanceField = (studentId, field, value) => {
    setAttendanceForm((prev) => ({
      ...prev,
      [studentId]: {
        present: prev[studentId]?.present || false,
        note: prev[studentId]?.note || "",
        [field]: value,
      },
    }));
  };

  const handleAttendanceSave = async () => {
    if (!selectedGroupId || !selectedDate) return;
    try {
      setSaving(true);
      await saveAttendanceSession(selectedGroupId, selectedDate, {
        entries: groupStudents.map((student) => ({
          student_id: student.user_id,
          present: Boolean(attendanceForm[student.user_id]?.present),
          note: attendanceForm[student.user_id]?.note || "",
        })),
        comment: attendanceComment,
      });
      setMessage("Посещаемость сохранена.");
      setError("");
    } catch (err) {
      setError(err.message || "Не удалось сохранить посещаемость");
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
              Здесь собраны ручная проверка, заявки на курсы и посещаемость по группам
              на конкретные даты.
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
                  <SectionTitle>Посещаемость</SectionTitle>
                  <SectionHint>Выберите курс, группу и дату, затем отметьте присутствие.</SectionHint>
                </div>
              </SectionHeader>

              {loading ? (
                <EmptyState>Загрузка...</EmptyState>
              ) : courses.length === 0 ? (
                <EmptyState>У вас пока нет курсов для управления.</EmptyState>
              ) : (
                <>
                  <FilterRow>
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
                    <Field>
                      <Label>Дата</Label>
                      <Input
                        type="date"
                        value={selectedDate}
                        onChange={(event) => setSelectedDate(event.target.value)}
                      />
                    </Field>
                  </FilterRow>

                  {courseLoading || attendanceLoading ? (
                    <EmptyState>Загрузка данных группы...</EmptyState>
                  ) : !selectedGroup ? (
                    <EmptyState>В этом курсе пока нет групп.</EmptyState>
                  ) : groupStudents.length === 0 ? (
                    <EmptyState>В выбранной группе пока нет учеников.</EmptyState>
                  ) : (
                    <>
                      <AttendanceHeader>
                        <div>
                          <strong>{selectedGroup.name}</strong>
                          {selectedGroup.schedule_summary && (
                            <SectionHint>{selectedGroup.schedule_summary}</SectionHint>
                          )}
                        </div>
                        <PrimaryButton type="button" onClick={handleAttendanceSave} disabled={saving}>
                          {saving ? "Сохраняю..." : "Сохранить посещаемость"}
                        </PrimaryButton>
                      </AttendanceHeader>

                      <AttendanceList>
                        {groupStudents.map((student) => (
                          <AttendanceRow key={student.user_id}>
                            <StudentLine>
                              <strong>{student.name} {student.surname}</strong>
                              <span>@{student.tg_username}</span>
                            </StudentLine>
                            <ToggleWrap>
                              <CheckInput
                                type="checkbox"
                                checked={Boolean(attendanceForm[student.user_id]?.present)}
                                onChange={(event) =>
                                  handleAttendanceField(
                                    student.user_id,
                                    "present",
                                    event.target.checked
                                  )
                                }
                              />
                              <ToggleText>
                                {attendanceForm[student.user_id]?.present ? "Был" : "Не был"}
                              </ToggleText>
                            </ToggleWrap>
                            <NoteInput
                              placeholder="Комментарий"
                              value={attendanceForm[student.user_id]?.note || ""}
                              onChange={(event) =>
                                handleAttendanceField(
                                  student.user_id,
                                  "note",
                                  event.target.value
                                )
                              }
                            />
                          </AttendanceRow>
                        ))}
                      </AttendanceList>

                      <Field>
                        <Label>Комментарий к занятию</Label>
                        <Textarea
                          rows={4}
                          value={attendanceComment}
                          onChange={(event) => setAttendanceComment(event.target.value)}
                        />
                      </Field>
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
                        <strong>{review.student_name} {review.student_surname}</strong>
                        <QueueMeta>{review.course_name} · {review.lesson_name}</QueueMeta>
                        <QueueMeta>{review.task_title} · попыток: {review.attempts}</QueueMeta>
                        <QueueMeta>
                          @{review.student_tg_username} · {formatDateTime(review.last_submission?.created_at)}
                        </QueueMeta>
                      </div>
                      <QueueLink to={`/mycourses/${review.course_id}/lessons/${review.lesson_id}`}>
                        Открыть урок
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
                    </QueueItem>
                  ))}
                </Stack>
              )}
            </SectionCard>
          </SideColumn>
        </Grid>
      </Content>
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

const FilterRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 760px) {
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

const AttendanceHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
`;

const AttendanceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const AttendanceRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 14px;
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid #e6ebf2;

  @media (max-width: 760px) {
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
