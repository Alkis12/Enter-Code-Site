import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { listStudents } from "../api/account";
import { isAuthenticated } from "../api/auth";
import {
  createCourseGroup,
  createLesson,
  deleteCourseGroup,
  getCourseDetail,
  uploadCourseCover,
  updateCourse,
  updateCourseGroup,
  updateLesson,
} from "../api/learning";
import Header from "../components/Header/Header";
import ImageUploadControl from "../components/ImageUploadControl";

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

function normalizeSlots(slots) {
  return (slots || []).map((slot) => ({
    weekday: Number(slot.weekday ?? 0),
    start_time: slot.start_time || "",
    end_time: slot.end_time || "",
  }));
}

function sanitizeScheduleSlots(slots) {
  return (slots || [])
    .filter((slot) => slot && slot.start_time)
    .map((slot) => ({
      weekday: Number(slot.weekday ?? 0),
      start_time: slot.start_time,
      end_time: slot.end_time || null,
    }))
    .sort((a, b) => {
      if (a.weekday !== b.weekday) return a.weekday - b.weekday;
      if (a.start_time !== b.start_time) return a.start_time.localeCompare(b.start_time);
      return (a.end_time || "").localeCompare(b.end_time || "");
    });
}

function buildSlotLabel(slot) {
  const day = weekdayOptions.find((item) => item.value === Number(slot.weekday))?.label || "Пн";
  if (slot.start_time && slot.end_time) return `${day} ${slot.start_time}-${slot.end_time}`;
  if (slot.start_time) return `${day} ${slot.start_time}`;
  return day;
}

function getLessonStatusLabel(lesson, index, isStudent) {
  if (!isStudent) return `${lesson.total_tasks || 0} задач`;
  if (lesson.can_access && index === 0) return "Старт";
  if (lesson.can_access) return "Доступен";
  return "Закрыт";
}

function getLessonAccessHint(lesson, index, orderedLessons, canEdit) {
  if (canEdit) {
    return lesson.description || "Тема пока без описания.";
  }
  if (lesson.can_access) {
    return lesson.description || "Урок уже доступен для прохождения.";
  }
  const previousLesson = orderedLessons[index - 1];
  if (previousLesson) {
    return `Сначала откройте или пройдите предыдущий урок: ${previousLesson.name}.`;
  }
  return "Урок пока закрыт для вашей группы.";
}

function createGroupEditor(group) {
  return {
    id: group.id,
    name: group.name || "",
    student_ids: [...(group.students || [])],
    schedule_slots: normalizeSlots(group.schedule_slots),
    current_topic_id: group.current_topic_id || "",
  };
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
  const [groupEditor, setGroupEditor] = useState(null);
  const [visibilityGroupId, setVisibilityGroupId] = useState("");
  const [visibilityTopicId, setVisibilityTopicId] = useState("");
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [allStudents, setAllStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("lessons");
  const [selectedRatingGroupId, setSelectedRatingGroupId] = useState("");

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
    setSelectedRatingGroupId((prev) => {
      const groupIds = (response.groups || []).map((group) => group.id);
      if (response.course.active_group_id && groupIds.includes(response.course.active_group_id)) {
        return response.course.active_group_id;
      }
      return groupIds.includes(prev) ? prev : groupIds[0] || "";
    });
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
  const canEdit = course?.can_edit;
  const isStudent = course && !canEdit;

  const ratingGroups = useMemo(() => {
    if (!course) return [];
    if (canEdit) return groups;
    return groups.filter((group) => group.id === course.active_group_id);
  }, [canEdit, course, groups]);

  const selectedRatingGroup = useMemo(
    () => ratingGroups.find((group) => group.id === selectedRatingGroupId) || ratingGroups[0] || null,
    [ratingGroups, selectedRatingGroupId]
  );

  const selectedEditorStudents = useMemo(() => {
    if (!groupEditor) return [];
    const ids = new Set(groupEditor.student_ids || []);
    return allStudents.filter((student) => ids.has(student.user_id));
  }, [allStudents, groupEditor]);

  const filteredStudentOptions = useMemo(() => {
    if (!groupEditor) return [];
    const query = studentSearch.trim().toLowerCase();
    const selectedIds = new Set(groupEditor.student_ids || []);
    return allStudents.filter((student) => {
      if (selectedIds.has(student.user_id)) return false;
      if (!query) return true;
      const haystack = `${student.name} ${student.surname} ${student.tg_username}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [allStudents, groupEditor, studentSearch]);

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

  if (!data || !course || !courseForm) {
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

  const loadAllStudents = async () => {
    if (!canEdit || allStudents.length > 0 || studentsLoading) return;
    try {
      setStudentsLoading(true);
      const response = await listStudents();
      setAllStudents(response.students || []);
    } catch (err) {
      setError(err.message || "Не удалось загрузить учеников");
    } finally {
      setStudentsLoading(false);
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

  const handleCourseCoverUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setCoverUploading(true);
      const response = await uploadCourseCover(file);
      setCourseForm((prev) => ({
        ...prev,
        cover_image: response.url || "",
      }));
      setError("");
    } catch (err) {
      setError(err.message || "Не удалось загрузить обложку курса");
    } finally {
      setCoverUploading(false);
    }
  };

  const handleCreateGroup = async () => {
    await runAction(
      "create-group",
      async () => {
        await createCourseGroup(courseId, {
          current_topic_id: orderedLessons[0]?.id || null,
        });
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

  const openGroupEditor = (group) => {
    setStudentSearch("");
    setGroupEditor(createGroupEditor(group));
    loadAllStudents();
  };

  const closeGroupEditor = () => {
    setGroupEditor(null);
    setStudentPickerOpen(false);
    setStudentSearch("");
  };

  const updateGroupEditorField = (field, value) => {
    setGroupEditor((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateGroupSlot = (slotIndex, field, value) => {
    setGroupEditor((prev) => {
      const nextSlots = [...(prev.schedule_slots || [])];
      nextSlots[slotIndex] = {
        ...(nextSlots[slotIndex] || { weekday: 0, start_time: "", end_time: "" }),
        [field]: value,
      };
      return {
        ...prev,
        schedule_slots: nextSlots,
      };
    });
  };

  const addGroupSlot = () => {
    setGroupEditor((prev) => ({
      ...prev,
      schedule_slots: [
        ...(prev.schedule_slots || []),
        { weekday: 0, start_time: "18:00", end_time: "19:30" },
      ],
    }));
  };

  const removeGroupSlot = (slotIndex) => {
    setGroupEditor((prev) => ({
      ...prev,
      schedule_slots: (prev.schedule_slots || []).filter((_, index) => index !== slotIndex),
    }));
  };

  const addStudentToEditor = (studentId) => {
    setGroupEditor((prev) => ({
      ...prev,
      student_ids: [...new Set([...(prev.student_ids || []), studentId])],
    }));
  };

  const removeStudentFromEditor = (studentId) => {
    setGroupEditor((prev) => ({
      ...prev,
      student_ids: (prev.student_ids || []).filter((item) => item !== studentId),
    }));
  };

  const handleSaveGroup = async () => {
    if (!groupEditor) return;
    await runAction(
      `save-group-${groupEditor.id}`,
      async () => {
        await updateCourseGroup(courseId, groupEditor.id, {
          name: (groupEditor.name || "").trim() || "Новая группа",
          student_ids: groupEditor.student_ids || [],
          current_topic_id: groupEditor.current_topic_id || orderedLessons[0]?.id || null,
          schedule_slots: sanitizeScheduleSlots(groupEditor.schedule_slots),
        });
        setNotice("Группа обновлена.");
        closeGroupEditor();
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
        closeGroupEditor();
        await loadCourse();
      },
      "Не удалось удалить группу"
    );
  };

  const handleSaveVisibility = async () => {
    if (!visibilityGroupId) return;
    const targetGroup = groups.find((group) => group.id === visibilityGroupId);
    if (!targetGroup) return;
    await runAction(
      `visibility-${visibilityGroupId}`,
      async () => {
        await updateCourseGroup(courseId, visibilityGroupId, {
          current_topic_id: visibilityTopicId || orderedLessons[0]?.id || null,
        });
        setNotice("Видимость уроков обновлена.");
        setVisibilityGroupId("");
        setVisibilityTopicId("");
        await loadCourse();
      },
      "Не удалось обновить видимость уроков"
    );
  };

  const openVisibilityModal = (group) => {
    setVisibilityGroupId(group.id);
    setVisibilityTopicId(group.current_topic_id || orderedLessons[0]?.id || "");
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

  const teacherStats = [
    { label: "Группы", value: groups.length },
    { label: "Ученики", value: students.length },
    { label: "Уроки", value: orderedLessons.length },
  ];

  const studentStats = [
    { label: "Баллы", value: `${course.earned_points} / ${course.total_points}` },
    { label: "Прогресс", value: `${Math.round(course.progress_percent || 0)}%` },
    { label: "Уроки", value: orderedLessons.length },
  ];

  const visibleLessonsLabel = (group) => {
    const topicId = group.current_topic_id || orderedLessons[0]?.id;
    const lesson = orderedLessons.find((item) => item.id === topicId) || orderedLessons[0];
    return lesson ? `До урока: ${lesson.name}` : "Пока нет уроков";
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

        <HeroCard>
          <HeroMain>
            {showCourseSettings ? (
              <SettingsForm onSubmit={handleCourseSave}>
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
                      setCourseForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                  />
                </Field>
                <Field>
                  <Label>Общая информация</Label>
                  <Textarea
                    rows={8}
                    value={courseForm.public_info}
                    onChange={(event) =>
                      setCourseForm((prev) => ({ ...prev, public_info: event.target.value }))
                    }
                  />
                </Field>
                <FieldRow>
                  <Field>
                    <Label>Цвет</Label>
                    <ColorInput
                      type="color"
                      value={courseForm.accent_color}
                      onChange={(event) =>
                        setCourseForm((prev) => ({ ...prev, accent_color: event.target.value }))
                      }
                    />
                  </Field>
                  <Field>
                    <Label>Обложка курса</Label>
                    <CoverUploadCard>
                      <CoverUploadPreview>
                        {courseForm.cover_image ? (
                          <HeroImage
                            src={resolveAssetUrl(courseForm.cover_image)}
                            alt="Обложка курса"
                          />
                        ) : (
                          <PreviewTile
                            style={{
                              background: `linear-gradient(140deg, ${
                                courseForm.accent_color || "#16a085"
                              } 0%, #0f1824 100%)`,
                            }}
                          />
                        )}
                      </CoverUploadPreview>
                      <ImageUploadControl
                        inputId="course-cover-upload"
                        onChange={handleCourseCoverUpload}
                        onRemove={() =>
                          setCourseForm((prev) => ({
                            ...prev,
                            cover_image: "",
                          }))
                        }
                        uploading={coverUploading}
                        hasValue={Boolean(courseForm.cover_image)}
                      />
                    </CoverUploadCard>
                  </Field>
                </FieldRow>
                <ActionRow>
                  <PrimaryButton type="submit" disabled={busyKey === "save-course"}>
                    {busyKey === "save-course" ? "Сохраняю..." : "Сохранить курс"}
                  </PrimaryButton>
                  <GhostButton type="button" onClick={() => setShowCourseSettings(false)}>
                    Закрыть
                  </GhostButton>
                </ActionRow>
              </SettingsForm>
            ) : (
              <>
                <Eyebrow>Курс</Eyebrow>
                <HeroTitle>{course.name}</HeroTitle>
                {course.description && <HeroText>{course.description}</HeroText>}
                {course.active_group_name && (
                  <MetaLine>
                    <strong>Группа:</strong> <span>{course.active_group_name}</span>
                  </MetaLine>
                )}
                {course.active_group_schedule_summary && (
                  <MetaLine>
                    <strong>Расписание:</strong> <span>{course.active_group_schedule_summary}</span>
                  </MetaLine>
                )}
                {course.public_info && <HeroInfo>{course.public_info}</HeroInfo>}
                <StatsGrid>
                  {(canEdit ? teacherStats : studentStats).map((item) => (
                    <StatCard key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </StatCard>
                  ))}
                </StatsGrid>
                {!canEdit && (
                  <Track>
                    <Fill
                      style={{
                        width: `${Math.min(100, course.progress_percent || 0)}%`,
                        background: course.accent_color || "var(--green)",
                      }}
                    />
                  </Track>
                )}
              </>
            )}

            {canEdit && !showCourseSettings && (
              <ActionRow>
                <PrimaryButton type="button" onClick={handleCreateGroup} disabled={busyKey === "create-group"}>
                  {busyKey === "create-group" ? "Добавляю..." : "Добавить группу"}
                </PrimaryButton>
                <PrimaryButton type="button" onClick={handleCreateLesson} disabled={busyKey === "create-lesson"}>
                  {busyKey === "create-lesson" ? "Добавляю..." : "Добавить урок"}
                </PrimaryButton>
                <GhostButton type="button" onClick={() => setShowCourseSettings(true)}>
                  Настроить курс
                </GhostButton>
              </ActionRow>
            )}
          </HeroMain>

          <HeroSide>
            {course.cover_image ? (
              <HeroImage src={resolveAssetUrl(course.cover_image)} alt={course.name} />
            ) : (
              <PreviewTile style={{ background: `linear-gradient(135deg, ${course.accent_color || "#16a085"} 0%, #f7fafc 100%)` }} />
            )}
          </HeroSide>
        </HeroCard>

        {canEdit && (
          <SectionCard>
            <SectionHeader>
              <div>
                <SectionTitle>Группы</SectionTitle>
              </div>
            </SectionHeader>
            {groups.length === 0 ? (
              <EmptyState>Пока нет групп.</EmptyState>
            ) : (
              <GroupList>
                {groups.map((group) => (
                  <GroupRow key={group.id}>
                    <div>
                      <GroupName>{group.name}</GroupName>
                      <GroupMeta>{group.schedule_summary || "Расписание не настроено"}</GroupMeta>
                      <GroupMeta>{group.students.length} учеников · {visibleLessonsLabel(group)}</GroupMeta>
                    </div>
                    <GroupActions>
                      <GhostButton type="button" onClick={() => openGroupEditor(group)}>
                        Изменить
                      </GhostButton>
                      <GhostButton type="button" onClick={() => openVisibilityModal(group)}>
                        Видимость уроков
                      </GhostButton>
                    </GroupActions>
                  </GroupRow>
                ))}
              </GroupList>
            )}
          </SectionCard>
        )}

        <Tabs>
          <TabButton type="button" $active={activeTab === "lessons"} onClick={() => setActiveTab("lessons")}>Уроки</TabButton>
          <TabButton type="button" $active={activeTab === "rating"} onClick={() => setActiveTab("rating")}>Рейтинг группы</TabButton>
        </Tabs>

        {activeTab === "lessons" ? (
          <SectionCard>
            <SectionHeader>
              <div>
                <SectionTitle>Уроки</SectionTitle>
              </div>
            </SectionHeader>
            {orderedLessons.length === 0 ? (
              <EmptyState>Пока нет уроков.</EmptyState>
            ) : (
              <LessonList>
                {orderedLessons.map((lesson, index) => {
                  const isLocked = !canEdit && !lesson.can_access;
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
                      onClick={() => {
                        if (isLocked) return;
                        navigate(lessonHref);
                      }}
                    >
                      <LessonOrder>{index + 1}</LessonOrder>
                      <LessonBody>
                        <LessonTitle>{lesson.name}</LessonTitle>
                        <LessonBadges>
                          <Badge>{getLessonStatusLabel(lesson, index, isStudent)}</Badge>
                          <Badge>{lesson.total_tasks || 0} задач</Badge>
                          {!canEdit && <Badge>{Math.round(lesson.progress_percent || 0)}%</Badge>}
                        </LessonBadges>
                        <LessonDescription>
                          {getLessonAccessHint(
                            lesson,
                            index,
                            orderedLessons,
                            canEdit
                          )}
                        </LessonDescription>
                      </LessonBody>
                    </LessonCard>
                  );
                })}
              </LessonList>
            )}
          </SectionCard>
        ) : (
          <SectionCard>
            <SectionHeader>
              <div>
                <SectionTitle>Рейтинг группы</SectionTitle>
                <SectionText>
                  {canEdit ? "Выберите группу и посмотрите прогресс ее учеников." : "Здесь показан рейтинг вашей группы."}
                </SectionText>
              </div>
              {canEdit && ratingGroups.length > 1 && (
                <Select
                  value={selectedRatingGroup?.id || ""}
                  onChange={(event) => setSelectedRatingGroupId(event.target.value)}
                >
                  {ratingGroups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </Select>
              )}
            </SectionHeader>
            {!selectedRatingGroup ? (
              <EmptyState>Для рейтинга пока нет группы.</EmptyState>
            ) : selectedRatingGroup.leaderboard.length === 0 ? (
              <EmptyState>В этой группе пока нет учеников с результатами.</EmptyState>
            ) : (
              <LeaderboardList>
                {selectedRatingGroup.leaderboard.map((entry, index) => (
                  <LeaderboardRow key={`${selectedRatingGroup.id}-${entry.user_id}`}>
                    <LeaderboardPlace>{index + 1}</LeaderboardPlace>
                    <LeaderboardPerson>
                      <strong>{entry.name} {entry.surname}</strong>
                      <small>@{entry.tg_username}</small>
                    </LeaderboardPerson>
                    <LeaderboardPoints>{entry.points} XP</LeaderboardPoints>
                  </LeaderboardRow>
                ))}
              </LeaderboardList>
            )}
          </SectionCard>
        )}

        {groupEditor && (
          <Overlay>
            <ModalCard>
              <ModalHeader>
                <div>
                  <ModalTitle>Изменить группу</ModalTitle>
                </div>
                <IconButton type="button" onClick={closeGroupEditor}>×</IconButton>
              </ModalHeader>

              <Field>
                <Label>Название группы</Label>
                <Input
                  value={groupEditor.name}
                  onChange={(event) => updateGroupEditorField("name", event.target.value)}
                />
              </Field>

              <Field>
                <Label>Занятия</Label>
                <SlotStack>
                  {(groupEditor.schedule_slots || []).map((slot, slotIndex) => (
                    <SlotRow key={`slot-${slotIndex}`}>
                      <Select
                        value={slot.weekday}
                        onChange={(event) => updateGroupSlot(slotIndex, "weekday", Number(event.target.value))}
                      >
                        {weekdayOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                      <TimeInput
                        type="time"
                        value={slot.start_time}
                        onChange={(event) => updateGroupSlot(slotIndex, "start_time", event.target.value)}
                      />
                      <TimeArrow>—</TimeArrow>
                      <TimeInput
                        type="time"
                        value={slot.end_time}
                        onChange={(event) => updateGroupSlot(slotIndex, "end_time", event.target.value)}
                      />
                      <IconButton type="button" onClick={() => removeGroupSlot(slotIndex)}>×</IconButton>
                    </SlotRow>
                  ))}
                </SlotStack>
                <InlineButtons>
                  <GhostButton type="button" onClick={addGroupSlot}>Добавить день</GhostButton>
                  {!!groupEditor.schedule_slots.length && (
                    <InlineHint>
                      {groupEditor.schedule_slots.map(buildSlotLabel).join(" · ")}
                    </InlineHint>
                  )}
                </InlineButtons>
              </Field>

              <Field>
                <Label>Ученики</Label>
                <InlineButtons>
                  <GhostButton type="button" onClick={async () => {
                    await loadAllStudents();
                    setStudentPickerOpen(true);
                  }}>
                    Добавить ученика
                  </GhostButton>
                </InlineButtons>
                {selectedEditorStudents.length === 0 ? (
                  <EmptyState>В группе пока нет учеников.</EmptyState>
                ) : (
                  <StudentPills>
                    {selectedEditorStudents.map((student) => (
                      <StudentPill key={student.user_id}>
                        <span>{student.name} {student.surname}</span>
                        <button type="button" onClick={() => removeStudentFromEditor(student.user_id)}>×</button>
                      </StudentPill>
                    ))}
                  </StudentPills>
                )}
              </Field>

              <ActionRow>
                <PrimaryButton type="button" onClick={handleSaveGroup} disabled={busyKey === `save-group-${groupEditor.id}`}>
                  {busyKey === `save-group-${groupEditor.id}` ? "Сохраняю..." : "Сохранить"}
                </PrimaryButton>
                <DangerButton type="button" onClick={() => handleDeleteGroup(groupEditor.id)} disabled={busyKey === `delete-group-${groupEditor.id}`}>
                  {busyKey === `delete-group-${groupEditor.id}` ? "Удаляю..." : "Удалить"}
                </DangerButton>
              </ActionRow>
            </ModalCard>
          </Overlay>
        )}

        {studentPickerOpen && groupEditor && (
          <Overlay>
            <MiniModal>
              <ModalHeader>
                <div>
                  <ModalTitle>Добавить ученика</ModalTitle>
                </div>
                <IconButton type="button" onClick={() => setStudentPickerOpen(false)}>×</IconButton>
              </ModalHeader>
              <Input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Найти ученика" />
              <SearchList>
                {studentsLoading ? (
                  <EmptyState>Загрузка учеников...</EmptyState>
                ) : filteredStudentOptions.length === 0 ? (
                  <EmptyState>Ничего не найдено.</EmptyState>
                ) : (
                  filteredStudentOptions.map((student) => (
                    <SearchRow key={student.user_id}>
                      <div>
                        <strong>{student.name} {student.surname}</strong>
                        <small>@{student.tg_username}</small>
                      </div>
                      <GhostButton type="button" onClick={() => addStudentToEditor(student.user_id)}>
                        Добавить
                      </GhostButton>
                    </SearchRow>
                  ))
                )}
              </SearchList>
            </MiniModal>
          </Overlay>
        )}

        {visibilityGroupId && (
          <Overlay>
            <MiniModal>
              <ModalHeader>
                <div>
                  <ModalTitle>Видимость уроков</ModalTitle>
                </div>
                <IconButton type="button" onClick={() => setVisibilityGroupId("")}>×</IconButton>
              </ModalHeader>
              <Field>
                <Label>Текущий урок группы</Label>
                <Select value={visibilityTopicId} onChange={(event) => setVisibilityTopicId(event.target.value)}>
                  {orderedLessons.map((lesson, index) => (
                    <option key={lesson.id} value={lesson.id}>{index + 1}. {lesson.name}</option>
                  ))}
                </Select>
              </Field>
              <ActionRow>
                <PrimaryButton type="button" onClick={handleSaveVisibility} disabled={busyKey === `visibility-${visibilityGroupId}`}>
                  {busyKey === `visibility-${visibilityGroupId}` ? "Сохраняю..." : "Сохранить видимость"}
                </PrimaryButton>
              </ActionRow>
            </MiniModal>
          </Overlay>
        )}
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

const HeroMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const HeroSide = styled.div`
  display: flex;
`;

const PreviewTile = styled.div`
  width: 100%;
  min-height: 220px;
  border-radius: 22px;
  border: 1px solid #e7ecf3;
`;

const HeroImage = styled.img`
  width: 100%;
  min-height: 100%;
  object-fit: cover;
  border-radius: 22px;
  border: 1px solid #e7ecf3;
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

const MetaLine = styled.div`
  color: var(--text);

  strong {
    color: var(--muted);
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 760px) {
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
  font-size: clamp(24px, 3vw, 34px);
`;

const SectionText = styled.p`
  color: var(--muted);
  line-height: 1.65;
  margin-top: 6px;
`;

const GroupList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const GroupRow = styled.div`
  padding: 18px;
  border-radius: 20px;
  background: #f8fafc;
  border: 1px solid #e6ebf2;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
`;

const GroupName = styled.h3`
  font-size: 24px;
`;

const GroupMeta = styled.div`
  color: var(--muted);
  line-height: 1.6;
`;

const GroupActions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const Tabs = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const TabButton = styled.button`
  border: 1px solid ${(props) => (props.$active ? "#3d82c4" : "#d7dee8")};
  border-radius: 999px;
  padding: 12px 16px;
  font: inherit;
  font-weight: 800;
  background: ${(props) => (props.$active ? "#eef5fb" : "#fff")};
  color: ${(props) => (props.$active ? "#23598d" : "var(--text)")};
  cursor: pointer;
`;

const LessonList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const LessonCard = styled.button`
  width: 100%;
  border: 1px solid ${(props) => (props.$dropActive ? "#6fa2d0" : "#e6ebf2")};
  border-radius: 22px;
  padding: 18px;
  background: ${(props) => (props.$locked ? "#fbfcfe" : "#f7fafc")};
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 16px;
  text-align: left;
  cursor: ${(props) => (props.$locked ? "default" : "pointer")};
  opacity: ${(props) => (props.$locked ? 0.72 : 1)};

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
`;

const LessonTitle = styled.h3`
  font-size: 24px;
  line-height: 1.2;
`;

const LessonBadges = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const Badge = styled.div`
  padding: 6px 10px;
  border-radius: 999px;
  background: #ffffff;
  border: 1px solid #e1e8f0;
  color: var(--muted);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const LessonDescription = styled.p`
  color: var(--muted);
  line-height: 1.65;
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
`;

const LeaderboardPlace = styled.div`
  font-weight: 800;
  font-size: 24px;
`;

const LeaderboardPerson = styled.div`
  min-width: 0;

  strong,
  small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: var(--muted);
    margin-top: 4px;
  }
`;

const LeaderboardPoints = styled.div`
  white-space: nowrap;
  font-weight: 800;
  color: var(--green);
`;

const SettingsForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const FieldRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const CoverUploadCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const CoverUploadPreview = styled.div`
  min-height: 180px;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid #d8dee8;
  background: #f7fafc;
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

const TimeInput = styled(Input)``;

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

const InlineButtons = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
`;

const InlineHint = styled.div`
  color: var(--muted);
  line-height: 1.6;
`;

const SlotStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SlotRow = styled.div`
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr) auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const TimeArrow = styled.div`
  color: var(--muted);
  text-align: center;
`;

const StudentPills = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const StudentPill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 999px;
  border: 1px solid #dbe4ef;
  background: #fff;

  button {
    border: none;
    background: transparent;
    font: inherit;
    cursor: pointer;
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(18, 22, 31, 0.28);
  display: grid;
  place-items: center;
  padding: 24px;
  z-index: 60;
`;

const ModalCard = styled.section`
  width: min(760px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
  background: #fff;
  border-radius: 28px;
  box-shadow: 0 24px 40px rgba(18, 22, 31, 0.22);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const MiniModal = styled(ModalCard)`
  width: min(620px, 100%);
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
`;

const ModalTitle = styled.h3`
  font-size: 30px;
`;

const IconButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid #d7dee8;
  background: #fff;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
`;

const SearchList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SearchRow = styled.div`
  padding: 14px;
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid #e6ebf2;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;

  small {
    color: var(--muted);
  }
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

const GhostButton = styled(ButtonBase)`
  background: #fff;
  color: var(--text);
  border: 1px solid #d7dee8;
`;

const DangerButton = styled(ButtonBase)`
  background: #fff0f0;
  color: #c44d4d;
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
