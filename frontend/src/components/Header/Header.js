import React, { useState } from "react";
import styled from "styled-components";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

import logo from "../../assets/LoginAssets/logo.png";
import { getCurrentUserType, isAuthenticated } from "../../api/auth";

function Header() {
  const { i18n } = useTranslation();
  const authed = isAuthenticated();
  const userType = getCurrentUserType();
  const canOpenLearning = authed && ["student", "teacher", "admin"].includes(userType);
  const canManageStudents = userType === "teacher" || userType === "admin";
  const canManageAchievements = userType === "teacher" || userType === "admin";
  const canManageTeaching = userType === "teacher" || userType === "admin";
  const showManagementPanel = canManageStudents || canManageAchievements || canManageTeaching;
  const currentLanguage = i18n.language?.startsWith("en") ? "en" : "ru";
  const [showMenu, setShowMenu] = useState(false);

  return (
    <Bar>
      <Inner>
        <LogoWrap to="/">
          <img src={logo} alt="Enter Code" />
        </LogoWrap>

        <Nav>
          <NavItem to="/news">Новости</NavItem>
          {canOpenLearning && <NavItem to="/myschedule">Мое расписание</NavItem>}
          {canOpenLearning && <NavItem to="/mycourses">Мои курсы</NavItem>}
        </Nav>

        <RightSide>
          {authed && showManagementPanel && (
            <ManagementWrap>
              <ManagementButton
                type="button"
                onClick={() => setShowMenu((prev) => !prev)}
                aria-label="Панель управления"
              >
                <MenuLines>
                  <span />
                  <span />
                  <span />
                </MenuLines>
              </ManagementButton>
              {showMenu && (
                <ManagementPanel>
                  {canManageStudents && (
                    <ManagementLink to="/students" onClick={() => setShowMenu(false)}>
                      Ученики
                    </ManagementLink>
                  )}
                  {canManageTeaching && (
                    <ManagementLink to="/teaching" onClick={() => setShowMenu(false)}>
                      Занятия
                    </ManagementLink>
                  )}
                  {canManageAchievements && (
                    <ManagementLink
                      to={userType === "admin" ? "/achievements/overview" : "/achievements/manage"}
                      onClick={() => setShowMenu(false)}
                    >
                      Достижения
                    </ManagementLink>
                  )}
                  <ManagementLink to="/profile/edit" onClick={() => setShowMenu(false)}>
                    Редактор аккаунтов
                  </ManagementLink>
                </ManagementPanel>
              )}
            </ManagementWrap>
          )}
          <LangSwitcher>
            <LangButton
              type="button"
              $active={currentLanguage === "ru"}
              onClick={() => i18n.changeLanguage("ru")}
            >
              RU
            </LangButton>
            <LangButton
              type="button"
              $active={currentLanguage === "en"}
              onClick={() => i18n.changeLanguage("en")}
            >
              EN
            </LangButton>
          </LangSwitcher>
          {authed ? (
            <ProfileItem to="/profile">Мой профиль</ProfileItem>
          ) : (
            <ProfileItem to="/login">Войти</ProfileItem>
          )}
        </RightSide>
      </Inner>
    </Bar>
  );
}

export default Header;

const Bar = styled.header`
  position: sticky;
  top: 0;
  z-index: 40;
  background: #ff7f2a;
  box-shadow: 0 10px 24px rgba(255, 127, 42, 0.24);
`;

const Inner = styled.div`
  max-width: 1240px;
  margin: 0 auto;
  padding: 12px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;

  @media (max-width: 900px) {
    flex-wrap: wrap;
  }
`;

const LogoWrap = styled(NavLink)`
  display: inline-flex;
  align-items: center;

  img {
    width: 92px;
    height: auto;
  }
`;

const Nav = styled.nav`
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
  flex: 1;
`;

const BaseItem = styled(NavLink)`
  color: #fffaf5;
  text-decoration: none;
  font-size: 15px;
  font-weight: 700;
  padding: 10px 14px;
  border-radius: 14px;
  border: 2px solid transparent;
  transition: background 0.2s ease, transform 0.2s ease;

  &.active {
    background: rgba(255, 255, 255, 0.18);
    border-color: #fff7ef;
  }

  &:hover {
    transform: translateY(-1px);
  }
`;

const NavItem = styled(BaseItem)``;

const ProfileItem = styled(BaseItem)`
  background: #fff8f1;
  color: #ff7f2a;

  &.active {
    background: #fff8f1;
    color: #ff7f2a;
    border-color: #ffd5b3;
  }
`;

const RightSide = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  position: relative;
`;

const ManagementWrap = styled.div`
  position: relative;
`;

const ManagementButton = styled.button`
  border: none;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.18);
  color: #fffaf5;
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  cursor: pointer;
`;

const MenuLines = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;

  span {
    width: 18px;
    height: 2px;
    border-radius: 999px;
    background: currentColor;
    display: block;
  }
`;

const ManagementPanel = styled.div`
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  min-width: 240px;
  padding: 10px;
  border-radius: 18px;
  background: #fff8f1;
  border: 1px solid #ffd5b3;
  box-shadow: 0 20px 32px rgba(25, 32, 48, 0.18);
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 30;
`;

const ManagementLink = styled(NavLink)`
  text-decoration: none;
  padding: 12px 14px;
  border-radius: 12px;
  color: #33251b;
  font-weight: 700;

  &.active,
  &:hover {
    background: rgba(255, 127, 42, 0.12);
  }
`;

const LangSwitcher = styled.div`
  display: flex;
  gap: 6px;
  padding: 4px;
  border-radius: 14px;
  background: rgba(255, 248, 241, 0.9);
`;

const LangButton = styled.button`
  min-width: 48px;
  padding: 8px 10px;
  border: none;
  border-radius: 10px;
  background: ${(props) => (props.$active ? "#ff7f2a" : "transparent")};
  color: ${(props) => (props.$active ? "#fffaf5" : "#ff7f2a")};
  text-align: center;
  font-weight: 800;
  cursor: pointer;
`;
