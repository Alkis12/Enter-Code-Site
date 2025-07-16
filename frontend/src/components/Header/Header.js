import React from "react";
import styled from "styled-components";
import logo from "../../assets/LoginAssets/logo.png";
import GlobalStyle from "../../styles/GlobalStyle";

const MainHeader = styled.div`
  display: flex;
  justify-content: left;
  align-items: center;
  background-color: #fa7f2f;
  padding: 0px;
`;

const Header = () => {
  return (
    <div>
      <MainHeader>
        <img src={logo} alt="logo" width="100px" />
      </MainHeader>
    </div>
  );
};

export default Header;
