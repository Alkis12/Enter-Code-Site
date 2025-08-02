import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";

const languages = [
  { code: "ru", emoji: "🇷🇺" },
  { code: "en", emoji: "🇬🇧" },
  { code: "rs", emoji: "🇷🇸" },
];

const Wrapper = styled.div`
  position: relative;
  display: inline-block;
`;

const LanguageButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 16px;
  border: ${({ $active }) => ($active ? "2px solid #fff" : "1px solid #ccc")};
  border-radius: 6px;
  background: ${({ $active }) => ($active ? "#ff914d" : "transparent")};
  color: ${({ $active }) => ($active ? "#fff" : "#333")};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: scale(1.05);
  }
`;

const DropdownList = styled.div`
  position: absolute;
  top: 110%;
  right: 0;
  background: white;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
  padding: 4px 0;
  z-index: 100;
`;

const DropdownItem = styled(LanguageButton)`
  width: 100%;
  justify-content: flex-start;
  border: none;
  background: transparent;

  &:hover {
    background: #ffe0cc;
  }
`;

const LanguageSwitchBtn = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const currentLang = languages.find((lang) => lang.code === i18n.language);

  const handleChangeLanguage = (code) => {
    i18n.changeLanguage(code);
    setIsOpen(false);
  };

  return (
    <Wrapper>
      <LanguageButton
        onClick={() => setIsOpen((prev) => !prev)}
        $active={true}
        title={currentLang.code.toUpperCase()}
      >
        <span>{currentLang.emoji}</span>
        <span>{currentLang.code.toUpperCase()}</span>
      </LanguageButton>

      {isOpen && (
        <DropdownList>
          {languages
            .filter(({ code }) => code !== i18n.language)
            .map(({ code, emoji }) => (
              <DropdownItem
                key={code}
                onClick={() => handleChangeLanguage(code)}
                title={code.toUpperCase()}
              >
                <span>{emoji}</span>
                <span>{code.toUpperCase()}</span>
              </DropdownItem>
            ))}
        </DropdownList>
      )}
    </Wrapper>
  );
};

export default LanguageSwitchBtn;
