import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Link, Navigate, useLocation } from "react-router-dom";

import Header from "../components/Header/Header";
import { clearSession, isAuthenticated, logout } from "../api/auth";
import { getDashboard } from "../api/account";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8002";

function formatDateTime(value) {
  if (!value) {
    return "Без даты";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

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
  return "Ученик";
}

function ProfilePage() {
  const location = useLocation();
  const authed = isAuthenticated();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shouldRedirectToLogin, setShouldRedirectToLogin] = useState(false);
  const [achievementCourseFilter, setAchievementCourseFilter] = useState("all");
  const [achievementStateFilter, setAchievementStateFilter] = useState("all");
  const [achievementsAnchor, setAchievementsAnchor] = useState(null);

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

    loadDashboard();
  }, []);

  useEffect(() => {
    if (location.hash === "#achievements" && achievementsAnchor) {
      achievementsAnchor.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash, achievementsAnchor]);

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

  if (!dashboard) {
    return null;
  }

  const {
    user,
    courses,
    achievements,
    pending_reviews,
    course_requests = [],
  } =
    dashboard;
  const isStudent = user.user_type === "student";
  const isTeacher = user.user_type === "teacher";
  const isAdmin = user.user_type === "admin";
  const unlockedAchievements = achievements.filter(
    (achievement) => achievement.state === "unlocked"
  ).length;
  const achievementCourseOptions = courses.filter((course) =>
    achievements.some((achievement) => achievement.course_id === course.id)
  );
  const filteredAchievements = achievements.filter((achievement) => {
    if (achievementCourseFilter === "common" && achievement.course_id) {
      return false;
    }

    if (
      achievementCourseFilter !== "all" &&
      achievementCourseFilter !== "common" &&
      achievement.course_id !== achievementCourseFilter
    ) {
      return false;
    }

    if (
      achievementStateFilter !== "all" &&
      achievement.state !== achievementStateFilter
    ) {
      return false;
    }

    return true;
  });

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
                <PrimaryLink to="/profile/edit">Изменить профиль</PrimaryLink>
                <SecondaryLink to="/profile/security">
                  Сменить пароль
                </SecondaryLink>
              </ActionRow>
            </HeroTop>

            <SummaryGrid>
              <SummaryBox>
                <span>Логин</span>
                <strong>@{user.tg_username}</strong>
              </SummaryBox>
              <SummaryBox>
                <span>Баллы</span>
                <strong>{user.points}</strong>
              </SummaryBox>
              {!isAdmin && (
                <SummaryBox>
                  <span>Достижения</span>
                  <strong>{unlockedAchievements}</strong>
                </SummaryBox>
              )}
              <SummaryBox>
                <span>Курсы</span>
                <strong>{courses.length}</strong>
              </SummaryBox>
              {isStudent && (
                <>
                  <SummaryBox>
                    <span>Абонемент</span>
                    <strong>{user.subscription_status || "не указан"}</strong>
                  </SummaryBox>
                  <SummaryBox>
                    <span>Остаток занятий</span>
                    <strong>{user.lessons_remaining ?? "не указан"}</strong>
                  </SummaryBox>
                </>
              )}
            </SummaryGrid>

            <CoursesSection>
              <SectionMiniTitle>Подключенные курсы</SectionMiniTitle>
              <CourseList>
                {courses.length === 0 && (
                  <MutedText>Пока нет подключенных курсов.</MutedText>
                )}
                {courses.map((course) => (
                  <CourseLine key={course.id}>
                    <CourseHeader>
                      <Link to={`/mycourses/${course.id}`}>{course.name}</Link>
                      <span>
                        {course.earned_points}/{course.total_points} баллов
                      </span>
                    </CourseHeader>
                    <CourseTrack>
                      <CourseBar
                        style={{
                          width: `${Math.min(100, course.progress_percent)}%`,
                          background: course.accent_color,
                        }}
                      />
                    </CourseTrack>
                  </CourseLine>
                ))}
              </CourseList>
            </CoursesSection>
          </HeroBody>
        </HeroCard>

        <SplitGrid>
          <MainColumn>
            {(isTeacher || isAdmin) && (
              <SectionCard>
                <SectionHeader>
                  <SectionTitle>Заявки на курсы</SectionTitle>
                  <CountBadge>{course_requests.length}</CountBadge>
                </SectionHeader>
                {course_requests.length === 0 ? (
                  <EmptyCard>Новых заявок пока нет.</EmptyCard>
                ) : (
                  <Stack>
                    {course_requests.map((request) => (
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
            )}

            {!isAdmin && (
              <SectionCard>
                <SectionHeader>
                  <SectionTitle>Достижения</SectionTitle>
                  <FiltersRow>
                    <Select
                      value={achievementCourseFilter}
                      onChange={(event) =>
                        setAchievementCourseFilter(event.target.value)
                      }
                    >
                      <option value="all">Все достижения</option>
                      <option value="common">Общие достижения</option>
                      {achievementCourseOptions.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={achievementStateFilter}
                      onChange={(event) =>
                        setAchievementStateFilter(event.target.value)
                      }
                    >
                      <option value="all">Любой статус</option>
                      <option value="unlocked">Открытые</option>
                      <option value="locked">Не выполнены</option>
                      <option value="hidden">Скрытые</option>
                    </Select>
                  </FiltersRow>
                </SectionHeader>

                {filteredAchievements.length === 0 && (
                  <MutedText>
                    Под выбранный фильтр пока ничего не найдено.
                  </MutedText>
                )}

                <AchievementsGrid ref={setAchievementsAnchor} id="achievements">
                  {filteredAchievements.map((achievement) => (
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
                            ? "Условие пока не раскрывается."
                            : achievement.description}
                        </p>
                        {achievement.unlocked_at && (
                          <small>
                            Открыто: {formatDateTime(achievement.unlocked_at)}
                          </small>
                        )}
                      </AchievementBody>
                    </AchievementCard>
                  ))}
                </AchievementsGrid>
              </SectionCard>
            )}
          </MainColumn>

          <SideColumn>
            {(isTeacher || isAdmin) && (
              <SectionCard>
                <SectionHeader>
                  <SectionTitle>Управление занятиями</SectionTitle>
                  <CountBadge>{pending_reviews.length}</CountBadge>
                </SectionHeader>
                <MutedText>
                  Посещаемость по датам, ручная проверка и заявки на курсы вынесены в
                  отдельный раздел.
                </MutedText>
                <PrimaryLink to="/teaching">Открыть раздел</PrimaryLink>
              </SectionCard>
            )}

            <SectionCard>
              <SectionTitle>Аккаунт</SectionTitle>
              <DangerAction
                type="button"
                onClick={async () => {
                  await logout();
                  window.location.href = "/login";
                }}
              >
                Выйти
              </DangerAction>
            </SectionCard>
          </SideColumn>
        </SplitGrid>
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

const SecondaryLink = styled(Link)`
  text-decoration: none;
  border-radius: 12px;
  border: 1px solid #d7dbe4;
  background: #fff;
  color: var(--text);
  padding: 14px 18px;
  font-weight: 700;
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

const CoursesSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SectionMiniTitle = styled.h2`
  font-size: 28px;
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

  a {
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

const SplitGrid = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 24px;

  @media (max-width: 1120px) {
    grid-template-columns: 1fr;
  }
`;

const MainColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 22px;
`;

const SideColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 22px;
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

const FiltersRow = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const Select = styled.select`
  border: 1px solid #d7dbe4;
  border-radius: 12px;
  padding: 12px 14px;
  background: #fff;
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

const CountBadge = styled.div`
  min-width: 42px;
  height: 42px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #eef5ff;
  color: #315fa8;
  font-weight: 800;
`;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const EmptyCard = styled.div`
  padding: 16px 18px;
  border-radius: 18px;
  background: #f6f8fb;
  color: var(--muted);
`;

const QueueItem = styled.article`
  padding: 16px;
  border-radius: 18px;
  background: #f8fafd;
  border: 1px solid #e6ebf2;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const QueueMeta = styled.div`
  color: var(--muted);
  line-height: 1.6;
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
