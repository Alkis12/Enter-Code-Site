import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { Link, Navigate } from "react-router-dom";

import Header from "../components/Header/Header";
import { clearSession, isAuthenticated, logout } from "../api/auth";
import { getDashboard } from "../api/account";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8002";
const EMPTY_ARRAY = [];

function formatDateTime(value) {
  if (!value) return "Без даты";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function resolveAssetUrl(url) {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function getInitials(user) {
  return `${user.name?.[0] || ""}${user.surname?.[0] || ""}`.trim() || "EC";
}

function getRoleLabel(userType) {
  if (userType === "admin") return "Администратор";
  if (userType === "teacher") return "Преподаватель";
  if (userType === "parent") return "Родитель";
  return "Ученик";
}

function ProfilePage() {
  const authed = isAuthenticated();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shouldRedirectToLogin, setShouldRedirectToLogin] = useState(false);
  const [achievementView, setAchievementView] = useState("common");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const response = await getDashboard();
        setDashboard(response);
        setError("");
      } catch (err) {
        if (
          err.message === "Not authenticated" ||
          err.message === "Could not validate credentials"
        ) {
          clearSession();
          setShouldRedirectToLogin(true);
          return;
        }
        setError(err.message || "Не удалось загрузить кабинет");
      } finally {
        setLoading(false);
      }
    };

    if (authed) {
      loadDashboard();
    }
  }, [authed]);

  const user = dashboard?.user || null;
  const courses = dashboard?.courses || EMPTY_ARRAY;
  const achievements = dashboard?.achievements || EMPTY_ARRAY;
  const linkedStudents = dashboard?.linked_students || EMPTY_ARRAY;
  const pendingReviews = dashboard?.pending_reviews || EMPTY_ARRAY;
  const isStudent = user?.user_type === "student";
  const isAdmin = user?.user_type === "admin";
  const isParent = user?.user_type === "parent";
  const courseDebts = courses.filter(
    (course) => Number(course?.finance?.debt_count || 0) > 0
  );
  const primaryDebt = courseDebts[0]?.finance || null;
  const unlockedAchievements = achievements.filter(
    (achievement) => achievement.state === "unlocked"
  ).length;
  const observedCourses = linkedStudents.reduce(
    (sum, student) => sum + (student.course_progress?.length || 0),
    0
  );

  const commonAchievements = achievements.filter((achievement) => !achievement.course_id);
  const courseAchievementGroups = useMemo(() => {
    const courseMap = new Map(courses.map((course) => [course.id, course]));
    const grouped = achievements.reduce((acc, achievement) => {
      if (!achievement.course_id) return acc;
      if (!acc[achievement.course_id]) {
        acc[achievement.course_id] = [];
      }
      acc[achievement.course_id].push(achievement);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([courseId, items]) => ({
        courseId,
        courseName: courseMap.get(courseId)?.name || "Курс",
        items,
      }))
      .sort((a, b) => a.courseName.localeCompare(b.courseName, "ru"));
  }, [achievements, courses]);

  if (!authed) {
    return <Navigate to="/login" replace />;
  }

  if (shouldRedirectToLogin) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <Page>
        <Header />
        <Content>
          <InfoCard>Загрузка кабинета...</InfoCard>
        </Content>
      </Page>
    );
  }

  if (error && !dashboard) {
    return (
      <Page>
        <Header />
        <Content>
          <InfoCard $error>{error}</InfoCard>
        </Content>
      </Page>
    );
  }

  if (!dashboard || !user) {
    return null;
  }

  const renderAchievementCard = (achievement) => (
    <AchievementCard key={achievement.id} $state={achievement.state}>
      <AchievementAvatar $state={achievement.state}>
        {achievement.avatar_url ? (
          <img
            src={resolveAssetUrl(achievement.avatar_url)}
            alt={achievement.title}
          />
        ) : (
          <span>{achievement.title.slice(0, 1).toUpperCase()}</span>
        )}
      </AchievementAvatar>
      <AchievementBody>
        <strong>
          {achievement.state === "hidden"
            ? "Скрытое достижение"
            : achievement.title}
        </strong>
        <p>
          {achievement.state === "hidden"
            ? "Описание появится после открытия."
            : achievement.description}
        </p>
        {achievement.unlocked_at && (
          <small>Открыто: {formatDateTime(achievement.unlocked_at)}</small>
        )}
      </AchievementBody>
    </AchievementCard>
  );

  const renderLinkedStudent = (student) => (
    <LinkedStudentCard key={student.user_id}>
      <LinkedStudentTop>
        <div>
          <LinkedStudentName>
            {student.name} {student.surname}
          </LinkedStudentName>
          <MutedText>@{student.tg_username}</MutedText>
        </div>
        <LinkedStudentStatGroup>
          <span>Прогресс: {Math.round(student.progress_percent || 0)}%</span>
          <span>Баллы: {student.points || 0}</span>
        </LinkedStudentStatGroup>
      </LinkedStudentTop>

      {(student.course_progress || []).length === 0 ? (
        <MutedText>Ученик пока не привязан ни к одному курсу.</MutedText>
      ) : (
        <LinkedCourseList>
          {student.course_progress.map((course) => (
            <LinkedCourseCard key={`${student.user_id}:${course.course_id}`}>
              <CourseHeader>
                <strong>{course.course_name}</strong>
                <span>{Math.round(course.progress_percent || 0)}%</span>
              </CourseHeader>
              <CourseTrack>
                <CourseBar
                  style={{
                    width: `${Math.min(100, course.progress_percent || 0)}%`,
                    background: "#ff7f2a",
                  }}
                />
              </CourseTrack>
              <LinkedMetaGrid>
                <LinkedMetaBox>
                  <span>Группа</span>
                  <strong>{course.group_name || "Не назначена"}</strong>
                </LinkedMetaBox>
                <LinkedMetaBox>
                  <span>Посещаемость</span>
                  <strong>
                    {course.attendance?.attended_sessions || 0}/
                    {course.attendance?.total_sessions || 0}
                  </strong>
                </LinkedMetaBox>
                <LinkedMetaBox>
                  <span>Оплата</span>
                  <strong>{course.finance?.debt_label || "Без долга"}</strong>
                </LinkedMetaBox>
              </LinkedMetaGrid>
            </LinkedCourseCard>
          ))}
        </LinkedCourseList>
      )}
    </LinkedStudentCard>
  );

  return (
    <Page>
      <Header />
      <Content>
        {error && <InfoCard $error>{error}</InfoCard>}

        <HeroCard>
          <AvatarBlock>
            <AvatarFrame>
              {user.avatar_url ? (
                <AvatarImage
                  src={resolveAssetUrl(user.avatar_url)}
                  alt={`${user.name} ${user.surname}`}
                />
              ) : (
                <AvatarFallback>{getInitials(user)}</AvatarFallback>
              )}
            </AvatarFrame>
          </AvatarBlock>

          <HeroBody>
            <HeroTop>
              <div>
                <Name>
                  {user.name} {user.surname}
                </Name>
                <RoleLine>{getRoleLabel(user.user_type)}</RoleLine>
              </div>

              <ActionRow>
                <PrimaryLink to="/profile/edit">Редактировать профиль</PrimaryLink>
                <DangerAction
                  type="button"
                  onClick={async () => {
                    await logout();
                    window.location.href = "/login";
                  }}
                >
                  Выйти
                </DangerAction>
              </ActionRow>
            </HeroTop>

            <SummaryGrid>
              <SummaryBox>
                <span>Логин</span>
                <strong>@{user.tg_username}</strong>
              </SummaryBox>
              <SummaryBox>
                <span>{isStudent ? "Баллы" : isParent ? "Дети" : "Проверка"}</span>
                <strong>
                  {isStudent ? user.points : isParent ? linkedStudents.length : pendingReviews.length}
                </strong>
              </SummaryBox>
              {!isAdmin && !isParent && (
                <SummaryBox>
                  <span>Достижения</span>
                  <strong>{unlockedAchievements}</strong>
                </SummaryBox>
              )}
              <SummaryBox>
                <span>{isParent ? "Курсы детей" : "Курсы"}</span>
                <strong>{isParent ? observedCourses : courses.length}</strong>
              </SummaryBox>
              {isStudent && primaryDebt && (
                <SummaryBox>
                  <span>
                    {primaryDebt.payment_mode === "subscription"
                      ? "Абонемент"
                      : "Оплата"}
                  </span>
                  <strong>
                    {courseDebts.length > 1
                      ? `Долги по курсам: ${courseDebts.length}`
                      : primaryDebt.debt_label}
                  </strong>
                </SummaryBox>
              )}
            </SummaryGrid>
          </HeroBody>
        </HeroCard>

        <SectionCard>
          <SectionHeader>
            <SectionTitle>{isParent ? "Мои дети" : "Мои курсы"}</SectionTitle>
          </SectionHeader>

          {isParent ? (
            linkedStudents.length === 0 ? (
              <MutedText>К этому аккаунту пока не привязан ни один ученик.</MutedText>
            ) : (
              <LinkedStudentsList>{linkedStudents.map(renderLinkedStudent)}</LinkedStudentsList>
            )
          ) : (
            <CourseList>
              {courses.length === 0 && (
                <MutedText>Пока нет подключенных курсов.</MutedText>
              )}
              {courses.map((course) => (
                <CourseLine key={course.id}>
                  <CourseHeader>
                    <Link to={`/mycourses/${course.id}`}>{course.name}</Link>
                    {isStudent ? (
                      <span>
                        {course.earned_points}/{course.total_points} баллов
                      </span>
                    ) : (
                      <span>
                        {course.total_students} учеников · {course.total_tasks} задач
                      </span>
                    )}
                  </CourseHeader>
                  {isStudent ? (
                    <CourseTrack>
                      <CourseBar
                        style={{
                          width: `${Math.min(100, course.progress_percent || 0)}%`,
                          background: course.accent_color,
                        }}
                      />
                    </CourseTrack>
                  ) : (
                    <MutedText>
                      {course.active_group_name
                        ? `Ваша группа: ${course.active_group_name}`
                        : "Курс доступен для управления"}
                    </MutedText>
                  )}
                </CourseLine>
              ))}
            </CourseList>
          )}
        </SectionCard>

        {!isAdmin && !isParent && (
          <SplitGrid>
            <MainColumn>
              <SectionCard>
                <SectionHeader>
                  <SectionTitle>Достижения</SectionTitle>
                  <TabRow>
                    <TabButton
                      type="button"
                      $active={achievementView === "common"}
                      onClick={() => setAchievementView("common")}
                    >
                      Общие
                    </TabButton>
                    <TabButton
                      type="button"
                      $active={achievementView === "courses"}
                      onClick={() => setAchievementView("courses")}
                    >
                      По курсам
                    </TabButton>
                  </TabRow>
                </SectionHeader>

                {achievementView === "common" ? (
                  commonAchievements.length === 0 ? (
                    <EmptyCard>Общих достижений пока нет.</EmptyCard>
                  ) : (
                    <AchievementsGrid>{commonAchievements.map(renderAchievementCard)}</AchievementsGrid>
                  )
                ) : courseAchievementGroups.length === 0 ? (
                  <EmptyCard>По курсам пока нет достижений.</EmptyCard>
                ) : (
                  <Stack>
                    {courseAchievementGroups.map((group) => (
                      <CourseAchievementBlock key={group.courseId}>
                        <CourseAchievementTitle>{group.courseName}</CourseAchievementTitle>
                        <AchievementsGrid>
                          {group.items.map(renderAchievementCard)}
                        </AchievementsGrid>
                      </CourseAchievementBlock>
                    ))}
                  </Stack>
                )}
              </SectionCard>
            </MainColumn>
          </SplitGrid>
        )}
      </Content>
    </Page>
  );
}

export default ProfilePage;

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
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 28px;
  align-items: start;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 28px;
  box-shadow: var(--shadow);
  padding: 28px;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const AvatarBlock = styled.div`
  display: flex;
  justify-content: center;
`;

const AvatarFrame = styled.div`
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: linear-gradient(145deg, #ececef 0%, #d7d8dc 100%);
  box-shadow: inset 0 10px 24px rgba(255, 255, 255, 0.7);
  overflow: hidden;
  display: grid;
  place-items: center;

  @media (max-width: 980px) {
    width: 180px;
    height: 180px;
  }
`;

const AvatarImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const AvatarFallback = styled.div`
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 56px;
  font-weight: 800;
  background: linear-gradient(135deg, #ff7f2a 0%, #ffb067 100%);
`;

const HeroBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 22px;
`;

const HeroTop = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
`;

const Name = styled.h1`
  font-size: clamp(34px, 6vw, 56px);
`;

const RoleLine = styled.div`
  color: var(--muted);
  font-style: italic;
  margin-top: 6px;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: flex-start;
`;

const PrimaryLink = styled(Link)`
  text-decoration: none;
  border-radius: 12px;
  background: var(--orange);
  color: #fff;
  padding: 14px 18px;
  font-weight: 800;
`;

const DangerAction = styled.button`
  border: none;
  border-radius: 14px;
  background: #f05d5d;
  color: #fff;
  padding: 14px 18px;
  font-weight: 800;
  cursor: pointer;
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 14px;
`;

const SummaryBox = styled.div`
  background: #f7f8fb;
  border-radius: 18px;
  padding: 16px 18px;

  span {
    display: block;
    color: var(--muted);
    margin-bottom: 8px;
  }

  strong {
    font-size: 20px;
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
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
`;

const SectionTitle = styled.h2`
  font-size: 30px;
`;

const CourseList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const CourseLine = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const CourseHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;

  a,
  strong {
    text-decoration: none;
    font-weight: 700;
  }
`;

const CourseTrack = styled.div`
  width: 100%;
  height: 14px;
  border-radius: 999px;
  background: #eceff5;
  overflow: hidden;
`;

const CourseBar = styled.div`
  height: 100%;
  border-radius: 999px;
`;

const LinkedStudentsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const LinkedStudentCard = styled.div`
  border: 1px solid #e6ebf2;
  border-radius: 22px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
`;

const LinkedStudentTop = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
`;

const LinkedStudentName = styled.h3`
  font-size: 24px;
`;

const LinkedStudentStatGroup = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;

  span {
    padding: 10px 12px;
    border-radius: 999px;
    background: #f3f6fb;
    font-weight: 700;
  }
`;

const LinkedCourseList = styled.div`
  display: grid;
  gap: 12px;
`;

const LinkedCourseCard = styled.div`
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid #edf0f4;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const LinkedMetaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
`;

const LinkedMetaBox = styled.div`
  padding: 12px 14px;
  border-radius: 16px;
  background: #fff;

  span {
    display: block;
    color: var(--muted);
    margin-bottom: 8px;
  }
`;

const SplitGrid = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
`;

const MainColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 22px;
`;

const TabRow = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const TabButton = styled.button`
  border: 1px solid ${(props) => (props.$active ? "#3d82c4" : "#d7dee8")};
  border-radius: 999px;
  padding: 12px 16px;
  background: ${(props) => (props.$active ? "#eef5fb" : "#fff")};
  color: ${(props) => (props.$active ? "#23598d" : "var(--text)")};
  font: inherit;
  font-weight: 800;
  cursor: pointer;
`;

const AchievementsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
`;

const AchievementCard = styled.div`
  border-radius: 20px;
  padding: 16px;
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  gap: 12px;
  background: ${(props) =>
    props.$state === "unlocked"
      ? "#f4fcf8"
      : props.$state === "hidden"
      ? "#f3f4f7"
      : "#f7f8fb"};
  border: 1px solid
    ${(props) =>
      props.$state === "unlocked" ? "#d9efe4" : "rgba(32, 33, 38, 0.08)"};
  opacity: ${(props) => (props.$state === "unlocked" ? 1 : 0.78)};
  filter: ${(props) => (props.$state === "hidden" ? "grayscale(1)" : "none")};
`;

const AchievementAvatar = styled.div`
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: ${(props) =>
    props.$state === "unlocked"
      ? "linear-gradient(135deg, #16a085 0%, #1fc7a6 100%)"
      : "linear-gradient(135deg, #bfc3cf 0%, #969baa 100%)"};
  display: grid;
  place-items: center;
  overflow: hidden;
  color: #fff;
  font-size: 26px;
  font-weight: 800;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const AchievementBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;

  p,
  small {
    color: var(--muted);
    line-height: 1.6;
  }
`;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const CourseAchievementBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const CourseAchievementTitle = styled.h3`
  font-size: 24px;
`;

const EmptyCard = styled.div`
  padding: 16px 18px;
  border-radius: 18px;
  background: #f6f8fb;
  color: var(--muted);
`;

const InfoCard = styled.div`
  padding: 16px 18px;
  border-radius: 16px;
  background: ${(props) => (props.$error ? "#fff0f0" : "#f2f6ff")};
  color: ${(props) => (props.$error ? "#b53d3d" : "#334b7d")};
`;

const MutedText = styled.p`
  color: var(--muted);
  line-height: 1.6;
`;
