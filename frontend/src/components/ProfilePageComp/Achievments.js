import React, { useState } from "react";
import styled from "styled-components";
import { useTranslation } from "react-i18next";
import GlobalStyle from "../../styles/GlobalStyle";

const AchievmentsWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: left;
  margin: 5vh 0 0 0;
  padding: 0;
  position: relative;
`;

const AchievmentsButton = styled.button`
  width: 100%;
  height: 70px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 16px;
  border: 1px solid rgb(197, 197, 197);
  border-radius: 3px;
  cursor: pointer;
  color: rgb(0, 0, 0);
  background: rgb(245, 245, 245);
`;

const DropdownList = styled.div`
  width: 100%;
  position: absolute;
  top: 110%;
  right: 0;
  background: rgb(245, 245, 245);
  border: 1px solid #ccc;
  border-radius: 6px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
  padding: 4px 0;
  z-index: 100;
`;

const DropdownItem = styled(AchievmentsButton)`
  width: 100%;
  justify-content: flex-start;
  border: none;
  background: transparent;

  &:hover {
    background: #ffe0cc;
  }
`;
const Achievments = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropAchievments = () => {
    setIsOpen(false);
  };

  return (
    <AchievmentsWrapper>
      <h1>{t("Profile.achievements")}</h1>
      <AchievmentsButton onClick={() => setIsOpen((prev) => !prev)}>
        Course 1 achievments{" "}
      </AchievmentsButton>
      {isOpen && (
        <DropdownList>
          <DropdownItem onClick={() => dropAchievments()}>
            <span>Some dropdown text</span>
          </DropdownItem>
        </DropdownList>
      )}
    </AchievmentsWrapper>
  );
};

export default Achievments;
