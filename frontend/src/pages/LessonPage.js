import React, { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { useAchievementToasts } from "../components/AchievementToastProvider";
import Header from "../components/Header/Header";
import { isAuthenticated } from "../api/auth";
import {
  createTask,
  deleteTask,
  getLessonDetail,
  reviewTaskSubmission,
  submitTask,
  updateLesson,
  updateTask,
} from "../api/learning";

const emptyTaskForm = {
  title: "",
  condition: "",
  points: 10,
  starter_code: "",
  language: "python",
  attachments: "",
  requires_manual_review: false,
  tests: [{ input_data: "", expected_output: "" }],
  order: 0,
};

const statusMetaMap = {
  no_attempts: {
    label: "Нет попыток",
    tone: "neutral",
    description: "Решение еще не отправлялось.",
  },
  wrong_answer: {
    label: "Есть ошибки",
    tone: "warning",
    description: "Автотесты не пройдены. Исправьте решение и отправьте еще раз.",
  },
  pending_review: {
    label: "Ждет ручной проверки",
    tone: "info",
    description:
      "Автотесты пройдены. Теперь решение должен подтвердить преподаватель.",
  },
  correct: {
    label: "Задача зачтена",
    tone: "success",
    description: "Баллы начислены, задача засчитана.",
  },
};

function createTaskEditor(task) {
  return {
    title: task.title || "",
    condition: task.condition || "",
    points: task.points || 0,
    starter_code: task.starter_code || "",
    language: task.language || "python",
    attachments: (task.attachments || []).join("\n"),
    requires_manual_review: Boolean(task.requires_manual_review),
    order: task.order || 0,
    tests:
      task.tests && task.tests.length > 0
        ? task.tests.map((item) => ({ ...item }))
        : [{ input_data: "", expected_output: "" }],
  };
}

function getStatusMeta(status) {
  return statusMetaMap[status] || statusMetaMap.no_attempts;
}

function getTaskIndicatorTone(status) {
  if (status === "correct") {
    return "success";
  }
  if (status === "wrong_answer") {
    return "warning";
  }
  return "neutral";
}

function getAttemptTone(submission) {
  if (submission?.waiting_manual_review) {
    return "info";
  }
  return submission?.passed ? "success" : "warning";
}

function getAttemptLabel(submission) {
  if (submission?.waiting_manual_review) {
    return "Ждет проверки";
  }
  return submission?.passed ? "Тесты пройдены" : "Есть ошибки";
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

function getLessonRailFillPercent(currentIndex, totalCount) {
  if (totalCount <= 1) {
    return totalCount === 1 ? 100 : 0;
  }
  return ((currentIndex + 1) / totalCount) * 100;
}

function getLessonRailStatusLabel(lesson, index) {
  if (lesson.is_open) {
    return "Открыт";
  }
  if (index === 0) {
    return "Старт";
  }
  return "Закрыт";
}

function TestReport({ testResults }) {
  if (!testResults || testResults.length === 0) {
    return <MutedText>Тестовый отчет пока пуст.</MutedText>;
  }

  return (
    <Stack>
      {testResults.map((test, index) => (
        <SubCard key={`${test.input_data}-${index}`}>
          <Row>
            <strong>Тест {index + 1}</strong>
            <Badge $tone={test.passed ? "success" : "warning"}>
              {test.passed ? "OK" : "Ошибка"}
            </Badge>
          </Row>
          <MiniGrid>
            <CodeBlock>
              <span>Входные данные</span>
              <code>{test.input_data || "пусто"}</code>
            </CodeBlock>
            <CodeBlock>
              <span>Ожидаемый вывод</span>
              <code>{test.expected_output || "пусто"}</code>
            </CodeBlock>
            <CodeBlock>
              <span>Фактический вывод</span>
              <code>{test.actual_output || "пусто"}</code>
            </CodeBlock>
            <CodeBlock>
              <span>stderr</span>
              <code>{test.stderr || "пусто"}</code>
            </CodeBlock>
          </MiniGrid>
        </SubCard>
      ))}
    </Stack>
  );
}

function TaskEditorFields({
  form,
  onFieldChange,
  onTestChange,
  onAddTest,
  onRemoveTest,
}) {
  return (
    <>
      <Field>
        <Label>Название задачи</Label>
        <Input
          value={form.title}
          onChange={(event) => onFieldChange("title", event.target.value)}
          required
        />
      </Field>
      <Field>
        <Label>Условие задачи</Label>
        <Textarea
          rows={5}
          value={form.condition}
          onChange={(event) => onFieldChange("condition", event.target.value)}
          required
        />
      </Field>
      <Grid3>
        <Field>
          <Label>Баллы за задачу</Label>
          <Input
            type="number"
            min="0"
            value={form.points}
            onChange={(event) => onFieldChange("points", event.target.value)}
          />
        </Field>
        <Field>
          <Label>Язык</Label>
          <Input
            value={form.language}
            onChange={(event) => onFieldChange("language", event.target.value)}
          />
        </Field>
        <Field>
          <Label>Порядок задачи</Label>
          <Input
            type="number"
            min="0"
            value={form.order}
            onChange={(event) => onFieldChange("order", event.target.value)}
          />
        </Field>
      </Grid3>
      <SubCard>
        <ToggleLabel>
          <input
            type="checkbox"
            checked={Boolean(form.requires_manual_review)}
            onChange={(event) =>
              onFieldChange("requires_manual_review", event.target.checked)
            }
          />
          <span>После автотестов отправлять задачу на ручную проверку</span>
        </ToggleLabel>
      </SubCard>
      <Field>
        <Label>Стартовый код</Label>
        <Textarea
          rows={6}
          value={form.starter_code}
          onChange={(event) => onFieldChange("starter_code", event.target.value)}
        />
      </Field>
      <Field>
        <Label>Материалы к задаче, по одной ссылке в строке</Label>
        <Textarea
          rows={3}
          value={form.attachments}
          onChange={(event) => onFieldChange("attachments", event.target.value)}
        />
      </Field>
      <strong>Тесты для автопроверки</strong>
      {form.tests.map((test, index) => (
        <TestEditorRow key={`test-${index}`}>
          <Field>
            <Label>Входные данные теста</Label>
            <Textarea
              rows={3}
              value={test.input_data}
              onChange={(event) =>
                onTestChange(index, "input_data", event.target.value)
              }
            />
          </Field>
          <Field>
            <Label>Ожидаемый вывод</Label>
            <Textarea
              rows={3}
              value={test.expected_output}
              onChange={(event) =>
                onTestChange(index, "expected_output", event.target.value)
              }
            />
          </Field>
          <GhostButton type="button" onClick={() => onRemoveTest(index)}>
            Удалить тест
          </GhostButton>
        </TestEditorRow>
      ))}
      <GhostButton type="button" onClick={onAddTest}>
        Добавить тест
      </GhostButton>
    </>
  );
}

function LessonPage() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const authed = isAuthenticated();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [lessonForm, setLessonForm] = useState(null);
  const [newTask, setNewTask] = useState(emptyTaskForm);
  const [taskEditors, setTaskEditors] = useState({});
  const [studentCodes, setStudentCodes] = useState({});
  const [reviewForms, setReviewForms] = useState({});
  const [expandedTasks, setExpandedTasks] = useState({});
  const [showMaterialEditor, setShowMaterialEditor] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState("");
  const [historyDrawer, setHistoryDrawer] = useState(null);
  const taskRefs = useRef({});
  const lessonRailRefs = useRef({});
  const { pushAchievements } = useAchievementToasts();

  const loadLesson = useCallback(
    async ({ showLoader = true } = {}) => {
      try {
        if (showLoader) setLoading(true);
        const response = await getLessonDetail(lessonId);
        const nextEditors = {};
        const nextCodes = {};
        const nextReviewForms = {};
        (response.tasks || []).forEach((task) => {
          nextEditors[task.id] = createTaskEditor(task);
          nextCodes[task.id] =
            task.result?.last_submission?.code || task.starter_code || "";
          (task.pending_reviews || []).forEach((review) => {
            nextReviewForms[`${task.id}:${review.user_id}`] =
              review.review_comment ||
              review.last_submission?.review_comment ||
              "";
          });
        });
        setData(response);
        setLessonForm({
          name: response.lesson.name || "",
          description: response.lesson.description || "",
          content: response.lesson.content || "",
          resources: (response.lesson.resources || []).join("\n"),
          order: response.lesson.order || 0,
        });
        setTaskEditors(nextEditors);
        setStudentCodes(nextCodes);
        setReviewForms(nextReviewForms);
        setExpandedTasks((prev) => {
          const nextState = {};
          (response.tasks || []).forEach((task) => {
            nextState[task.id] = prev[task.id] ?? false;
          });
          return nextState;
        });
        setError("");
      } catch (err) {
        setError(err.message || "Не удалось загрузить урок");
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [lessonId]
  );

  useEffect(() => {
    loadLesson();
  }, [loadLesson]);

  useEffect(() => {
    const activeNode = lessonRailRefs.current[lessonId];
    if (!activeNode) {
      return;
    }
    activeNode.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [lessonId, data?.course_lessons]);

  const runAction = async (key, action) => {
    setBusyKey(key);
    setError("");
    try {
      await action();
    } catch (err) {
      setNotice("");
      setError(err.message || "Не удалось выполнить действие");
    } finally {
      setBusyKey("");
    }
  };

  const openTaskById = (taskId) => {
    setExpandedTasks(() => ({ [taskId]: true }));
    requestAnimationFrame(() => {
      taskRefs.current[taskId]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const updateTaskEditorField = (taskId, field, value) => {
    setTaskEditors((prev) => ({
      ...prev,
      [taskId]: { ...prev[taskId], [field]: value },
    }));
  };

  const updateNewTaskField = (field, value) => {
    setNewTask((prev) => ({ ...prev, [field]: value }));
  };

  const updateTaskTestField = (taskId, index, field, value) => {
    setTaskEditors((prev) => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        tests: prev[taskId].tests.map((item, itemIndex) =>
          itemIndex === index ? { ...item, [field]: value } : item
        ),
      },
    }));
  };

  const updateNewTaskTestField = (index, field, value) => {
    setNewTask((prev) => ({
      ...prev,
      tests: prev.tests.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addTaskTest = (taskId) => {
    if (!taskId) {
      setNewTask((prev) => ({
        ...prev,
        tests: [...prev.tests, { input_data: "", expected_output: "" }],
      }));
      return;
    }
    setTaskEditors((prev) => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        tests: [...prev[taskId].tests, { input_data: "", expected_output: "" }],
      },
    }));
  };

  const removeTaskTest = (taskId, index) => {
    if (!taskId) {
      setNewTask((prev) => ({
        ...prev,
        tests:
          prev.tests.length > 1
            ? prev.tests.filter((_, itemIndex) => itemIndex !== index)
            : [{ input_data: "", expected_output: "" }],
      }));
      return;
    }
    setTaskEditors((prev) => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        tests:
          prev[taskId].tests.length > 1
            ? prev[taskId].tests.filter((_, itemIndex) => itemIndex !== index)
            : [{ input_data: "", expected_output: "" }],
      },
    }));
  };

  if (!authed) return <Navigate to="/login" replace />;

  if (loading) {
    return (
      <Page>
        <Header />
        <Content>
          <StatusCard>Загрузка урока...</StatusCard>
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

  if (!data || !lessonForm) return null;

  const { course, lesson, tasks } = data;
  const canEdit = lesson.can_edit;
  const courseLessons = data.course_lessons || [];
  const currentLessonIndex = Math.max(
    0,
    courseLessons.findIndex((item) => item.id === lesson.id)
  );
  const lessonRailFillPercent = getLessonRailFillPercent(
    currentLessonIndex,
    courseLessons.length
  );

  const saveLesson = async (event) => {
    event.preventDefault();
    await runAction("save-lesson", async () => {
      await updateLesson(lessonId, {
        ...lessonForm,
        resources: lessonForm.resources
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        order: Number(lessonForm.order || 0),
      });
      setNotice("Материал урока обновлен.");
      await loadLesson({ showLoader: false });
      setShowMaterialEditor(false);
    });
  };

  const toggleLessonAccess = async () => {
    await runAction("lesson-access", async () => {
      await updateLesson(lessonId, { is_open: !lesson.is_open });
      setNotice(
        !lesson.is_open ? "Урок открыт для учеников." : "Урок закрыт для учеников."
      );
      await loadLesson({ showLoader: false });
    });
  };

  const handleTaskCreate = async (event) => {
    event.preventDefault();
    await runAction("create-task", async () => {
      await createTask({
        ...newTask,
        topic_id: lessonId,
        points: Number(newTask.points || 0),
        order: Number(newTask.order || 0),
        attachments: newTask.attachments
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        tests: newTask.tests.filter(
          (item) =>
            item.input_data.trim() !== "" || item.expected_output.trim() !== ""
        ),
      });
      setNewTask(emptyTaskForm);
      setNotice("Задача создана.");
      await loadLesson({ showLoader: false });
      setShowCreateTask(false);
    });
  };

  const handleTaskSave = async (taskId) => {
    await runAction(`save-task-${taskId}`, async () => {
      const editor = taskEditors[taskId];
      await updateTask(taskId, {
        ...editor,
        points: Number(editor.points || 0),
        order: Number(editor.order || 0),
        attachments: editor.attachments
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        tests: editor.tests.filter(
          (item) =>
            item.input_data.trim() !== "" || item.expected_output.trim() !== ""
        ),
      });
      setNotice("Задача обновлена.");
      await loadLesson({ showLoader: false });
      setEditingTaskId("");
    });
  };

  const handleTaskDelete = async (taskId) => {
    await runAction(`delete-task-${taskId}`, async () => {
      await deleteTask(taskId);
      setNotice("Задача удалена.");
      await loadLesson({ showLoader: false });
      setEditingTaskId("");
    });
  };

  const handleSubmitSolution = async (taskId) => {
    await runAction(`submit-${taskId}`, async () => {
      const response = await submitTask(taskId, {
        code: studentCodes[taskId] || "",
      });
      pushAchievements(response.newly_unlocked_achievements || []);
      setNotice("Решение отправлено на проверку.");
      await loadLesson({ showLoader: false });
    });
  };

  const handleReviewAction = async (taskId, studentId, approve) => {
    const reviewKey = `${taskId}:${studentId}`;
    await runAction(`review-${reviewKey}`, async () => {
      const response = await reviewTaskSubmission(taskId, studentId, {
        approve,
        comment: reviewForms[reviewKey] || "",
      });
      pushAchievements(response.newly_unlocked_achievements || []);
      setNotice(approve ? "Решение зачтено." : "Решение возвращено на доработку.");
      await loadLesson({ showLoader: false });
    });
  };

  return (
    <Page>
      <Header />
      <Content>
        <Breadcrumbs>
          <CrumbLink to="/mycourses">Мои курсы</CrumbLink>
          <span>/</span>
          <CrumbLink to={`/mycourses/${courseId}`}>{course.name}</CrumbLink>
          <span>/</span>
          <CurrentCrumb>{lesson.name}</CurrentCrumb>
        </Breadcrumbs>
        {courseLessons.length > 0 && (
          <LessonRailCard>
            <LessonRailViewport>
              <LessonRailTrack>
                <LessonRailBase />
                <LessonRailFill
                  style={{
                    width: `${lessonRailFillPercent}%`,
                    background: course.accent_color || "var(--green)",
                  }}
                />
                {courseLessons.map((courseLesson, index) => {
                  const isCurrent = courseLesson.id === lesson.id;
                  const isLocked = !courseLesson.can_edit && !courseLesson.can_access;

                  return (
                    <LessonRailItem key={courseLesson.id}>
                      <LessonRailButton
                        ref={(node) => {
                          lessonRailRefs.current[courseLesson.id] = node;
                        }}
                        type="button"
                        disabled={isLocked}
                        $active={isCurrent}
                        $locked={isLocked}
                        onClick={() => {
                          if (isLocked) return;
                          navigate(`/mycourses/${courseId}/lessons/${courseLesson.id}`);
                        }}
                      >
                        <LessonRailDot
                          $active={isCurrent}
                          $locked={isLocked}
                          style={{
                            borderColor: course.accent_color || "var(--green)",
                            background: isCurrent
                              ? course.accent_color || "var(--green)"
                              : undefined,
                          }}
                        />
                        <LessonRailText>
                          <strong>{courseLesson.name}</strong>
                          <span>{getLessonRailStatusLabel(courseLesson, index)}</span>
                        </LessonRailText>
                      </LessonRailButton>
                    </LessonRailItem>
                  );
                })}
              </LessonRailTrack>
            </LessonRailViewport>
          </LessonRailCard>
        )}
        {notice && <StatusCard>{notice}</StatusCard>}
        {error && <StatusCard $error>{error}</StatusCard>}
        <Card as={canEdit && showMaterialEditor ? "form" : "section"} onSubmit={canEdit && showMaterialEditor ? saveLesson : undefined}>
          <Row>
            <div>
              <SmallLabel>Урок</SmallLabel>
              {showMaterialEditor ? (
                <Field style={{ marginTop: 10 }}>
                  <Label>Название урока</Label>
                  <Input
                    value={lessonForm.name}
                    onChange={(event) =>
                      setLessonForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                  />
                </Field>
              ) : (
                <HeroTitle>{lesson.name}</HeroTitle>
              )}
            </div>
            {canEdit && (
              <ButtonRow>
                <SecondaryButton
                  type="button"
                  onClick={() => setShowMaterialEditor((prev) => !prev)}
                >
                  {showMaterialEditor ? "Закрыть настройки" : "⚙ Настроить урок"}
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  disabled={busyKey === "lesson-access"}
                  onClick={toggleLessonAccess}
                >
                  {busyKey === "lesson-access"
                    ? "Сохраняю..."
                    : lesson.is_open
                    ? "Закрыть урок"
                    : "Открыть урок"}
                </SecondaryButton>
                <PrimaryButton
                  type="button"
                  onClick={() => setShowCreateTask((prev) => !prev)}
                >
                  {showCreateTask ? "Скрыть форму" : "Добавить задачу"}
                </PrimaryButton>
                {showMaterialEditor && (
                  <PrimaryButton type="submit" disabled={busyKey === "save-lesson"}>
                    {busyKey === "save-lesson"
                      ? "Сохраняю..."
                      : "Сохранить урок"}
                  </PrimaryButton>
                )}
              </ButtonRow>
            )}
          </Row>
          {showMaterialEditor ? (
            <>
              <Field>
                <Label>Краткое описание</Label>
                <Input
                  value={lessonForm.description}
                  onChange={(event) =>
                    setLessonForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field>
                <Label>Конспект урока</Label>
                <Textarea
                  rows={10}
                  value={lessonForm.content}
                  onChange={(event) =>
                    setLessonForm((prev) => ({
                      ...prev,
                      content: event.target.value,
                    }))
                  }
                />
              </Field>
              <Grid2>
                <Field>
                  <Label>Материалы, по одной ссылке в строке</Label>
                  <Textarea
                    rows={4}
                    value={lessonForm.resources}
                    onChange={(event) =>
                      setLessonForm((prev) => ({
                        ...prev,
                        resources: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <Label>Порядок урока в курсе</Label>
                  <Input
                    type="number"
                    min="0"
                    value={lessonForm.order}
                    onChange={(event) =>
                      setLessonForm((prev) => ({
                        ...prev,
                        order: event.target.value,
                      }))
                    }
                  />
                </Field>
              </Grid2>
            </>
          ) : (
            <>
              <MutedText>{lesson.description}</MutedText>
              <TextBlock>{lesson.content || "Конспект пока не добавлен."}</TextBlock>
              <Stack>
                {(lesson.resources || []).length === 0 && (
                  <MutedText>Материалы пока не добавлены.</MutedText>
                )}
                {(lesson.resources || []).map((resource) => (
                  <a key={resource} href={resource} target="_blank" rel="noreferrer">
                    {resource}
                  </a>
                ))}
              </Stack>
              <MutedText>
                Прогресс по уроку: {Math.round(lesson.progress_percent)}%
              </MutedText>
              <Track>
                <Fill
                  style={{ width: `${Math.min(100, lesson.progress_percent)}%` }}
                />
              </Track>
            </>
          )}
        </Card>
        <Row>
          <div>
            <SectionTitle>Задачи</SectionTitle>
            {tasks.length > 0 && (
              <TaskSwitchGrid>
                {tasks.map((task, index) => (
                  <TaskSwitchButton
                    key={`task-switch-${task.id}`}
                    type="button"
                    $tone={getTaskIndicatorTone(task.result?.status)}
                    onClick={() => openTaskById(task.id)}
                    title={task.title}
                  >
                    {index + 1}
                  </TaskSwitchButton>
                ))}
              </TaskSwitchGrid>
            )}
          </div>
          {canEdit && (
            <PrimaryButton
              type="button"
              onClick={() => setShowCreateTask((prev) => !prev)}
            >
              {showCreateTask ? "Скрыть форму" : "Добавить задачу"}
            </PrimaryButton>
          )}
        </Row>
        {canEdit && showCreateTask && (
          <Card as="form" onSubmit={handleTaskCreate}>
            <SectionTitle>Добавить задачу</SectionTitle>
            <TaskEditorFields
              form={newTask}
              onFieldChange={updateNewTaskField}
              onTestChange={updateNewTaskTestField}
              onAddTest={() => addTaskTest(null)}
              onRemoveTest={(index) => removeTaskTest(null, index)}
            />
            <PrimaryButton type="submit" disabled={busyKey === "create-task"}>
              {busyKey === "create-task" ? "Создаю..." : "Создать задачу"}
            </PrimaryButton>
          </Card>
        )}
        {tasks.length === 0 && <StatusCard>В этом уроке пока нет задач.</StatusCard>}
        <Stack>
          {tasks.map((task) => {
            const result = task.result;
            const statusMeta = getStatusMeta(result?.status || "no_attempts");
            const lastSubmission = result?.last_submission;
            const submissionHistory = result?.submission_history || [];
            const pendingReviews = task.pending_reviews || [];
            const isSolved = result?.status === "correct";
            const isExpanded = Boolean(expandedTasks[task.id]);
            const isEditingTask = editingTaskId === task.id;
            const attemptsToShow =
              submissionHistory.length > 0
                ? submissionHistory
                : lastSubmission
                ? [lastSubmission]
                : [];
            return (
              <TaskCard
                key={task.id}
                $solved={isSolved}
                ref={(node) => {
                  taskRefs.current[task.id] = node;
                }}
              >
                <TaskHeaderButton
                  type="button"
                  onClick={() =>
                    setExpandedTasks((prev) => ({
                      ...prev,
                      [task.id]: !prev[task.id],
                    }))
                  }
                >
                  <div>
                    <HeroSubtitle>{task.title}</HeroSubtitle>
                    <TaskInfo>
                      {task.points} баллов · {task.language}
                    </TaskInfo>
                  </div>
                  <Row>
                    {task.requires_manual_review && (
                      <Badge $tone="manual">Ручная проверка</Badge>
                    )}
                    {!canEdit && <Badge $tone={statusMeta.tone}>{statusMeta.label}</Badge>}
                  </Row>
                </TaskHeaderButton>
                {isExpanded && (
                  <Stack>
                    <TextBlock>{task.condition}</TextBlock>
                    {(task.attachments || []).length > 0 && (
                      <AttachmentList>
                        {(task.attachments || []).map((attachment) => (
                          <AttachmentItem key={attachment}>
                            <a href={attachment} target="_blank" rel="noreferrer">
                              {attachment}
                            </a>
                          </AttachmentItem>
                        ))}
                      </AttachmentList>
                    )}
                    {canEdit ? (
                      <>
                        <ButtonRow>
                          <SecondaryButton
                            type="button"
                            onClick={() =>
                              setEditingTaskId((prev) =>
                                prev === task.id ? "" : task.id
                              )
                            }
                          >
                            {isEditingTask
                              ? "Скрыть редактор задачи"
                              : "Отредактировать задачу"}
                          </SecondaryButton>
                        </ButtonRow>
                        {isEditingTask && (
                          <Card>
                            <SectionTitle>Редактор задачи</SectionTitle>
                            <TaskEditorFields
                              form={taskEditors[task.id]}
                              onFieldChange={(field, value) =>
                                updateTaskEditorField(task.id, field, value)
                              }
                              onTestChange={(index, field, value) =>
                                updateTaskTestField(task.id, index, field, value)
                              }
                              onAddTest={() => addTaskTest(task.id)}
                              onRemoveTest={(index) => removeTaskTest(task.id, index)}
                            />
                            <ButtonRow>
                              <DangerButton
                                type="button"
                                onClick={() => handleTaskDelete(task.id)}
                                disabled={busyKey === `delete-task-${task.id}`}
                              >
                                {busyKey === `delete-task-${task.id}`
                                  ? "Удаляю..."
                                  : "Удалить задачу"}
                              </DangerButton>
                              <PrimaryButton
                                type="button"
                                onClick={() => handleTaskSave(task.id)}
                                disabled={busyKey === `save-task-${task.id}`}
                              >
                                {busyKey === `save-task-${task.id}`
                                  ? "Сохраняю..."
                                  : "Сохранить задачу"}
                              </PrimaryButton>
                            </ButtonRow>
                          </Card>
                        )}
                        <Card>
                          <strong>Ручная проверка</strong>
                          {!task.requires_manual_review && (
                            <MutedText>Для этой задачи ручная проверка не включена.</MutedText>
                          )}
                          {task.requires_manual_review && pendingReviews.length === 0 && (
                            <MutedText>Пока нет решений, ожидающих преподавателя.</MutedText>
                          )}
                          {pendingReviews.map((review) => {
                            const reviewKey = `${task.id}:${review.user_id}`;
                            const reviewSubmission = review.last_submission;
                            return (
                              <SubCard key={reviewKey}>
                                <Row>
                                  <div>
                                    <strong>
                                      {review.name} {review.surname}
                                    </strong>
                                    <MutedText>
                                      @{review.tg_username} · попыток: {review.attempts} ·{" "}
                                      {formatDateTime(reviewSubmission?.created_at)}
                                    </MutedText>
                                  </div>
                                  <Badge $tone="info">Ждет проверки</Badge>
                                </Row>
                                <MutedText>
                                  Пройдено {reviewSubmission?.passed_tests || 0}/
                                  {reviewSubmission?.total_tests || 0} тестов
                                </MutedText>
                                <CodePreview>{reviewSubmission?.code || ""}</CodePreview>
                                <TestReport
                                  testResults={reviewSubmission?.test_results || []}
                                />
                                <Field>
                                  <Label>Комментарий преподавателя</Label>
                                  <Textarea
                                    rows={4}
                                    value={reviewForms[reviewKey] || ""}
                                    onChange={(event) =>
                                      setReviewForms((prev) => ({
                                        ...prev,
                                        [reviewKey]: event.target.value,
                                      }))
                                    }
                                  />
                                </Field>
                                <ButtonRow>
                                  <DangerButton
                                    type="button"
                                    onClick={() =>
                                      handleReviewAction(task.id, review.user_id, false)
                                    }
                                    disabled={busyKey === `review-${reviewKey}`}
                                  >
                                    Вернуть на доработку
                                  </DangerButton>
                                  <PrimaryButton
                                    type="button"
                                    onClick={() =>
                                      handleReviewAction(task.id, review.user_id, true)
                                    }
                                    disabled={busyKey === `review-${reviewKey}`}
                                  >
                                    Зачесть задачу
                                  </PrimaryButton>
                                </ButtonRow>
                              </SubCard>
                            );
                          })}
                        </Card>
                      </>
                    ) : (
                      <>
                        {result && (
                          <ResultSummaryCard $tone={statusMeta.tone}>
                            <Row>
                              <Badge $tone={statusMeta.tone}>{statusMeta.label}</Badge>
                              <MutedText>Попыток: {result.attempts}</MutedText>
                            </Row>
                            <MutedText>{statusMeta.description}</MutedText>
                            <ResultFacts>
                              <ResultFact>
                                <span>Баллы</span>
                                <strong>
                                  {result.score} / {task.points}
                                </strong>
                              </ResultFact>
                              {task.requires_manual_review && (
                                <ResultFact>
                                  <span>Проверка</span>
                                  <strong>
                                    {result.reviewed_at
                                      ? formatDateTime(result.reviewed_at)
                                      : "Ждет преподавателя"}
                                  </strong>
                                </ResultFact>
                              )}
                              {lastSubmission && (
                                <ResultFact>
                                  <span>Тесты</span>
                                  <strong>
                                    {lastSubmission.passed_tests}/
                                    {lastSubmission.total_tests}
                                  </strong>
                                </ResultFact>
                              )}
                            </ResultFacts>
                            {result.review_comment && (
                              <SubCard>{result.review_comment}</SubCard>
                            )}
                          </ResultSummaryCard>
                        )}
                        <Field>
                          <Label>Ваше решение</Label>
                          <CodeArea
                            rows={14}
                            value={studentCodes[task.id] || ""}
                            onChange={(event) =>
                              setStudentCodes((prev) => ({
                                ...prev,
                                [task.id]: event.target.value,
                              }))
                            }
                            placeholder="Напишите решение на Python"
                          />
                        </Field>
                        <PrimaryButton
                          type="button"
                          onClick={() => handleSubmitSolution(task.id)}
                          disabled={busyKey === `submit-${task.id}`}
                        >
                          {busyKey === `submit-${task.id}`
                            ? "Отправляю..."
                            : "Отправить на проверку"}
                        </PrimaryButton>
                        {result && (
                          <BottomScoreCard>
                            <strong>Баллы по задаче</strong>
                            <MutedText>
                              Начислено {result.score} из {task.points} возможных
                              баллов.
                              {task.requires_manual_review
                                ? result.reviewed_at
                                  ? ` Проверка завершена ${formatDateTime(
                                      result.reviewed_at
                                    )}.`
                                  : " Баллы окончательно подтвердятся после ручной проверки."
                                : " Для этой задачи ручная проверка не требуется."}
                            </MutedText>
                          </BottomScoreCard>
                        )}
                        {attemptsToShow.length > 0 && (
                          <Stack>
                            <strong>История попыток</strong>
                            <AttemptList>
                              {attemptsToShow.map((submission, index) => (
                                <AttemptButton
                                  key={`${task.id}-${submission.created_at}-${index}`}
                                  type="button"
                                  onClick={() =>
                                    setHistoryDrawer({
                                      taskId: task.id,
                                      taskTitle: task.title,
                                      attemptNumber: Math.max(
                                        (result?.attempts || attemptsToShow.length) - index,
                                        1
                                      ),
                                      submission,
                                    })
                                  }
                                >
                                  <div>
                                    <strong>
                                      Попытка{" "}
                                      {Math.max(
                                        (result?.attempts || attemptsToShow.length) - index,
                                        1
                                      )}
                                    </strong>
                                    <AttemptMeta>
                                      {submission.passed_tests}/{submission.total_tests} тестов ·{" "}
                                      {formatDateTime(submission.created_at)}
                                    </AttemptMeta>
                                  </div>
                                  <Badge $tone={getAttemptTone(submission)}>
                                    {getAttemptLabel(submission)}
                                  </Badge>
                                </AttemptButton>
                              ))}
                            </AttemptList>
                          </Stack>
                        )}
                      </>
                    )}
                  </Stack>
                )}
              </TaskCard>
            );
          })}
        </Stack>
        {historyDrawer && (
          <DrawerOverlay onClick={() => setHistoryDrawer(null)}>
            <HistoryDrawer onClick={(event) => event.stopPropagation()}>
              <DrawerHeader>
                <div>
                  <SectionTitle>{historyDrawer.taskTitle}</SectionTitle>
                  <MutedText>Попытка {historyDrawer.attemptNumber}</MutedText>
                </div>
                <IconButton
                  type="button"
                  onClick={() => setHistoryDrawer(null)}
                  aria-label="Закрыть историю"
                >
                  ×
                </IconButton>
              </DrawerHeader>
              <Badge $tone={getAttemptTone(historyDrawer.submission)}>
                {getAttemptLabel(historyDrawer.submission)}
              </Badge>
              <MutedText>
                {historyDrawer.submission.passed_tests}/
                {historyDrawer.submission.total_tests} тестов ·{" "}
                {formatDateTime(historyDrawer.submission.created_at)}
              </MutedText>
              <CodePreview>{historyDrawer.submission.code || ""}</CodePreview>
              <CodeBlock>
                <span>stdout</span>
                <code>{historyDrawer.submission.stdout || "пусто"}</code>
              </CodeBlock>
              <CodeBlock>
                <span>stderr</span>
                <code>{historyDrawer.submission.stderr || "пусто"}</code>
              </CodeBlock>
              <TestReport
                testResults={historyDrawer.submission.test_results || []}
              />
            </HistoryDrawer>
          </DrawerOverlay>
        )}
      </Content>
    </Page>
  );
}

export default LessonPage;

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
`;

const LessonRailCard = styled.section`
  background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
  border: 1px solid var(--border);
  border-radius: 24px;
  box-shadow: var(--shadow);
  padding: 20px 0 12px;
  overflow: hidden;
`;

const LessonRailViewport = styled.div`
  overflow-x: auto;
  overflow-y: hidden;
  margin: 0 -18px;
  padding: 0 18px 6px;
  scrollbar-width: thin;
`;

const LessonRailTrack = styled.div`
  position: relative;
  display: inline-flex;
  align-items: flex-start;
  gap: 42px;
  width: max-content;
  padding: 10px 54px 0;
`;

const LessonRailBase = styled.div`
  position: absolute;
  left: 54px;
  right: 54px;
  top: 21px;
  height: 8px;
  border-radius: 999px;
  background: #dbe3ee;
`;

const LessonRailFill = styled.div`
  position: absolute;
  left: 54px;
  top: 21px;
  height: 8px;
  max-width: calc(100% - 108px);
  border-radius: 999px;
  transition: width 0.25s ease;
`;

const LessonRailItem = styled.div`
  position: relative;
  z-index: 1;
  min-width: 280px;
`;

const LessonRailButton = styled.button`
  border: none;
  background: transparent;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
  color: ${(props) => (props.$locked ? "#8a94a7" : "var(--text)")};
  cursor: ${(props) => (props.disabled ? "default" : "pointer")};
  opacity: ${(props) => (props.$locked ? 0.78 : 1)};
`;

const LessonRailDot = styled.span`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 5px solid var(--green);
  background: ${(props) => {
    if (props.$active) return "var(--green)";
    if (props.$locked) return "#f2f5f9";
    return "#ffffff";
  }};
  box-shadow: ${(props) =>
    props.$active
      ? "0 10px 20px rgba(22, 160, 133, 0.24)"
      : "0 0 0 4px rgba(148, 163, 184, 0.12)"};
  transition: transform 0.2s ease;

  ${LessonRailButton}:hover & {
    transform: ${(props) => (props.$locked ? "none" : "scale(1.05)")};
  }
`;

const LessonRailText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 240px;

  strong {
    font-size: 16px;
    line-height: 1.35;
  }

  span {
    color: var(--muted);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
`;

const CrumbLink = styled(Link)`
  text-decoration: none;
`;

const CurrentCrumb = styled.span`
  color: var(--text);
`;

const Card = styled.section`
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 24px;
  box-shadow: var(--shadow);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const SubCard = styled.div`
  padding: 16px;
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid #e6ebf2;
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
`;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Grid2 = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
  }
`;

const Grid3 = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const MiniGrid = styled(Grid2)``;

const SmallLabel = styled.div`
  color: var(--muted);
  font-style: italic;
`;

const HeroTitle = styled.h1`
  font-size: clamp(30px, 5vw, 48px);
`;

const HeroSubtitle = styled.h3`
  font-size: 24px;
`;

const SectionTitle = styled.h2`
  font-size: 30px;
`;

const TaskSwitchGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
`;

const TaskSwitchButton = styled.button`
  width: 46px;
  height: 46px;
  border-radius: 14px;
  border: 1px solid
    ${(props) => {
      if (props.$tone === "success") return "#bde7ce";
      if (props.$tone === "warning") return "#f1c6c6";
      return "#d8dde7";
    }};
  background: ${(props) => {
    if (props.$tone === "success") return "#def7e9";
    if (props.$tone === "warning") return "#fff0f0";
    return "#f1f3f7";
  }};
  color: ${(props) => {
    if (props.$tone === "success") return "#148564";
    if (props.$tone === "warning") return "#bf4242";
    return "#677185";
  }};
  font-weight: 800;
  cursor: pointer;
`;

const TaskInfo = styled.div`
  color: var(--green);
  font-weight: 800;
  margin-top: 6px;
`;

const TextBlock = styled.div`
  line-height: 1.75;
  white-space: pre-wrap;
`;

const Track = styled.div`
  width: 100%;
  height: 12px;
  background: #eceff5;
  border-radius: 999px;
  overflow: hidden;
`;

const Fill = styled.div`
  height: 100%;
  border-radius: 999px;
  background: var(--green);
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
  border: 1px solid #d7dbe4;
  border-radius: 12px;
  padding: 13px 14px;
  background: #fff;
`;

const Textarea = styled.textarea`
  width: 100%;
  border: 1px solid #d7dbe4;
  border-radius: 12px;
  padding: 13px 14px;
  background: #fff;
  resize: vertical;
`;

const CodeArea = styled.textarea`
  width: 100%;
  border: 1px solid #1d2230;
  border-radius: 18px;
  padding: 16px;
  background: #141925;
  color: #edf1ff;
  resize: vertical;
  font-family: "JetBrains Mono", monospace;
  line-height: 1.6;
`;

const CodePreview = styled.pre`
  margin: 0;
  padding: 16px;
  border-radius: 18px;
  background: #141925;
  color: #edf1ff;
  font-family: "JetBrains Mono", monospace;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-x: auto;
`;

const CodeBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;

  span {
    color: var(--muted);
    font-weight: 700;
  }

  code {
    padding: 12px 14px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.82);
    white-space: pre-wrap;
    word-break: break-word;
  }
`;

const AttachmentList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const AttachmentItem = styled.div`
  padding: 10px 14px;
  border-radius: 999px;
  background: #f6f8fc;
  border: 1px solid #e6eaf2;
`;

const TaskCard = styled.article`
  background: ${(props) => (props.$solved ? "#f3fcf7" : "var(--card)")};
  border: 1px solid ${(props) => (props.$solved ? "#d4efdf" : "var(--border)")};
  border-radius: 24px;
  box-shadow: var(--shadow);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const TaskHeaderButton = styled.button`
  width: 100%;
  border: none;
  background: transparent;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  cursor: pointer;
  text-align: left;

  @media (max-width: 760px) {
    flex-direction: column;
  }
`;

const Badge = styled.div`
  padding: 10px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  background: ${(props) => {
    if (props.$tone === "success") return "#def7e9";
    if (props.$tone === "warning") return "#fff0dd";
    if (props.$tone === "info") return "#e8f1ff";
    if (props.$tone === "manual") return "#fff4e8";
    return "#eef1f6";
  }};
  color: ${(props) => {
    if (props.$tone === "success") return "#148564";
    if (props.$tone === "warning") return "#b66b12";
    if (props.$tone === "info") return "#2f67c9";
    if (props.$tone === "manual") return "#d66f0e";
    return "#576177";
  }};
`;

const ResultSummaryCard = styled(SubCard)`
  background: ${(props) => {
    if (props.$tone === "success") return "#f3fcf7";
    if (props.$tone === "warning") return "#fff8f0";
    if (props.$tone === "info") return "#f4f8ff";
    return "#f8fafc";
  }};
`;

const ResultFacts = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 12px;
`;

const ResultFact = styled.div`
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(31, 42, 68, 0.08);

  span {
    display: block;
    color: var(--muted);
    margin-bottom: 6px;
  }

  strong {
    font-size: 20px;
  }
`;

const BottomScoreCard = styled.div`
  padding: 16px 18px;
  border-radius: 18px;
  background: #f7f8fb;
  border: 1px solid #e7ebf2;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const AttemptList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const AttemptButton = styled.button`
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: center;
  text-align: left;
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid #e6ebf2;
  background: #f8fafc;
  cursor: pointer;

  @media (max-width: 760px) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

const AttemptMeta = styled.div`
  color: var(--muted);
  line-height: 1.6;
  margin-top: 4px;
`;

const TestEditorRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr)) 160px;
  gap: 10px;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const ToggleLabel = styled.label`
  display: inline-flex;
  gap: 10px;
  align-items: center;
  font-weight: 700;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
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

const GhostButton = styled(SecondaryButton)``;

const DangerButton = styled.button`
  border: none;
  border-radius: 12px;
  background: #f05d5d;
  color: #fff;
  padding: 14px 18px;
  font-weight: 800;
  cursor: pointer;
`;

const StatusCard = styled.div`
  padding: 16px 18px;
  border-radius: 16px;
  background: ${(props) => (props.$error ? "#fff0f0" : "#f2f6ff")};
  color: ${(props) => (props.$error ? "#b53d3d" : "#334b7d")};
`;

const DrawerOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(20, 25, 37, 0.42);
  display: flex;
  justify-content: flex-end;
  z-index: 50;
`;

const HistoryDrawer = styled.aside`
  width: min(560px, 100%);
  height: 100%;
  overflow: auto;
  background: #fff;
  padding: 28px 24px 32px;
  box-shadow: -18px 0 48px rgba(12, 18, 28, 0.18);
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const DrawerHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
`;

const IconButton = styled.button`
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid #d7dbe4;
  background: #fff;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
`;

const MutedText = styled.p`
  color: var(--muted);
  line-height: 1.6;
`;
