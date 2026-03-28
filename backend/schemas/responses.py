from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from models.achievement import AchievementTrigger
from models.event import EventTag, ScheduleType
from models.group import GroupScheduleSlot
from models.student_course_enrollment import PaymentMode
from models.task import TaskStatus
from models.user import SubscriptionStatus, UserStatus, UserType


class MessageResponse(BaseModel):
    message: str
    success: bool = True


class UserResponse(BaseModel):
    user_id: str
    name: str
    surname: str
    tg_username: str
    telegram_id: Optional[str] = None
    user_type: UserType
    status: UserStatus
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    subscription_status: Optional[SubscriptionStatus] = None
    lessons_remaining: Optional[int] = None
    points: int = 0

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    user_id: str
    user_type: UserType
    newly_unlocked_achievements: List["AchievementNoticeResponse"] = Field(default_factory=list)


class RegisterResponse(BaseModel):
    message: str
    success: bool
    access_token: str
    refresh_token: str
    user_id: str
    user_type: UserType
    newly_unlocked_achievements: List["AchievementNoticeResponse"] = Field(default_factory=list)


class GroupOptionResponse(BaseModel):
    id: str
    name: str


class CourseOptionResponse(BaseModel):
    id: str
    name: str
    groups: List[GroupOptionResponse] = Field(default_factory=list)


class LeaderboardEntryResponse(BaseModel):
    user_id: str
    name: str
    surname: str
    tg_username: str
    points: int
    progress_percent: float


class CourseResponse(BaseModel):
    id: str
    name: str
    description: str
    public_info: str = ""
    accent_color: str = "#16a085"
    cover_image: str = ""
    programming_language: str = "python"
    group_ids: List[str] = Field(default_factory=list)
    topic_ids: List[str] = Field(default_factory=list)
    teacher_ids: List[str] = Field(default_factory=list)
    student_ids: List[str] = Field(default_factory=list)
    schedule_weekdays: List[int] = Field(default_factory=list)
    schedule_start_time: Optional[str] = None
    schedule_end_time: Optional[str] = None
    schedule_summary: str = ""
    active_group_id: Optional[str] = None
    active_group_name: Optional[str] = None
    active_group_schedule_summary: str = ""
    total_tasks: int = 0
    total_students: int = 0
    total_points: int = 0
    progress_percent: float = 0.0
    earned_points: int = 0
    can_edit: bool = False
    finance: Optional["StudentCourseFinanceResponse"] = None


class GroupResponse(BaseModel):
    id: str
    course_id: str
    name: str
    students: List[str] = Field(default_factory=list)
    teachers: List[str] = Field(default_factory=list)
    schedule_slots: List[GroupScheduleSlot] = Field(default_factory=list)
    schedule_summary: str = ""
    start_date: Optional[str] = None
    current_topic_id: Optional[str] = None
    current_topic_name: Optional[str] = None
    leaderboard: List[LeaderboardEntryResponse] = Field(default_factory=list)
    total_students: int = 0


class CourseMemberResponse(BaseModel):
    user_id: str
    name: str
    surname: str
    tg_username: str
    avatar_url: Optional[str] = None


class LinkedParentResponse(BaseModel):
    user_id: str
    name: str
    surname: str
    tg_username: str
    telegram_id: Optional[str] = None
    phone: Optional[str] = None


class TopicResponse(BaseModel):
    id: str
    course_id: str
    name: str
    description: str
    content: str = ""
    resources: List[str] = Field(default_factory=list)
    task_ids: List[str] = Field(default_factory=list)
    total_tasks: int = 0
    total_points: int = 0
    progress_percent: float = 0.0
    earned_points: int = 0
    order: int = 0
    is_open: bool = False
    has_manual_review_tasks: bool = False
    can_access: bool = False
    can_edit: bool = False


class TaskTestCaseResponse(BaseModel):
    input_data: str = ""
    expected_output: str = ""
    is_public: bool = True


class TaskTestRunResultResponse(BaseModel):
    input_data: str = ""
    expected_output: str = ""
    actual_output: str = ""
    stderr: str = ""
    passed: bool = False
    is_public: bool = True


class TaskSubmissionResponse(BaseModel):
    code: str
    passed: bool
    passed_tests: int
    total_tests: int
    stdout: str = ""
    stderr: str = ""
    test_results: List[TaskTestRunResultResponse] = Field(default_factory=list)
    waiting_manual_review: bool = False
    review_comment: Optional[str] = None
    created_at: datetime


class TaskCodeRunResponse(BaseModel):
    input_data: str = ""
    stdout: str = ""
    stderr: str = ""
    success: bool = False
    exit_code: int = 0
    timed_out: bool = False


class TaskResultResponse(BaseModel):
    user_id: str
    score: int
    status: TaskStatus
    attempts: int = 0
    solved_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    review_comment: Optional[str] = None
    last_submission: Optional[TaskSubmissionResponse] = None
    best_submission: Optional[TaskSubmissionResponse] = None
    submission_history: List[TaskSubmissionResponse] = Field(default_factory=list)


class PendingTaskReviewResponse(BaseModel):
    user_id: str
    name: str
    surname: str
    tg_username: str
    attempts: int = 0
    review_comment: Optional[str] = None
    last_submission: Optional[TaskSubmissionResponse] = None


class DashboardPendingReviewResponse(BaseModel):
    course_id: str
    course_name: str
    lesson_id: str
    lesson_name: str
    task_id: str
    task_title: str
    student_user_id: str
    student_name: str
    student_surname: str
    student_tg_username: str
    attempts: int = 0
    review_comment: Optional[str] = None
    last_submission: Optional[TaskSubmissionResponse] = None


class TaskResponse(BaseModel):
    id: str
    topic_id: str
    title: str
    condition: str
    attachments: List[str] = Field(default_factory=list)
    points: int = 0
    starter_code: str = ""
    language: str = "python"
    requires_manual_review: bool = False
    public_examples: List[TaskTestCaseResponse] = Field(default_factory=list)
    tests: Optional[List[TaskTestCaseResponse]] = None
    order: int = 0
    result: Optional[TaskResultResponse] = None
    pending_reviews: List[PendingTaskReviewResponse] = Field(default_factory=list)
    newly_unlocked_achievements: List["AchievementNoticeResponse"] = Field(default_factory=list)


class LessonDetailResponse(BaseModel):
    course: CourseResponse
    lesson: TopicResponse
    course_lessons: List[TopicResponse] = Field(default_factory=list)
    tasks: List[TaskResponse] = Field(default_factory=list)


class CourseDetailResponse(BaseModel):
    course: CourseResponse
    groups: List[GroupResponse] = Field(default_factory=list)
    students: List[CourseMemberResponse] = Field(default_factory=list)
    lessons: List[TopicResponse] = Field(default_factory=list)
    leaderboard: List[LeaderboardEntryResponse] = Field(default_factory=list)


class PublicCourseGroupResponse(BaseModel):
    id: str
    name: str
    schedule_summary: str = ""
    current_topic_name: Optional[str] = None


class PublicCourseLessonResponse(BaseModel):
    id: str
    name: str
    description: str = ""
    order: int = 0
    total_tasks: int = 0


class PublicCourseDetailResponse(BaseModel):
    course: CourseResponse
    groups: List[PublicCourseGroupResponse] = Field(default_factory=list)
    lessons: List[PublicCourseLessonResponse] = Field(default_factory=list)


class NewsArticleResponse(BaseModel):
    id: str
    slug: str
    title: str
    intro: str = ""
    preview: str = ""
    body: List[str] = Field(default_factory=list)
    is_published: bool = True
    created_at: datetime
    updated_at: datetime
    editable: bool = False


class UserCoursesResponse(BaseModel):
    courses: List[CourseResponse]
    total: int


class UserGroupsResponse(BaseModel):
    groups: List[GroupResponse]
    total: int


class SubscriptionResponse(BaseModel):
    tg_username: str
    subscription_status: SubscriptionStatus
    lessons_remaining: int
    has_valid_subscription: bool


class AchievementResponse(BaseModel):
    id: str
    key: str
    title: str
    description: str
    avatar_url: Optional[str] = None
    trigger: AchievementTrigger
    course_id: Optional[str] = None
    state: str
    unlocked_at: Optional[datetime] = None
    editable: bool = False


class AchievementNoticeResponse(BaseModel):
    id: str
    title: str
    description: str
    avatar_url: Optional[str] = None
    course_id: Optional[str] = None


class StudentCourseAttendanceResponse(BaseModel):
    total_sessions: int = 0
    attended_sessions: int = 0
    paid_sessions: int = 0
    attendance_percent: float = 0.0


class StudentCourseProgressResponse(BaseModel):
    course_id: str
    course_name: str
    group_id: Optional[str] = None
    group_name: Optional[str] = None
    earned_points: int = 0
    total_points: int = 0
    progress_percent: float = 0.0
    finance: Optional["StudentCourseFinanceResponse"] = None
    attendance: Optional[StudentCourseAttendanceResponse] = None


class MonthlyPaymentResponse(BaseModel):
    month: str
    label: str
    note: str = ""
    paid_at: datetime


class StudentCourseFinanceResponse(BaseModel):
    payment_mode: PaymentMode = PaymentMode.SUBSCRIPTION
    debt_count: int = 0
    debt_label: str = ""
    enrolled_on: str = ""
    unpaid_lessons_count: int = 0
    paid_lessons_ahead: int = 0
    monthly_payments: List[MonthlyPaymentResponse] = Field(default_factory=list)


class StudentAdminResponse(BaseModel):
    user_id: str
    name: str
    surname: str
    tg_username: str
    telegram_id: Optional[str] = None
    phone: Optional[str] = None
    status: UserStatus
    points: int = 0
    course_ids: List[str] = Field(default_factory=list)
    course_group_ids: Dict[str, str] = Field(default_factory=dict)
    course_group_names: Dict[str, str] = Field(default_factory=dict)
    course_names: List[str] = Field(default_factory=list)
    total_points: int = 0
    progress_percent: float = 0.0
    course_progress: List[StudentCourseProgressResponse] = Field(default_factory=list)
    parents: List[LinkedParentResponse] = Field(default_factory=list)


class AdminStudentsResponse(BaseModel):
    students: List[StudentAdminResponse]
    available_courses: List[CourseOptionResponse]


class DashboardResponse(BaseModel):
    user: UserResponse
    courses: List[CourseResponse] = Field(default_factory=list)
    achievements: List[AchievementResponse] = Field(default_factory=list)
    managed_students: List[StudentAdminResponse] = Field(default_factory=list)
    linked_students: List[StudentAdminResponse] = Field(default_factory=list)
    editable_achievements: List[AchievementResponse] = Field(default_factory=list)
    available_courses: List[CourseOptionResponse] = Field(default_factory=list)
    pending_reviews: List[DashboardPendingReviewResponse] = Field(default_factory=list)
    course_requests: List["CourseRequestResponse"] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    code: Optional[int] = None


class EventResponse(BaseModel):
    id: str
    title: str
    description: str
    source_type: str = "event"
    schedule_type: ScheduleType
    date: Optional[str] = None
    weekday: Optional[int] = None
    start_time: str
    end_time: Optional[str] = None
    image_url: Optional[str] = None
    button_color: Optional[str] = None
    card_color: Optional[str] = None
    text_color: Optional[str] = None
    course_id: Optional[str] = None
    course_name: Optional[str] = None
    target_url: Optional[str] = None
    is_user_related: bool = False
    tags: List[EventTag] = Field(default_factory=list)
    is_active: bool


class ScheduledEventResponse(EventResponse):
    occurrence_date: str


class CourseRequestResponse(BaseModel):
    id: str
    course_id: str
    course_name: str
    contact_name: Optional[str] = None
    contact_value: str
    comment: Optional[str] = None
    created_at: datetime


class AttendanceEntryResponse(BaseModel):
    student_id: str
    present: bool = False
    paid: bool = False
    note: str = ""


class AttendanceSessionResponse(BaseModel):
    course_id: str
    group_id: str
    date: str
    original_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_cancelled: bool = False
    entries: List[AttendanceEntryResponse] = Field(default_factory=list)
    comment: str = ""
    updated_at: datetime


class AchievementRecipientResponse(BaseModel):
    user_id: str
    name: str
    surname: str
    tg_username: str
    unlocked_at: datetime


class AchievementOverviewResponse(BaseModel):
    id: str
    key: str
    title: str
    description: str
    avatar_url: Optional[str] = None
    trigger: AchievementTrigger
    achievement_type: str
    condition_text: str
    course_id: Optional[str] = None
    course_name: Optional[str] = None
    recipient_percent: float = 0.0
    recipient_count: int = 0
    total_students: int = 0
    recipients: List[AchievementRecipientResponse] = Field(default_factory=list)


TokenResponse.model_rebuild()
RegisterResponse.model_rebuild()
TaskResponse.model_rebuild()
DashboardResponse.model_rebuild()
CourseResponse.model_rebuild()
StudentCourseProgressResponse.model_rebuild()
