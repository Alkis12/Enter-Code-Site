import React from "react";
import styled from "styled-components";
import logo from "../../assets/LoginAssets/logo.png";

const Header = styled.div`
  display: flex;
  justify-content: left;
  align-items: center;
  background-color: #fa7f2f;
  padding: 0px;
`;

const LoginHeader = () => {
  return (
    <div>
      <Header>
        <img src={logo} alt="logo" width="100px" />
      </Header>
    </div>
  );
};

export default LoginHeader;
