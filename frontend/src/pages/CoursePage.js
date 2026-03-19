import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import Header from "../components/Header/Header";
import { isAuthenticated } from "../api/auth";
import {
  createCourseGroup,
  createLesson,
  deleteCourseGroup,
  getCourseDetail,
  updateCourse,
  updateCourseGroup,
  updateLesson,
} from "../api/learning";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8002";
const EMPTY_LIST = [];

const weekdayOptions = [
  { value: 0, label: "Пн" },
  { value: 1, label: "Вт" },
  { value: 2, label: "Ср" },
  { value: 3, label: "Чт" },
  { value: 4, label: "Пт" },
  { value: 5, label: "Сб" },
  { value: 6, label: "Вс" },
];

const emptyGroupEditor = {
  name: "",
  student_ids: [],
  schedule_slots: [],
};

function resolveAssetUrl(url) {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function moveItemToIndex(list, fromId, targetIndex) {
  const sourceIndex = list.findIndex((item) => item.id === fromId);
  if (sourceIndex === -1) return list;
  const next = [...list];
  const [removed] = next.splice(sourceIndex, 1);
  const boundedIndex = Math.max(0, Math.min(targetIndex, next.length));
  next.splice(boundedIndex, 0, removed);
  return next;
}

function getLessonStatusLabel(lesson, index) {
  if (lesson.is_open) return "Открыт";
  if (index === 0) return "Старт";
  return "Закрыт";
}

function CoursePage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const authed = isAuthenticated();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [courseForm, setCourseForm] = useState(null);
  const [showCourseSettings, setShowCourseSettings] = useState(false);
  const [orderedLessons, setOrderedLessons] = useState([]);
  const [draggedLessonId, setDraggedLessonId] = useState("");
  const [dropTargetIndex, setDropTargetIndex] = useState(null);
  const [groupEditors, setGroupEditors] = useState({});

  const applyCourseResponse = useCallback((response) => {
    setData(response);
    setCourseForm({
      name: response.course.name || "",
      description: response.course.description || "",
      public_info: response.course.public_info || "",
      accent_color: response.course.accent_color || "#16a085",
      cover_image: response.course.cover_image || "",
    });
    setOrderedLessons(response.lessons || []);
    setGroupEditors(
      (response.groups || []).reduce((acc, group) => {
        acc[group.id] = {
          name: group.name || "",
          student_ids: [...(group.students || [])],
          schedule_slots: (group.schedule_slots || []).map((slot) => ({ ...slot })),
        };
        return acc;
      }, {})
    );
  }, []);

  const loadCourse = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getCourseDetail(courseId);
      applyCourseResponse(response);
      setError("");
    } catch (err) {
      setError(err.message || "Не удалось загрузить курс");
    } finally {
      setLoading(false);
    }
  }, [applyCourseResponse, courseId]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  const course = data?.course;
  const groups = data?.groups || EMPTY_LIST;
  const students = data?.students || EMPTY_LIST;
  const leaderboard = data?.leaderboard || EMPTY_LIST;
  const canEdit = course?.can_edit;

  const studentNameById = useMemo(
    () =>
      students.reduce((acc, student) => {
        acc[student.user_id] = `${student.name} ${student.surname}`.trim();
        return acc;
      }, {}),
    [students]
  );

  if (!authed) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <Page>
        <Header />
        <Content>
          <StatusCard>Загрузка курса...</StatusCard>
        </Content>
      </Page>
    );
  }

  if (error && !data) {
    return (
      <Page>
        <Header />
        <Content>
          <StatusCard $error>{error}</StatusCard>
        </Content>
      </Page>
    );
  }

  if (!data || !courseForm) {
    return null;
  }

  const runAction = async (key, action, fallbackMessage) => {
    setBusyKey(key);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (err) {
      setError(err.message || fallbackMessage);
    } finally {
      setBusyKey("");
    }
  };

  const handleCourseSave = async (event) => {
    event.preventDefault();
    await runAction(
      "save-course",
      async () => {
        await updateCourse(courseId, courseForm);
        setNotice("Курс обновлен.");
        await loadCourse();
        setShowCourseSettings(false);
      },
      "Не удалось обновить курс"
    );
  };

  const handleCreateGroup = async () => {
    await runAction(
      "create-group",
      async () => {
        await createCourseGroup(courseId, {});
        setNotice("Группа добавлена.");
        await loadCourse();
      },
      "Не удалось добавить группу"
    );
  };

  const handleCreateLesson = async () => {
    await runAction(
      "create-lesson",
      async () => {
        const existingLessonIds = new Set(orderedLessons.map((lesson) => lesson.id));
        await createLesson({
          name: "Новый урок",
          description: "",
          content: "",
          course_id: courseId,
          resources: [],
          order: orderedLessons.length + 1,
        });
        const response = await getCourseDetail(courseId);
        applyCourseResponse(response);
        setNotice("Урок добавлен.");
        const nextLesson =
          (response.lessons || []).find((lesson) => !existingLessonIds.has(lesson.id)) ||
          (response.lessons || []).at(-1);
        if (nextLesson) {
          navigate(`/mycourses/${courseId}/lessons/${nextLesson.id}`);
        }
      },
      "Не удалось добавить урок"
    );
  };

  const updateGroupField = (groupId, field, value) => {
    setGroupEditors((prev) => ({
      ...prev,
      [groupId]: {
        ...(prev[groupId] || emptyGroupEditor),
        [field]: value,
      },
    }));
  };

  const updateGroupSlot = (groupId, slotIndex, field, value) => {
    const editor = groupEditors[groupId] || emptyGroupEditor;
    const nextSlots = [...(editor.schedule_slots || [])];
    nextSlots[slotIndex] = {
      ...(nextSlots[slotIndex] || { weekday: 0, start_time: "", end_time: "" }),
      [field]: value,
    };
    updateGroupField(groupId, "schedule_slots", nextSlots);
  };

  const addGroupSlot = (groupId) => {
    const editor = groupEditors[groupId] || emptyGroupEditor;
    updateGroupField(groupId, "schedule_slots", [
      ...(editor.schedule_slots || []),
      { weekday: 0, start_time: "", end_time: "" },
    ]);
  };

  const removeGroupSlot = (groupId, slotIndex) => {
    const editor = groupEditors[groupId] || emptyGroupEditor;
    updateGroupField(
      groupId,
      "schedule_slots",
      (editor.schedule_slots || []).filter((_, index) => index !== slotIndex)
    );
  };

  const toggleGroupStudent = (groupId, studentId) => {
    const editor = groupEditors[groupId] || emptyGroupEditor;
    const current = editor.student_ids || [];
    updateGroupField(
      groupId,
      "student_ids",
      current.includes(studentId)
        ? current.filter((item) => item !== studentId)
        : [...current, studentId]
    );
  };

  const handleSaveGroup = async (groupId) => {
    const editor = groupEditors[groupId] || emptyGroupEditor;
    await runAction(
      `save-group-${groupId}`,
      async () => {
        await updateCourseGroup(courseId, groupId, {
          name: (editor.name || "").trim() || "Новая группа",
          student_ids: editor.student_ids || [],
          schedule_slots: (editor.schedule_slots || []).filter(
            (slot) => slot.start_time && slot.weekday !== undefined
          ),
        });
        setNotice("Группа обновлена.");
        await loadCourse();
      },
      "Не удалось обновить группу"
    );
  };

  const handleDeleteGroup = async (groupId) => {
    await runAction(
      `delete-group-${groupId}`,
      async () => {
        await deleteCourseGroup(courseId, groupId);
        setNotice("Группа удалена.");
        await loadCourse();
      },
      "Не удалось удалить группу"
    );
  };

  const persistLessonOrder = async (nextLessons) => {
    await runAction(
      "save-order",
      async () => {
        await Promise.all(
          nextLessons.map((lesson, index) =>
            updateLesson(lesson.id, { order: index + 1 })
          )
        );
        setOrderedLessons(
          nextLessons.map((lesson, index) => ({
            ...lesson,
            order: index + 1,
          }))
        );
        setNotice("Порядок уроков обновлен.");
      },
      "Не удалось сохранить порядок уроков"
    );
  };

  const handleLessonDrop = async (targetIndex) => {
    if (!draggedLessonId) return;
    const nextLessons = moveItemToIndex(orderedLessons, draggedLessonId, targetIndex);
    setDraggedLessonId("");
    setDropTargetIndex(null);
    if (nextLessons.every((lesson, index) => lesson.id === orderedLessons[index]?.id)) {
      return;
    }
    setOrderedLessons(nextLessons);
    await persistLessonOrder(nextLessons);
  };

  const toggleLessonAccess = async (lesson) => {
    await runAction(
      `lesson-access-${lesson.id}`,
      async () => {
        const nextIsOpen = !lesson.is_open;
        await updateLesson(lesson.id, { is_open: nextIsOpen });
        setNotice(nextIsOpen ? "Урок открыт для учеников." : "Урок закрыт для учеников.");
        await loadCourse();
      },
      "Не удалось изменить доступ к уроку"
    );
  };

  return (
    <Page>
      <Header />
      <Content>
        <Breadcrumbs>
          <CrumbLink to="/mycourses">Мои курсы</CrumbLink>
          <span>/</span>
          <CurrentCrumb>{course.name}</CurrentCrumb>
        </Breadcrumbs>

        {notice && <StatusCard>{notice}</StatusCard>}
        {error && <StatusCard $error>{error}</StatusCard>}

        <HeroGrid>
          <HeroCard>
            <HeroTextBlock>
              {showCourseSettings ? (
                <CourseSettingsForm onSubmit={handleCourseSave}>
                  <Field>
                    <Label>Название курса</Label>
                    <TitleInput
                      value={courseForm.name}
                      onChange={(event) =>
                        setCourseForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                    />
                  </Field>
                  <Field>
                    <Label>Краткое описание</Label>
                    <Textarea
                      rows={4}
                      value={courseForm.description}
                      onChange={(event) =>
                        setCourseForm((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field>
                    <Label>Общая информация о курсе</Label>
                    <Textarea
                      rows={8}
                      value={courseForm.public_info}
                      onChange={(event) =>
                        setCourseForm((prev) => ({
                          ...prev,
                          public_info: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <FieldRow>
                    <Field>
                      <Label>Цвет курса</Label>
                      <ColorInput
                        type="color"
                        value={courseForm.accent_color}
                        onChange={(event) =>
                          setCourseForm((prev) => ({
                            ...prev,
                            accent_color: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field>
                      <Label>Картинка курса, URL</Label>
                      <Input
                        value={courseForm.cover_image}
                        onChange={(event) =>
                          setCourseForm((prev) => ({
                            ...prev,
                            cover_image: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </FieldRow>
                  <ActionRow>
                    <PrimaryButton type="submit" disabled={busyKey === "save-course"}>
                      {busyKey === "save-course" ? "Сохраняю..." : "Сохранить курс"}
                    </PrimaryButton>
                    <GhostButton
                      type="button"
                      onClick={() => setShowCourseSettings(false)}
                    >
                      Закрыть
                    </GhostButton>
                  </ActionRow>
                </CourseSettingsForm>
              ) : (
                <>
                  <Eyebrow>Курс</Eyebrow>
                  <HeroTitle>{course.name}</HeroTitle>
                  {course.description && <HeroText>{course.description}</HeroText>}
                  <MetaStack>
                    {course.active_group_name && (
                      <MetaPill>
                        <strong>Группа</strong>
                        <span>{course.active_group_name}</span>
                      </MetaPill>
                    )}
                    {course.active_group_schedule_summary && (
                      <MetaPill>
                        <strong>Расписание</strong>
                        <span>{course.active_group_schedule_summary}</span>
                      </MetaPill>
                    )}
                  </MetaStack>
                  {course.public_info && <HeroInfo>{course.public_info}</HeroInfo>}
                </>
              )}

              {!showCourseSettings && (
                <>
                  <StatsRow>
                    <StatCard>
                      <span>Баллы</span>
                      <strong>
                        {course.earned_points} / {course.total_points}
                      </strong>
                    </StatCard>
                    <StatCard>
                      <span>Прогресс</span>
                      <strong>{Math.round(course.progress_percent || 0)}%</strong>
                    </StatCard>
                    <StatCard>
                      <span>Уроков</span>
                      <strong>{orderedLessons.length}</strong>
                    </StatCard>
                  </StatsRow>
                  <Track>
                    <Fill
                      style={{
                        width: `${Math.min(100, course.progress_percent || 0)}%`,
                        background: course.accent_color || "var(--green)",
                      }}
                    />
                  </Track>
                </>
              )}

              {canEdit && !showCourseSettings && (
                <ActionRow>
                  <PrimaryButton
                    type="button"
                    onClick={handleCreateGroup}
                    disabled={busyKey === "create-group"}
                  >
                    {busyKey === "create-group" ? "Добавляю..." : "Добавить группу"}
                  </PrimaryButton>
                  <PrimaryButton
                    type="button"
                    onClick={handleCreateLesson}
                    disabled={busyKey === "create-lesson"}
                  >
                    {busyKey === "create-lesson" ? "Добавляю..." : "Добавить урок"}
                  </PrimaryButton>
                  <SecondaryButton
                    type="button"
                    onClick={() => setShowCourseSettings(true)}
                  >
                    Настроить курс
                  </SecondaryButton>
                </ActionRow>
              )}
            </HeroTextBlock>

            <HeroVisual>
              {course.cover_image ? (
                <HeroImage src={resolveAssetUrl(course.cover_image)} alt={course.name} />
              ) : (
                <VisualPlaceholder
                  style={{
                    background: `linear-gradient(135deg, ${course.accent_color || "#16a085"} 0%, #f7fafc 92%)`,
                  }}
                />
              )}
            </HeroVisual>
          </HeroCard>

          <LeaderboardCard>
            <SectionTitle>Рейтинг курса</SectionTitle>
            {leaderboard.length === 0 ? (
              <EmptyState>Пока нет участников с баллами.</EmptyState>
            ) : (
              <LeaderboardList>
                {leaderboard.map((entry, index) => (
                  <LeaderboardRow key={entry.user_id}>
                    <LeaderboardPlace>{index + 1}</LeaderboardPlace>
                    <LeaderboardPerson>
                      <strong>{`${entry.name} ${entry.surname}`.trim()}</strong>
                      <small>@{entry.tg_username}</small>
                    </LeaderboardPerson>
                    <LeaderboardPoints>{entry.points} XP</LeaderboardPoints>
                  </LeaderboardRow>
                ))}
              </LeaderboardList>
            )}
          </LeaderboardCard>
        </HeroGrid>

        {canEdit && groups.length > 0 && (
          <SectionCard>
            <SectionHeader>
              <div>
                <SectionTitle>Группы</SectionTitle>
                <SectionHint>Расписание и состав группы редактируются прямо здесь.</SectionHint>
              </div>
            </SectionHeader>
            <GroupGrid>
              {groups.map((group) => {
                const editor = groupEditors[group.id] || emptyGroupEditor;
                return (
                  <GroupCard key={group.id}>
                    <Field>
                      <Label>Название группы</Label>
                      <Input
                        value={editor.name}
                        onChange={(event) =>
                          updateGroupField(group.id, "name", event.target.value)
                        }
                      />
                    </Field>

                    <Field>
                      <Label>Занятия</Label>
                      <SlotStack>
                        {(editor.schedule_slots || []).map((slot, slotIndex) => (
                          <SlotRow key={`${group.id}-${slotIndex}`}>
                            <Select
                              value={slot.weekday ?? 0}
                              onChange={(event) =>
                                updateGroupSlot(
                                  group.id,
                                  slotIndex,
                                  "weekday",
                                  Number(event.target.value)
                                )
                              }
                            >
                              {weekdayOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </Select>
                            <Input
                              type="time"
                              value={slot.start_time || ""}
                              onChange={(event) =>
                                updateGroupSlot(
                                  group.id,
                                  slotIndex,
                                  "start_time",
                                  event.target.value
                                )
                              }
                            />
                            <Input
                              type="time"
                              value={slot.end_time || ""}
                              onChange={(event) =>
                                updateGroupSlot(
                                  group.id,
                                  slotIndex,
                                  "end_time",
                                  event.target.value
                                )
                              }
                            />
                            <MiniDangerButton
                              type="button"
                              onClick={() => removeGroupSlot(group.id, slotIndex)}
                            >
                              Удалить
                            </MiniDangerButton>
                          </SlotRow>
                        ))}
                        <GhostButton type="button" onClick={() => addGroupSlot(group.id)}>
                          Добавить день
                        </GhostButton>
                      </SlotStack>
                    </Field>

                    <Field>
                      <Label>Ученики</Label>
                      {students.length === 0 ? (
                        <InlineMuted>Сначала добавьте учеников в курс.</InlineMuted>
                      ) : (
                        <StudentChipGrid>
                          {students.map((student) => {
                            const active = (editor.student_ids || []).includes(student.user_id);
                            return (
                              <StudentChip
                                key={student.user_id}
                                type="button"
                                $active={active}
                                onClick={() => toggleGroupStudent(group.id, student.user_id)}
                              >
                                {studentNameById[student.user_id]}
                              </StudentChip>
                            );
                          })}
                        </StudentChipGrid>
                      )}
                    </Field>

                    <ActionRow>
                      <PrimaryButton
                        type="button"
                        disabled={busyKey === `save-group-${group.id}`}
                        onClick={() => handleSaveGroup(group.id)}
                      >
                        {busyKey === `save-group-${group.id}` ? "Сохраняю..." : "Сохранить"}
                      </PrimaryButton>
                      <DangerButton
                        type="button"
                        disabled={busyKey === `delete-group-${group.id}`}
                        onClick={() => handleDeleteGroup(group.id)}
                      >
                        {busyKey === `delete-group-${group.id}` ? "Удаляю..." : "Удалить"}
                      </DangerButton>
                    </ActionRow>
                  </GroupCard>
                );
              })}
            </GroupGrid>
          </SectionCard>
        )}

        <SectionCard>
          <SectionHeader>
            <div>
              <SectionTitle>Уроки</SectionTitle>
              <SectionHint>
                {canEdit
                  ? "Перетаскивайте карточки, чтобы менять порядок."
                  : "Закрытые уроки видны в списке, но открыть их нельзя."}
              </SectionHint>
            </div>
          </SectionHeader>

          {orderedLessons.length === 0 ? (
            <EmptyState>Пока нет уроков.</EmptyState>
          ) : (
            <LessonList>
              {orderedLessons.map((lesson, index) => {
                const isLocked = !lesson.can_edit && !lesson.can_access;
                const lessonHref = `/mycourses/${courseId}/lessons/${lesson.id}`;

                return (
                  <LessonCard
                    key={lesson.id}
                    draggable={canEdit}
                    onDragStart={() => {
                      if (!canEdit) return;
                      setDraggedLessonId(lesson.id);
                    }}
                    onDragOver={(event) => {
                      if (!canEdit) return;
                      event.preventDefault();
                      setDropTargetIndex(index);
                    }}
                    onDragLeave={() => {
                      if (dropTargetIndex === index) {
                        setDropTargetIndex(null);
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (!canEdit) return;
                      handleLessonDrop(index);
                    }}
                    onDragEnd={() => {
                      setDraggedLessonId("");
                      setDropTargetIndex(null);
                    }}
                    $dropActive={dropTargetIndex === index}
                    $locked={isLocked}
                  >
                    <LessonOrder>{index + 1}</LessonOrder>
                    <LessonBody>
                      <LessonTopRow>
                        <LessonTitleWrap>
                          {isLocked ? (
                            <LockedTitle>{lesson.name}</LockedTitle>
                          ) : (
                            <LessonLink to={lessonHref}>{lesson.name}</LessonLink>
                          )}
                          <LessonMeta>
                            <span>{getLessonStatusLabel(lesson, index)}</span>
                            <span>{lesson.total_tasks || 0} задач</span>
                            <span>{Math.round(lesson.progress_percent || 0)}%</span>
                          </LessonMeta>
                        </LessonTitleWrap>
                        {canEdit && (
                          <LessonActions>
                            <GhostButton
                              type="button"
                              disabled={busyKey === `lesson-access-${lesson.id}`}
                              onClick={() => toggleLessonAccess(lesson)}
                            >
                              {busyKey === `lesson-access-${lesson.id}`
                                ? "Сохраняю..."
                                : lesson.is_open
                                ? "Закрыть урок"
                                : "Открыть урок"}
                            </GhostButton>
                            <PrimaryLink to={lessonHref}>Открыть урок</PrimaryLink>
                          </LessonActions>
                        )}
                      </LessonTopRow>
                      <LessonDescription>
                        {lesson.description || "Тема пока без описания."}
                      </LessonDescription>
                    </LessonBody>
                  </LessonCard>
                );
              })}
            </LessonList>
          )}
        </SectionCard>
      </Content>
    </Page>
  );
}

export default CoursePage;

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

const Breadcrumbs = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--muted);
  font-style: italic;
  flex-wrap: wrap;
`;

const CrumbLink = styled(Link)`
  text-decoration: none;
`;

const CurrentCrumb = styled.span`
  color: var(--text);
`;

const HeroGrid = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.8fr);
  gap: 24px;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const HeroCard = styled.section`
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 28px;
  box-shadow: var(--shadow);
  padding: 28px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 24px;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const HeroTextBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
`;

const HeroVisual = styled.div`
  display: flex;
  align-items: stretch;
`;

const HeroImage = styled.img`
  width: 100%;
  min-height: 100%;
  object-fit: cover;
  border-radius: 22px;
  border: 1px solid #e7ecf3;
`;

const VisualPlaceholder = styled.div`
  width: 100%;
  min-height: 220px;
  border-radius: 22px;
  border: 1px solid #e7ecf3;
  position: relative;
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    inset: 14px;
    border-radius: 18px;
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.46), transparent),
      repeating-linear-gradient(
        -45deg,
        rgba(255, 255, 255, 0.24) 0 14px,
        rgba(255, 255, 255, 0) 14px 28px
      );
  }
`;

const Eyebrow = styled.div`
  color: var(--muted);
  font-style: italic;
`;

const HeroTitle = styled.h1`
  font-size: clamp(34px, 5vw, 52px);
  line-height: 1.02;
`;

const HeroText = styled.p`
  color: var(--muted);
  line-height: 1.7;
`;

const HeroInfo = styled.div`
  color: var(--text);
  line-height: 1.75;
  white-space: pre-wrap;
`;

const MetaStack = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const MetaPill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 999px;
  background: #f6f8fb;
  color: var(--text);
  max-width: 100%;

  strong {
    color: var(--muted);
  }

  span {
    min-width: 0;
  }
`;

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const StatCard = styled.div`
  padding: 14px 16px;
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid #edf1f6;
  display: flex;
  flex-direction: column;
  gap: 8px;

  span {
    color: var(--muted);
    font-size: 13px;
  }

  strong {
    font-size: 24px;
  }
`;

const Track = styled.div`
  width: 100%;
  height: 12px;
  border-radius: 999px;
  background: #e6edf5;
  overflow: hidden;
`;

const Fill = styled.div`
  height: 100%;
  border-radius: inherit;
`;

const LeaderboardCard = styled.section`
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 28px;
  box-shadow: var(--shadow);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
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

const LeaderboardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const LeaderboardRow = styled.div`
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 14px 16px;
  border-radius: 18px;
  background: #f7f9fc;
  min-width: 0;
`;

const LeaderboardPlace = styled.div`
  font-weight: 800;
  font-size: 24px;
  color: #18243f;
`;

const LeaderboardPerson = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;

  strong,
  small {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: var(--muted);
  }
`;

const LeaderboardPoints = styled.div`
  font-weight: 800;
  color: var(--green);
  white-space: nowrap;
`;

const GroupGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 18px;
`;

const GroupCard = styled.div`
  padding: 18px;
  border-radius: 22px;
  background: #fbfcfe;
  border: 1px solid #e8edf4;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const SlotStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SlotRow = styled.div`
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 10px;

  @media (max-width: 680px) {
    grid-template-columns: 1fr;
  }
`;

const StudentChipGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const StudentChip = styled.button`
  border: 1px solid ${(props) => (props.$active ? "#3d82c4" : "#dbe4ef")};
  background: ${(props) => (props.$active ? "#ebf5ff" : "#ffffff")};
  color: ${(props) => (props.$active ? "#22578b" : "var(--text)")};
  border-radius: 999px;
  padding: 10px 14px;
  font-weight: 700;
  cursor: pointer;
`;

const LessonList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const LessonCard = styled.div`
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  padding: 18px;
  border-radius: 22px;
  background: ${(props) => (props.$locked ? "#fbfcfe" : "#f7fafc")};
  border: 1px solid ${(props) => (props.$dropActive ? "#6fa2d0" : "#e6ebf2")};
  opacity: ${(props) => (props.$locked ? 0.84 : 1)};

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const LessonOrder = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid #e1e8f0;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 20px;
`;

const LessonBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
`;

const LessonTopRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
`;

const LessonTitleWrap = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const LessonLink = styled(Link)`
  text-decoration: none;
  color: #18243f;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.2;
`;

const LockedTitle = styled.div`
  color: #7a8598;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.2;
`;

const LessonMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  span {
    padding: 6px 10px;
    border-radius: 999px;
    background: #ffffff;
    border: 1px solid #e1e8f0;
    color: var(--muted);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
`;

const LessonDescription = styled.p`
  color: var(--muted);
  line-height: 1.65;
`;

const LessonActions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
`;

const CourseSettingsForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const FieldRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

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
  border: 1px solid #d8dee8;
  border-radius: 14px;
  padding: 12px 14px;
  font: inherit;
  background: #fff;
`;

const Select = styled.select`
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

const TitleInput = styled(Input)`
  font-size: clamp(30px, 4vw, 46px);
  font-weight: 800;
  line-height: 1.05;
`;

const ColorInput = styled.input`
  width: 100%;
  min-height: 50px;
  border: 1px solid #d8dee8;
  border-radius: 14px;
  background: #fff;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const ButtonBase = styled.button`
  border: none;
  border-radius: 16px;
  padding: 13px 18px;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
`;

const PrimaryButton = styled(ButtonBase)`
  background: #3d82c4;
  color: #fff;
`;

const SecondaryButton = styled(ButtonBase)`
  background: #eef5fb;
  color: #23598d;
`;

const GhostButton = styled(ButtonBase)`
  background: #fff;
  color: var(--text);
  border: 1px solid #d7dee8;
`;

const DangerButton = styled(ButtonBase)`
  background: #fff0f0;
  color: #c44d4d;
`;

const MiniDangerButton = styled(DangerButton)`
  padding: 12px 14px;
`;

const PrimaryLink = styled(Link)`
  text-decoration: none;
  border-radius: 16px;
  padding: 13px 18px;
  font-weight: 800;
  background: #3d82c4;
  color: #fff;
`;

const InlineMuted = styled.div`
  color: var(--muted);
  line-height: 1.6;
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
