import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Link, Navigate } from "react-router-dom";

import Header from "../components/Header/Header";
import { createStudent, listStudents, updateStudent } from "../api/account";
import { getCurrentUserType, isAuthenticated } from "../api/auth";

const emptyStudentForm = {
  user_id: "",
  name: "",
  surname: "",
  tg_username: "",
  telegram_id: "",
  phone: "",
  password: "",
  status: "active",
  course_ids: [],
  course_group_ids: {},
};

const fieldLabels = {
  name: "Имя",
  surname: "Фамилия",
  tg_username: "Логин",
  telegram_id: "TG ID",
  phone: "Телефон",
  password: "Пароль",
  status: "Статус",
  course_ids: "Курсы",
};

function formatProgress(value) {
  const numeric = Number(value) || 0;
  return `${numeric.toFixed(numeric % 1 === 0 ? 0 : 1)}%`;
}

function getFieldMessage(field, message) {
  if (!message) {
    return "Проверьте это поле.";
  }

  if (message === "String should have at least 6 characters") {
    return `${fieldLabels[field] || "Поле"}: минимум 6 символов.`;
  }

  if (message === "String should have at least 2 characters") {
    return `${fieldLabels[field] || "Поле"}: минимум 2 символа.`;
  }

  if (message === "String should have at most 33 characters") {
    return `${fieldLabels[field] || "Поле"}: максимум 33 символа.`;
  }

  if (message === "String should have at most 20 characters") {
    return `${fieldLabels[field] || "Поле"}: максимум 20 символов.`;
  }

  if (message === "Field required") {
    return `${fieldLabels[field] || "Поле"} обязательно для заполнения.`;
  }

  return message;
}

function mapStudentFieldErrors(details) {
  if (!Array.isArray(details)) {
    return {};
  }

  return details.reduce((acc, issue) => {
    const loc = Array.isArray(issue?.loc) ? issue.loc : [];
    const field = loc[loc.length - 1];
    if (typeof field !== "string") {
      return acc;
    }
    acc[field] = getFieldMessage(field, issue?.msg);
    return acc;
  }, {});
}

function StudentsPage() {
  const authed = isAuthenticated();
  const userType = getCurrentUserType();
  const canManageStudents = userType === "teacher" || userType === "admin";
  const isTeacher = userType === "teacher";

  const [students, setStudents] = useState([]);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [studentForm, setStudentForm] = useState(emptyStudentForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);

  const loadStudents = async ({ showLoader = true } = {}) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      const response = await listStudents();
      setStudents(response.students || []);
      setAvailableCourses(response.available_courses || []);
      setPageError("");
    } catch (err) {
      setPageError(err.message || "Не удалось загрузить учеников");
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (authed && canManageStudents) {
      loadStudents();
    }
  }, [authed, canManageStudents]);

  if (!authed) {
    return <Navigate to="/login" replace />;
  }

  if (!canManageStudents) {
    return <Navigate to="/profile" replace />;
  }

  const isEditing = Boolean(studentForm.user_id);
  const activeStudentsCount = students.filter(
    (student) => student.status === "active"
  ).length;
  const averageProgress = students.length
    ? students.reduce(
        (sum, student) => sum + (Number(student.progress_percent) || 0),
        0
      ) / students.length
    : 0;

  const clearFormState = () => {
    setFieldErrors({});
    setFormError("");
  };

  const closeModal = () => {
    setStudentForm(emptyStudentForm);
    setShowModal(false);
    clearFormState();
  };

  const startCreate = () => {
    setStudentForm(emptyStudentForm);
    setShowModal(true);
    setMessage("");
    clearFormState();
  };

  const startEdit = (student) => {
    setStudentForm({
      user_id: student.user_id,
      name: student.name || "",
      surname: student.surname || "",
      tg_username: student.tg_username || "",
      telegram_id: student.telegram_id || "",
      phone: student.phone || "",
      password: "",
      status: student.status || "active",
      course_ids: student.course_ids || [],
      course_group_ids: student.course_group_ids || {},
    });
    setShowModal(true);
    setMessage("");
    clearFormState();
  };

  const toggleStudentCourse = (courseId) => {
    setStudentForm((prev) => ({
      ...prev,
      course_ids: prev.course_ids.includes(courseId)
        ? prev.course_ids.filter((item) => item !== courseId)
        : [...prev.course_ids, courseId],
      course_group_ids: prev.course_ids.includes(courseId)
        ? Object.fromEntries(
            Object.entries(prev.course_group_ids).filter(
              ([key]) => key !== courseId
            )
          )
        : prev.course_group_ids,
    }));
    setFieldErrors((prev) => ({ ...prev, course_ids: "" }));
  };

  const setFieldValue = (field, value) => {
    setStudentForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    setFormError("");
  };

  const courseHint = isTeacher
    ? "Для преподавателя новый ученик должен быть сразу назначен хотя бы на один ваш курс."
    : "Администратор может создать ученика и позже распределить его по курсам.";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    clearFormState();
    setMessage("");

    try {
      if (isTeacher && studentForm.course_ids.length === 0) {
        setFieldErrors({
          course_ids: "Нужно назначить ученика хотя бы на один ваш курс.",
        });
        return;
      }

      if (isEditing) {
        await updateStudent(studentForm.user_id, {
          name: studentForm.name,
          surname: studentForm.surname,
          tg_username: studentForm.tg_username,
          telegram_id: studentForm.telegram_id || null,
          phone: studentForm.phone || null,
          password: studentForm.password || undefined,
          status: studentForm.status,
          course_ids: studentForm.course_ids,
          course_group_ids: studentForm.course_group_ids,
        });
      } else {
        await createStudent({
          name: studentForm.name,
          surname: studentForm.surname,
          tg_username: studentForm.tg_username,
          telegram_id: studentForm.telegram_id || null,
          phone: studentForm.phone || null,
          password: studentForm.password,
          course_ids: studentForm.course_ids,
          course_group_ids: studentForm.course_group_ids,
        });
      }

      closeModal();
      setMessage(
        isEditing ? "Аккаунт ученика обновлен." : "Аккаунт ученика создан."
      );
      await loadStudents({ showLoader: false });
    } catch (err) {
      const nextFieldErrors = mapStudentFieldErrors(err.details);
      if (Object.keys(nextFieldErrors).length > 0) {
        setFieldErrors(nextFieldErrors);
      } else if (
        String(err.message || "")
          .toLowerCase()
          .includes("username")
      ) {
        setFieldErrors({ tg_username: "Такой логин уже существует." });
      } else {
        setFormError(err.message || "Не удалось сохранить ученика");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <Header />
      <Content>
        {message && <InfoCard>{message}</InfoCard>}
        {pageError && <InfoCard $error>{pageError}</InfoCard>}

        <HeroCard>
          <HeroCopy>
            <Eyebrow>Преподавательский раздел</Eyebrow>
            <HeroTitle>Ученики и назначения на курсы</HeroTitle>
            <HeroText>
              Здесь можно создавать аккаунты учеников, менять их данные,
              назначать на свои курсы и сразу смотреть фактический прогресс по
              каждому курсу.
            </HeroText>
          </HeroCopy>

          <HeroActions>
            <PrimaryButton type="button" onClick={startCreate}>
              Создать аккаунт ученика
            </PrimaryButton>
            <SecondaryLink to="/profile">Вернуться в профиль</SecondaryLink>
          </HeroActions>

          <StatsGrid>
            <StatCard>
              <span>Учеников в работе</span>
              <strong>{students.length}</strong>
            </StatCard>
            <StatCard>
              <span>Активных аккаунтов</span>
              <strong>{activeStudentsCount}</strong>
            </StatCard>
            <StatCard>
              <span>Доступных курсов</span>
              <strong>{availableCourses.length}</strong>
            </StatCard>
            <StatCard>
              <span>Средний прогресс</span>
              <strong>{formatProgress(averageProgress)}</strong>
            </StatCard>
          </StatsGrid>
        </HeroCard>

        <SectionCard>
          <SectionHeader>
            <div>
              <SectionTitle>Список учеников</SectionTitle>
              <SectionText>
                Видны только те ученики, которые закреплены за вашими курсами.
              </SectionText>
            </div>
          </SectionHeader>

          {loading ? (
            <EmptyState>Загрузка учеников...</EmptyState>
          ) : students.length === 0 ? (
            <EmptyState>
              Пока нет учеников. Создайте аккаунт и назначьте его на курс.
            </EmptyState>
          ) : (
            <Cards>
              {students.map((student) => (
                <StudentCard key={student.user_id}>
                  <StudentTop>
                    <div>
                      <StudentName>
                        {student.name} {student.surname}
                      </StudentName>
                      <StudentMeta>@{student.tg_username}</StudentMeta>
                      <StudentMeta>
                        Баллы: {student.points} из {student.total_points}
                      </StudentMeta>
                    </div>

                    <TopActions>
                      <StatusBadge $status={student.status}>
                        {student.status}
                      </StatusBadge>
                      <SecondaryButton
                        type="button"
                        onClick={() => startEdit(student)}
                      >
                        Изменить
                      </SecondaryButton>
                    </TopActions>
                  </StudentTop>

                  <ProgressHeader>
                    <span>Общий прогресс</span>
                    <strong>{formatProgress(student.progress_percent)}</strong>
                  </ProgressHeader>
                  <ProgressTrack>
                    <ProgressFill
                      style={{
                        width: `${Math.min(
                          100,
                          Number(student.progress_percent) || 0
                        )}%`,
                      }}
                    />
                  </ProgressTrack>

                  <CourseProgressList>
                    {(student.course_progress || []).length === 0 ? (
                      <CourseProgressCard>
                        <CourseMeta>Курсы пока не назначены</CourseMeta>
                      </CourseProgressCard>
                    ) : (
                      (student.course_progress || []).map((course) => (
                        <CourseProgressCard
                          key={`${student.user_id}-${course.course_id}`}
                        >
                          <CourseRow>
                            <CourseLink to={`/mycourses/${course.course_id}`}>
                              {course.course_name}
                            </CourseLink>
                            <strong>
                              {formatProgress(course.progress_percent)}
                            </strong>
                          </CourseRow>
                          <CourseMeta>
                            {course.earned_points} / {course.total_points} баллов
                          </CourseMeta>
                          <MiniTrack>
                            <MiniFill
                              style={{
                                width: `${Math.min(
                                  100,
                                  Number(course.progress_percent) || 0
                                )}%`,
                              }}
                            />
                          </MiniTrack>
                        </CourseProgressCard>
                      ))
                    )}
                  </CourseProgressList>
                </StudentCard>
              ))}
            </Cards>
          )}
        </SectionCard>
      </Content>

      {showModal && (
        <ModalOverlay onClick={closeModal}>
          <ModalCard
            data-course-hint={courseHint}
            onClick={(event) => event.stopPropagation()}
          >
            <ModalHeader>
              <div>
                <SectionTitle>
                  {isEditing
                    ? "Редактирование ученика"
                    : "Создать аккаунт ученика"}
                </SectionTitle>
              </div>
              <IconButton type="button" onClick={closeModal} aria-label="Закрыть">
                ×
              </IconButton>
            </ModalHeader>

            {formError && <InfoCard $error>{formError}</InfoCard>}

            <form onSubmit={handleSubmit}>
              <FormGrid>
                <Field>
                  <Label>Имя</Label>
                  <Input
                    $error={Boolean(fieldErrors.name)}
                    value={studentForm.name}
                    onChange={(event) => setFieldValue("name", event.target.value)}
                    required
                  />
                  {fieldErrors.name && <FieldError>{fieldErrors.name}</FieldError>}
                </Field>
                <Field>
                  <Label>Фамилия</Label>
                  <Input
                    $error={Boolean(fieldErrors.surname)}
                    value={studentForm.surname}
                    onChange={(event) =>
                      setFieldValue("surname", event.target.value)
                    }
                    required
                  />
                  {fieldErrors.surname && (
                    <FieldError>{fieldErrors.surname}</FieldError>
                  )}
                </Field>
                <Field>
                  <Label>Логин</Label>
                  <Input
                    $error={Boolean(fieldErrors.tg_username)}
                    value={studentForm.tg_username}
                    onChange={(event) =>
                      setFieldValue("tg_username", event.target.value)
                    }
                    required
                  />
                  {fieldErrors.tg_username && (
                    <FieldError>{fieldErrors.tg_username}</FieldError>
                  )}
                </Field>
                <Field>
                  <Label>TG ID</Label>
                  <Input
                    $error={Boolean(fieldErrors.telegram_id)}
                    value={studentForm.telegram_id}
                    onChange={(event) =>
                      setFieldValue("telegram_id", event.target.value)
                    }
                  />
                  {fieldErrors.telegram_id && (
                    <FieldError>{fieldErrors.telegram_id}</FieldError>
                  )}
                </Field>
                <Field>
                  <Label>Телефон</Label>
                  <Input
                    $error={Boolean(fieldErrors.phone)}
                    value={studentForm.phone}
                    onChange={(event) => setFieldValue("phone", event.target.value)}
                  />
                  {fieldErrors.phone && <FieldError>{fieldErrors.phone}</FieldError>}
                </Field>
                <Field>
                  <Label>Пароль</Label>
                  <Input
                    type="password"
                    $error={Boolean(fieldErrors.password)}
                    value={studentForm.password}
                    onChange={(event) =>
                      setFieldValue("password", event.target.value)
                    }
                    required={!isEditing}
                    placeholder={
                      isEditing ? "Оставьте пустым, чтобы не менять" : ""
                    }
                  />
                  {fieldErrors.password && (
                    <FieldError>{fieldErrors.password}</FieldError>
                  )}
                </Field>
                <Field>
                  <Label>Статус</Label>
                  <Select
                    $error={Boolean(fieldErrors.status)}
                    value={studentForm.status}
                    onChange={(event) => setFieldValue("status", event.target.value)}
                  >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </Select>
                  {fieldErrors.status && (
                    <FieldError>{fieldErrors.status}</FieldError>
                  )}
                </Field>
              </FormGrid>

              <CoursesBlock>
                <BlockTitle>Назначение на курсы</BlockTitle>
                {availableCourses.length === 0 ? (
                  <EmptyState>
                    У вас пока нет доступных курсов для назначения учеников.
                  </EmptyState>
                ) : (
                  <>
                    <CourseChips>
                      {availableCourses.map((course) => (
                        <CourseChip key={course.id}>
                          <input
                            type="checkbox"
                            checked={studentForm.course_ids.includes(course.id)}
                            onChange={() => toggleStudentCourse(course.id)}
                          />
                          <span>{course.name}</span>
                        </CourseChip>
                      ))}
                    </CourseChips>
                    {studentForm.course_ids.map((courseId) => {
                      const selectedCourse = availableCourses.find(
                        (course) => course.id === courseId
                      );
                      if (!selectedCourse || !selectedCourse.groups?.length) {
                        return null;
                      }

                      return (
                        <Field key={`${courseId}-group`}>
                          <Label>Группа для курса "{selectedCourse.name}"</Label>
                          <Select
                            value={studentForm.course_group_ids[courseId] || ""}
                            onChange={(event) =>
                              setStudentForm((prev) => ({
                                ...prev,
                                course_group_ids: {
                                  ...prev.course_group_ids,
                                  [courseId]: event.target.value,
                                },
                              }))
                            }
                          >
                            <option value="">Без группы</option>
                            {selectedCourse.groups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      );
                    })}
                    {fieldErrors.course_ids && (
                      <FieldError>{fieldErrors.course_ids}</FieldError>
                    )}
                  </>
                )}
              </CoursesBlock>

              <ActionRow>
                <SecondaryButton type="button" onClick={closeModal}>
                  Отмена
                </SecondaryButton>
                <PrimaryButton type="submit" disabled={saving}>
                  {saving
                    ? "Сохраняю..."
                    : isEditing
                    ? "Сохранить изменения"
                    : "Создать ученика"}
                </PrimaryButton>
              </ActionRow>
            </form>
          </ModalCard>
        </ModalOverlay>
      )}
    </Page>
  );
}

export default StudentsPage;

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
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.7fr);
  gap: 24px;
  background: linear-gradient(135deg, #fff6ec 0%, #ffffff 55%);
  border: 1px solid var(--border);
  border-radius: 28px;
  box-shadow: var(--shadow);
  padding: 28px;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

const HeroCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Eyebrow = styled.div`
  color: var(--orange);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const HeroTitle = styled.h1`
  font-size: clamp(32px, 5vw, 52px);
`;

const HeroText = styled.p`
  color: var(--muted);
  line-height: 1.7;
  max-width: 760px;
`;

const HeroActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: flex-start;
  align-items: stretch;
`;

const StatsGrid = styled.div`
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
`;

const StatCard = styled.div`
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #f0e3d4;
  border-radius: 20px;
  padding: 16px 18px;

  span {
    display: block;
    color: var(--muted);
    margin-bottom: 8px;
  }

  strong {
    font-size: 28px;
  }
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
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
  flex-wrap: wrap;
`;

const SectionTitle = styled.h2`
  font-size: 30px;
`;

const SectionText = styled.p`
  color: var(--muted);
  line-height: 1.6;
  max-width: 640px;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;

  @media (max-width: 720px) {
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

const Input = styled.input`
  width: 100%;
  border: 1px solid ${(props) => (props.$error ? "#df6b6b" : "#d7dbe4")};
  box-shadow: ${(props) =>
    props.$error ? "0 0 0 3px rgba(223, 107, 107, 0.12)" : "none"};
  border-radius: 12px;
  padding: 13px 14px;
  background: #fff;
`;

const Select = styled.select`
  width: 100%;
  border: 1px solid ${(props) => (props.$error ? "#df6b6b" : "#d7dbe4")};
  box-shadow: ${(props) =>
    props.$error ? "0 0 0 3px rgba(223, 107, 107, 0.12)" : "none"};
  border-radius: 12px;
  padding: 13px 14px;
  background: #fff;
`;

const FieldError = styled.div`
  color: #c64d4d;
  font-size: 14px;
  line-height: 1.5;
`;

const CoursesBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 18px;
`;

const BlockTitle = styled.h3`
  font-size: 20px;
`;

const CourseChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const CourseChip = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 10px 14px;
  background: #f5f6fa;
  border: 1px solid #e6e8ef;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-top: 22px;
`;

const Cards = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const StudentCard = styled.article`
  border: 1px solid #e9ebf0;
  border-radius: 22px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
`;

const StudentTop = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
`;

const StudentName = styled.h3`
  font-size: 24px;
`;

const StudentMeta = styled.div`
  color: var(--muted);
  line-height: 1.6;
`;

const TopActions = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
`;

const StatusBadge = styled.div`
  border-radius: 999px;
  padding: 8px 12px;
  font-weight: 800;
  text-transform: lowercase;
  background: ${(props) =>
    props.$status === "active" ? "#e1f7f0" : "#f1f2f6"};
  color: ${(props) =>
    props.$status === "active" ? "#12795f" : "#646b79"};
`;

const ProgressHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;

  span {
    color: var(--muted);
  }
`;

const ProgressTrack = styled.div`
  width: 100%;
  height: 14px;
  border-radius: 999px;
  background: #edf0f5;
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #17a085 0%, #22c3a4 100%);
`;

const CourseProgressList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
`;

const CourseProgressCard = styled.div`
  border-radius: 18px;
  background: #f8f9fc;
  border: 1px solid #edf0f4;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const CourseRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
`;

const CourseLink = styled(Link)`
  text-decoration: none;
  font-weight: 800;
`;

const CourseMeta = styled.div`
  color: var(--muted);
  line-height: 1.5;
`;

const MiniTrack = styled.div`
  width: 100%;
  height: 10px;
  border-radius: 999px;
  background: #e7ebf2;
  overflow: hidden;
`;

const MiniFill = styled.div`
  height: 100%;
  border-radius: 999px;
  background: var(--orange);
`;

const PrimaryButton = styled.button`
  border: none;
  border-radius: 12px;
  background: var(--orange);
  color: #fff;
  padding: 14px 18px;
  font-weight: 800;
  cursor: pointer;

  &:disabled {
    opacity: 0.65;
    cursor: wait;
  }
`;

const SecondaryButton = styled.button`
  border: 1px solid #d7dbe4;
  border-radius: 12px;
  background: #fff;
  color: var(--text);
  padding: 14px 18px;
  font-weight: 700;
  cursor: pointer;
`;

const SecondaryLink = styled(Link)`
  border: 1px solid #d7dbe4;
  border-radius: 12px;
  background: #fff;
  color: var(--text);
  padding: 14px 18px;
  font-weight: 700;
  text-decoration: none;
  text-align: center;
`;

const EmptyState = styled.div`
  padding: 16px 18px;
  border-radius: 18px;
  background: #f6f8fb;
  color: var(--muted);
  line-height: 1.6;
`;

const InfoCard = styled.div`
  padding: 16px 18px;
  border-radius: 16px;
  background: ${(props) => (props.$error ? "#fff0f0" : "#f2f6ff")};
  color: ${(props) => (props.$error ? "#b53d3d" : "#334b7d")};
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
  width: min(980px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
  background: #fff;
  border-radius: 28px;
  border: 1px solid #e8ebf2;
  box-shadow: 0 28px 80px rgba(19, 24, 34, 0.2);
  padding: 28px;
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
