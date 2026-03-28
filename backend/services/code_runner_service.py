import json
import os
import subprocess
import sys
from pathlib import Path
from typing import List, Tuple

from models.programming_language import ProgrammingLanguage, normalize_programming_language
from models.task import TaskTestCase, TaskTestRunResult


BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_TIMEOUT_SECONDS = int(os.getenv("CODE_RUNNER_TIMEOUT_SECONDS", "2"))
HARNESS_TIMEOUT_GRACE_SECONDS = int(os.getenv("CODE_RUNNER_HARNESS_GRACE_SECONDS", "1"))
MAX_CODE_SIZE = int(os.getenv("CODE_RUNNER_MAX_CODE_SIZE", "20000"))
RUNNER_ENV_KEYS = [
    "SYSTEMROOT",
    "WINDIR",
    "PATH",
    "PATHEXT",
    "TEMP",
    "TMP",
    "TMPDIR",
]


def normalize_output(value: str) -> str:
    return value.replace("\r\n", "\n").strip()


def validate_code_payload(code: str) -> str | None:
    code = code or ""

    if not code.strip():
        return "Solution code is empty"

    if len(code.encode("utf-8")) > MAX_CODE_SIZE:
        return f"Solution code exceeds {MAX_CODE_SIZE} bytes"

    return None


def build_harness_env() -> dict[str, str]:
    env = {
        key: value
        for key, value in os.environ.items()
        if key in RUNNER_ENV_KEYS and value
    }
    env.update(
        {
            "PYTHONIOENCODING": "utf-8",
            "PYTHONUNBUFFERED": "1",
            "PYTHONNOUSERSITE": "1",
            "PYTHONSAFEPATH": "1",
        }
    )
    return env


def execute_program(
    language: str | ProgrammingLanguage,
    code: str,
    input_data: str,
    timeout_seconds: int,
) -> Tuple[bool, int, str, str, bool]:
    normalized_language = normalize_programming_language(language)
    payload = {
        "language": normalized_language.value,
        "code": code,
        "input_data": input_data,
        "timeout_seconds": timeout_seconds,
    }

    try:
        process = subprocess.run(
            [sys.executable, "-m", "services.code_runner_harness"],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            timeout=timeout_seconds + HARNESS_TIMEOUT_GRACE_SECONDS,
            cwd=str(BASE_DIR),
            env=build_harness_env(),
            close_fds=True,
        )
    except subprocess.TimeoutExpired:
        return False, 0, "", f"Time limit exceeded ({timeout_seconds}s)", True
    except OSError as exc:
        return False, 0, "", f"Runner harness error: {exc}", False

    if process.returncode != 0:
        stderr = normalize_output(process.stderr) or f"Runner harness exited with code {process.returncode}"
        return False, 0, "", stderr, False

    try:
        result = json.loads(process.stdout or "{}")
    except json.JSONDecodeError:
        stderr = normalize_output(process.stderr)
        message = "Runner harness returned invalid JSON"
        if stderr:
            message = f"{message}: {stderr}"
        return False, 0, "", message, False

    stdout = normalize_output(str(result.get("stdout", "")))
    stderr = normalize_output(str(result.get("stderr", "")))
    runner_error = normalize_output(str(result.get("runner_error", "")))
    timed_out = bool(result.get("timed_out", False))
    success = bool(result.get("success", False))
    exit_code = int(result.get("exit_code", 0))

    if runner_error:
        return False, exit_code, stdout, runner_error, timed_out

    return success, exit_code, stdout, stderr, timed_out


def run_program(
    language: str | ProgrammingLanguage,
    code: str,
    input_data: str = "",
    timeout_seconds: int | None = None,
) -> Tuple[bool, int, str, str, bool]:
    validation_error = validate_code_payload(code)
    if validation_error:
        return False, 0, "", validation_error, False

    timeout_seconds = timeout_seconds or DEFAULT_TIMEOUT_SECONDS
    return execute_program(language, code, input_data=input_data, timeout_seconds=timeout_seconds)


def run_solution(
    language: str | ProgrammingLanguage,
    code: str,
    tests: List[TaskTestCase],
    timeout_seconds: int | None = None,
) -> Tuple[bool, int, str, str, List[TaskTestRunResult]]:
    validation_error = validate_code_payload(code)
    if validation_error:
        return False, 0, "", validation_error, []

    if not tests:
        return True, 0, "", "", []

    timeout_seconds = timeout_seconds or DEFAULT_TIMEOUT_SECONDS
    passed = 0
    stdout_parts: List[str] = []
    stderr_parts: List[str] = []
    test_results: List[TaskTestRunResult] = []

    for case in tests:
        success, exit_code, stdout, stderr, timed_out = execute_program(
            language,
            code,
            input_data=case.input_data,
            timeout_seconds=timeout_seconds,
        )
        expected = normalize_output(case.expected_output)
        stdout_parts.append(stdout)
        stderr_parts.append(stderr)

        if timed_out:
            test_results.append(
                TaskTestRunResult(
                    input_data=case.input_data,
                    expected_output=case.expected_output,
                    actual_output="",
                    stderr=stderr,
                    passed=False,
                    is_public=getattr(case, "is_public", True),
                )
            )
            return False, passed, "", stderr, test_results

        if exit_code != 0:
            test_results.append(
                TaskTestRunResult(
                    input_data=case.input_data,
                    expected_output=case.expected_output,
                    actual_output=stdout,
                    stderr=stderr,
                    passed=False,
                    is_public=getattr(case, "is_public", True),
                )
            )
            return False, passed, stdout, stderr or f"Exit code {exit_code}", test_results

        test_passed = success and stdout == expected
        test_results.append(
            TaskTestRunResult(
                input_data=case.input_data,
                expected_output=case.expected_output,
                actual_output=stdout,
                stderr=stderr,
                passed=test_passed,
                is_public=getattr(case, "is_public", True),
            )
        )
        if not test_passed:
            return False, passed, stdout, "", test_results
        passed += 1

    return (
        True,
        passed,
        "\n".join(stdout_parts).strip(),
        "\n".join(stderr_parts).strip(),
        test_results,
    )


def run_python_program(
    code: str,
    input_data: str = "",
    timeout_seconds: int | None = None,
) -> Tuple[bool, int, str, str, bool]:
    return run_program(
        ProgrammingLanguage.PYTHON,
        code,
        input_data=input_data,
        timeout_seconds=timeout_seconds,
    )


def run_python_solution(
    code: str,
    tests: List[TaskTestCase],
    timeout_seconds: int | None = None,
) -> Tuple[bool, int, str, str, List[TaskTestRunResult]]:
    return run_solution(
        ProgrammingLanguage.PYTHON,
        code,
        tests,
        timeout_seconds=timeout_seconds,
    )


def run_javascript_program(
    code: str,
    input_data: str = "",
    timeout_seconds: int | None = None,
) -> Tuple[bool, int, str, str, bool]:
    return run_program(
        ProgrammingLanguage.JAVASCRIPT,
        code,
        input_data=input_data,
        timeout_seconds=timeout_seconds,
    )


def run_javascript_solution(
    code: str,
    tests: List[TaskTestCase],
    timeout_seconds: int | None = None,
) -> Tuple[bool, int, str, str, List[TaskTestRunResult]]:
    return run_solution(
        ProgrammingLanguage.JAVASCRIPT,
        code,
        tests,
        timeout_seconds=timeout_seconds,
    )
