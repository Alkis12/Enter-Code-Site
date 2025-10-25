import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { useTranslation } from "react-i18next";
import { getMyInfo } from "../../api/profile_info";

const SettingsWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: left;
  margin: 5vh 0 0 0;
  padding: 0;
  justify-self: left;
  justify-content: left;
`;

const Input = styled.input`
  width: 300px;
  padding: 12px 16px;
  margin-bottom: 16px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 16px;

  &:focus {
    outline: none;
    border-color: grey;
  }
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const FlexRow = styled.div`
  display: flex;
  gap: 40px;
  width: 100%;
  max-width: 900px;
  align-items: flex-end;
`;

const Label = styled.label`
  font-size: 18px;
  margin-bottom: 6px;
`;

const ConfirmButton = styled.button`
  align-self: flex-end;
  width: 100%;
  padding: 12px 16px;
  margin-bottom: 16px;
  background-color: rgb(33, 154, 135);
  color: white;
  font-size: 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    background-color: rgb(27, 127, 112);
  }
`;

const Settings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getMyInfo();
        if (!alive) return;
        setInfo(data);
      } catch (err) {
        if (String(err.message).includes("401")) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          navigate("/login", { replace: true });
          return;
        }
        setError(err.message || "Произошла ошибка");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [navigate]);

  if (loading) return <div>Загрузка…</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (!info) return null;

  const phoneNumber = info.phone;
  const tgUsername = info.tg_username;

  return (
    <SettingsWrapper>
      <h1>{t("Profile.settings")}</h1>
      <FlexRow>
        <FieldGroup>
          <Label>{t("Profile.phonenumber")}</Label>
          <Input type="text" placeholder={phoneNumber} />
        </FieldGroup>
        <FieldGroup>
          <Label>{t("Profile.tg")}</Label>
          <Input type="text" placeholder={tgUsername} />
        </FieldGroup>
        <FieldGroup>
          <ConfirmButton
            type="submit"
            onClick={() => {
              alert("Saved (заглушка)");
            }}
          >
            {t("Profile.save")}
          </ConfirmButton>
        </FieldGroup>
      </FlexRow>
    </SettingsWrapper>
  );
};
export default Settings;
