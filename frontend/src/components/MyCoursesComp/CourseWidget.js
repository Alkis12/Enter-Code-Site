import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const CourseWidget = ({ groups = [] }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleGroupClick = (groupId) => {
    navigate(`/group/${groupId}`);
  };

  if (!Array.isArray(groups) || groups.length === 0) {
    return <StyledMessage>{t("No groups available")}</StyledMessage>;
  }

  return (
    <div>
      {groups.map((group) => (
        <StyledCourseWidget key={group.id}>
          <StyledTitle>{group.name || t("Unnamed Group")}</StyledTitle>
          <StyledDescription>
            {group.description || t("No description")}
          </StyledDescription>

          {Array.isArray(group.subgroups) && group.subgroups.length > 0 && (
            <StyledGroupsList>
              {group.subgroups.map((sub) => (
                <li key={sub.id}>
                  <StyledGroupLink onClick={() => handleGroupClick(sub.id)}>
                    <StyledGroupName>{sub.name}</StyledGroupName>
                  </StyledGroupLink>
                </li>
              ))}
            </StyledGroupsList>
          )}
        </StyledCourseWidget>
      ))}
    </div>
  );
};

export default CourseWidget;

const StyledCourseWidget = styled.div`
  border: 1px solid #ccc;
  border-radius: 5px;
  padding: 10px;
  margin: 20px;
`;

const StyledTitle = styled.h2`
  font-size: 18px;
  margin-bottom: 5px;
`;

const StyledDescription = styled.p`
  font-size: 14px;
  margin-bottom: 5px;
`;

const StyledGroupsList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  li {
    margin-bottom: 5px;
  }
`;

const StyledGroupLink = styled.a`
  text-decoration: none;
  color: #0077cc;
  cursor: pointer;
`;

const StyledGroupName = styled.span`
  font-weight: bold;
`;

const StyledMessage = styled.p`
  color: #666;
  font-style: italic;
  text-align: center;
`;
