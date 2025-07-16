import React from "react";
import styled from "styled-components";
import logo from "../../assets/LoginAssets/logo.png";
import GlobalStyle from "../../styles/GlobalStyle";
import { NavLink } from "react-router-dom";

const MainHeader = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #fa7f2f;
  padding: 0px;
  width: 100%;
`;
const HeaderMenu = styled.nav`
  display: flex;
  gap: 10vh;
  align-items: center;
  justify-content: center;
`;

const StyledLink = styled(NavLink)`
  text-decoration: none;
  color: white;
  font-weight: bold;
  padding: 8px 16px;
  border-radius: 8px;

  &.active {
    background-color: #fa7f2f;
    color: rgb(255, 255, 255);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    border: 3px solid rgb(255, 255, 255);
  }

  &:hover {
    text-decoration: underline;
  }
`;

const StyledProfileLink = styled(NavLink)`
  text-decoration: none;
  color: white;
  font-weight: bold;
  padding: 8px 16px;
  border-radius: 8px;
  background-color: rgb(255, 255, 255);
  color: #fa7f2f;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);

  &.active {
    background-color: #fa7f2f;
    color: rgb(255, 255, 255);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    border: 3px solid rgb(255, 255, 255);
  }
`;

const Header = () => {
  return (
    <div>
      <MainHeader>
        <img src={logo} alt="logo" width="100px" />
        <HeaderMenu>
          <StyledLink to="/news">News</StyledLink>
          <StyledLink to="/mycourses">My Courses</StyledLink>
          <StyledLink to="/myschedule">My Schedule</StyledLink>
          <StyledProfileLink to="/profile">Profile</StyledProfileLink>
        </HeaderMenu>
      </MainHeader>
    </div>
  );
};

export default Header;
