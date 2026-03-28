from datetime import datetime
from enum import Enum
from typing import List, Optional

from beanie import Document
from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    NO_ATTEMPTS = "no_attempts"
    WRONG_ANSWER = "wrong_answer"
    PENDING_REVIEW = "pending_review"
    CORRECT = "correct"


class TaskTestCase(BaseModel):
    input_data: str = Field(default="")
    expected_output: str = Field(default="")
    is_public: bool = Field(default=True)


class TaskTestRunResult(BaseModel):
    input_data: str = Field(default="")
    expected_output: str = Field(default="")
    actual_output: str = Field(default="")
    stderr: str = Field(default="")
    passed: bool = Field(default=False)
    is_public: bool = Field(default=True)


class TaskSubmission(BaseModel):
    code: str
    passed: bool
    passed_tests: int
    total_tests: int
    stdout: str = ""
    stderr: str = ""
    test_results: List[TaskTestRunResult] = Field(default_factory=list)
    waiting_manual_review: bool = Field(default=False)
    review_comment: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TaskResult(BaseModel):
    user_id: str
    score: int = Field(default=0, ge=0)
    status: TaskStatus = Field(default=TaskStatus.NO_ATTEMPTS)
    attempts: int = Field(default=0, ge=0)
    solved_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    review_comment: Optional[str] = None
    last_submission: Optional[TaskSubmission] = None
    best_submission: Optional[TaskSubmission] = None
    submission_history: List[TaskSubmission] = Field(default_factory=list)

    def add_submission(self, submission: TaskSubmission) -> None:
        self.last_submission = submission
        self.submission_history.append(submission)
        if self._is_better_submission(submission, self.best_submission):
            self.best_submission = submission

    @staticmethod
    def _is_better_submission(
        candidate: TaskSubmission,
        current: Optional[TaskSubmission],
    ) -> bool:
        if current is None:
            return True
        if candidate.passed != current.passed:
            return candidate.passed
        if candidate.passed_tests != current.passed_tests:
            return candidate.passed_tests > current.passed_tests
        if candidate.total_tests != current.total_tests:
            return candidate.total_tests > current.total_tests
        return candidate.created_at >= current.created_at


class Task(Document):
    topic_id: str = Field(...)
    title: str = Field(..., min_length=1, max_length=200)
    condition: str = Field(..., min_length=1, max_length=10000)
    attachments: List[str] = Field(default_factory=list)
    points: int = Field(default=10, ge=0)
    starter_code: str = Field(default="")
    language: str = Field(default="python", max_length=20)
    requires_manual_review: bool = Field(default=False)
    tests: List[TaskTestCase] = Field(default_factory=list)
    order: int = Field(default=0, ge=0)
    results: List[TaskResult] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def touch(self) -> None:
        self.updated_at = datetime.utcnow()

    def get_result_for_student(self, user_id: str) -> Optional[TaskResult]:
        for result in self.results:
            if result.user_id == user_id:
                return result
        return None

    def get_status_for_student(self, user_id: str) -> TaskStatus:
        result = self.get_result_for_student(user_id)
        return result.status if result else TaskStatus.NO_ATTEMPTS

    def get_score_for_student(self, user_id: str) -> int:
        result = self.get_result_for_student(user_id)
        return result.score if result else 0

    def upsert_result(self, user_id: str) -> TaskResult:
        existing = self.get_result_for_student(user_id)
        if existing:
            return existing
        created = TaskResult(user_id=user_id)
        self.results.append(created)
        return created

    class Settings:
        name = "tasks"
