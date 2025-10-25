import React from "react";
import Header from "../components/Header/Header";
import { useMyGroups } from "../hooks/useMyGroups";
import CourseWidget from "../components/MyCoursesComp/CourseWidget";

function MyCourses() {
  const { groups, loading, error } = useMyGroups();
  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;

  return (
    <div>
      <Header />
      <CourseWidget {...groups} />
    </div>
  );
}

export default MyCourses;
