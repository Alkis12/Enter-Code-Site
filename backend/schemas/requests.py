from typing import Dict, List, Optional

from pydantic import BaseModel, Field
from pydantic import field_validator

from models.achievement import AchievementTrigger
from models.event import EventTag, ScheduleType
from models.group import GroupScheduleSlot
from models.programming_language import ProgrammingLanguage, normalize_programming_language
from models.student_course_enrollment import PaymentMode
from models.user import UserType


class LoginRequest(BaseModel):
    tg_username: str = Field(..., min_length=2, max_length=33)
    password: str = Field(..., min_length=6)


class RegisterRequest(BaseModel):
    tg_username: str = Field(..., min_length=2, max_length=33)
    telegram_id: Optional[str] = Field(default=None, max_length=100)
    password: str = Field(..., min_length=6)
    password_repeat: str = Field(..., min_length=6)
    name: str = Field(..., min_length=1, max_length=100)
    surname: str = Field(..., min_length=1, max_length=100)
    user_type: UserType = Field(default=UserType.STUDENT)
    phone: Optional[str] = Field(default=None, max_length=20)
    avatar_url: Optional[str] = Field(default=None)
    bio: Optional[str] = Field(default=None, max_length=500)


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=6)
    new_password: str = Field(..., min_length=6)


class UpdateUserRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    surname: Optional[str] = Field(default=None, min_length=1, max_length=100)
    tg_username: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=33,
        pattern=r"^[a-zA-Z0-9_]{1,50}$",
    )
    telegram_id: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    avatar_url: Optional[str] = Field(default=None)
    bio: Optional[str] = Field(default=None, max_length=500)


class CreateCourseRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    public_info: str = Field(default="", max_length=12000)
    accent_color: str = Field(default="#16a085", max_length=20)
    cover_image: str = Field(default="")
    programming_language: str = Field(default=ProgrammingLanguage.PYTHON.value, max_length=20)
    schedule_weekdays: List[int] = Field(default_factory=list)
    schedule_start_time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    schedule_end_time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    student_ids: List[str] = Field(default_factory=list)
    teacher_ids: List[str] = Field(default_factory=list)

    @field_validator("programming_language")
    @classmethod
    def normalize_programming_language_field(cls, value: str) -> str:
        return normalize_programming_language(value).value


class UpdateCourseRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    public_info: Optional[str] = Field(default=None, max_length=12000)
    accent_color: Optional[str] = Field(default=None, max_length=20)
    cover_image: Optional[str] = Field(default=None)
    programming_language: Optional[str] = Field(default=None, max_length=20)
    schedule_weekdays: Optional[List[int]] = None
    schedule_start_time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    schedule_end_time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")

    @field_validator("programming_language")
    @classmethod
    def normalize_optional_programming_language_field(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return normalize_programming_language(value).value


class SetCourseMembersRequest(BaseModel):
    student_ids: List[str] = Field(default_factory=list)
    teacher_ids: List[str] = Field(default_factory=list)


class CreateGroupRequest(BaseModel):
    course_id: str
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)


class UpdateGroupRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)


class AddStudentsToGroupRequest(BaseModel):
    student_usernames: List[str] = Field(default_factory=list)


class AddTeachersToGroupRequest(BaseModel):
    teacher_usernames: List[str] = Field(default_factory=list)


class CreateTopicRequest(BaseModel):
    course_id: str
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    content: str = Field(default="", max_length=30000)
    resources: List[str] = Field(default_factory=list)
    order: int = Field(default=0, ge=0)


class UpdateTopicRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    content: Optional[str] = Field(default=None, max_length=30000)
    resources: Optional[List[str]] = None
    order: Optional[int] = Field(default=None, ge=0)
    is_open: Optional[bool] = None


class TaskTestCaseRequest(BaseModel):
    input_data: str = Field(default="")
    expected_output: str = Field(default="")
    is_public: bool = Field(default=True)


class CreateTaskRequest(BaseModel):
    topic_id: str
    title: str = Field(..., min_length=1, max_length=200)
    condition: str = Field(..., min_length=1)
    attachments: List[str] = Field(default_factory=list)
    points: int = Field(default=10, ge=0)
    starter_code: str = Field(default="")
    language: str = Field(default=ProgrammingLanguage.PYTHON.value, max_length=20)
    requires_manual_review: bool = Field(default=False)
    tests: List[TaskTestCaseRequest] = Field(default_factory=list)
    order: int = Field(default=0, ge=0)

    @field_validator("language")
    @classmethod
    def normalize_language_field(cls, value: str) -> str:
        return normalize_programming_language(value).value


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    condition: Optional[str] = Field(default=None, min_length=1)
    attachments: Optional[List[str]] = None
    points: Optional[int] = Field(default=None, ge=0)
    starter_code: Optional[str] = None
    language: Optional[str] = Field(default=None, max_length=20)
    requires_manual_review: Optional[bool] = None
    tests: Optional[List[TaskTestCaseRequest]] = None
    order: Optional[int] = Field(default=None, ge=0)

    @field_validator("language")
    @classmethod
    def normalize_optional_language_field(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return normalize_programming_language(value).value


class SubmitTaskSolutionRequest(BaseModel):
    code: str = Field(..., min_length=1)


class RunTaskCodeRequest(BaseModel):
    code: str = Field(..., min_length=1)
    input_data: str = Field(default="")


class ReviewTaskSubmissionRequest(BaseModel):
    approve: bool
    comment: Optional[str] = Field(default=None, max_length=1000)


class ExtendSubscriptionRequest(BaseModel):
    tg_username: str
    lessons_count: int = Field(..., ge=1)


class CreateEventRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    schedule_type: ScheduleType = Field(default=ScheduleType.WEEKLY)
    date: Optional[str] = Field(default=None, description="YYYY-MM-DD")
    weekday: Optional[int] = Field(default=None, ge=0, le=6)
    start_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    end_time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    image_url: Optional[str] = Field(default=None, max_length=500)
    button_color: Optional[str] = Field(default=None, max_length=20)
    card_color: Optional[str] = Field(default=None, max_length=20)
    text_color: Optional[str] = Field(default=None, max_length=20)
    tags: List[EventTag] = Field(default_factory=list)
    is_active: bool = Field(default=True)


class UpdateEventRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    schedule_type: Optional[ScheduleType] = None
    date: Optional[str] = Field(default=None, description="YYYY-MM-DD")
    weekday: Optional[int] = Field(default=None, ge=0, le=6)
    start_time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    end_time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    image_url: Optional[str] = Field(default=None, max_length=500)
    button_color: Optional[str] = Field(default=None, max_length=20)
    card_color: Optional[str] = Field(default=None, max_length=20)
    text_color: Optional[str] = Field(default=None, max_length=20)
    tags: Optional[List[EventTag]] = None
    is_active: Optional[bool] = None


class AdminCreateStudentRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    surname: str = Field(..., min_length=1, max_length=100)
    tg_username: str = Field(..., min_length=2, max_length=33)
    telegram_id: Optional[str] = Field(default=None, max_length=100)
    password: str = Field(..., min_length=6)
    phone: Optional[str] = Field(default=None, max_length=20)
    course_ids: List[str] = Field(default_factory=list)
    course_group_ids: Dict[str, str] = Field(default_factory=dict)


class AdminUpdateStudentRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    surname: Optional[str] = Field(default=None, min_length=1, max_length=100)
    tg_username: Optional[str] = Field(default=None, min_length=2, max_length=33)
    telegram_id: Optional[str] = Field(default=None, max_length=100)
    password: Optional[str] = Field(default=None, min_length=6)
    phone: Optional[str] = Field(default=None, max_length=20)
    status: Optional[str] = None
    course_ids: Optional[List[str]] = None
    course_group_ids: Optional[Dict[str, str]] = None


class LinkParentRequest(BaseModel):
    tg_username: str = Field(..., min_length=2, max_length=33)
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    surname: Optional[str] = Field(default=None, min_length=1, max_length=100)
    telegram_id: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    password: Optional[str] = Field(default=None, min_length=6)


class CreateCourseGroupRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    student_ids: List[str] = Field(default_factory=list)
    schedule_slots: List[GroupScheduleSlot] = Field(default_factory=list)
    start_date: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    current_topic_id: Optional[str] = None


class UpdateCourseGroupRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    student_ids: Optional[List[str]] = None
    schedule_slots: Optional[List[GroupScheduleSlot]] = None
    start_date: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    current_topic_id: Optional[str] = None


class CreateCourseRequestLeadRequest(BaseModel):
    contact_name: Optional[str] = Field(default=None, max_length=120)
    contact_value: str = Field(..., min_length=3, max_length=300)
    comment: Optional[str] = Field(default=None, max_length=2000)


class CreateNewsArticleRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    intro: str = Field(default="", max_length=300)
    preview: str = Field(default="", max_length=500)
    body: List[str] = Field(default_factory=list)
    slug: Optional[str] = Field(default=None, max_length=200)
    is_published: bool = True


class UpdateNewsArticleRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    intro: Optional[str] = Field(default=None, max_length=300)
    preview: Optional[str] = Field(default=None, max_length=500)
    body: Optional[List[str]] = None
    slug: Optional[str] = Field(default=None, max_length=200)
    is_published: Optional[bool] = None


class UpdateAchievementRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=150)
    description: Optional[str] = Field(default=None, max_length=500)
    avatar_url: Optional[str] = Field(default=None, max_length=500)
    is_hidden: Optional[bool] = None


class AttendanceEntryRequest(BaseModel):
    student_id: str
    present: bool = False
    paid: bool = False
    note: str = Field(default="", max_length=500)


class SaveAttendanceSessionRequest(BaseModel):
    entries: List[AttendanceEntryRequest] = Field(default_factory=list)
    comment: str = Field(default="", max_length=2000)
    date: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    start_time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    end_time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    is_cancelled: bool = False


class UpdateStudentCoursePaymentModeRequest(BaseModel):
    payment_mode: PaymentMode


class AddSubscriptionPaymentRequest(BaseModel):
    month: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    note: str = Field(default="", max_length=500)


class AddLessonPrepaymentRequest(BaseModel):
    lessons_count: int = Field(..., ge=1, le=100)
    note: str = Field(default="", max_length=500)
