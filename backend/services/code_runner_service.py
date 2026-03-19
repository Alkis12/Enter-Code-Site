import os
import subprocess
import sys
import tempfile
from typing import List, Tuple

from models.task import TaskTestCase, TaskTestRunResult


DEFAULT_TIMEOUT_SECONDS = int(os.getenv("CODE_RUNNER_TIMEOUT_SECONDS", "2"))
MAX_CODE_SIZE = int(os.getenv("CODE_RUNNER_MAX_CODE_SIZE", "20000"))
RUNNER_FLAGS = ["-I", "-B", "-S"]
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


def build_runner_env() -> dict[str, str]:
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


def build_runner_command(script_path: str) -> list[str]:
    return [sys.executable, *RUNNER_FLAGS, script_path]


def execute_python_script(
    script_path: str,
    input_data: str,
    timeout_seconds: int,
    cwd: str,
) -> Tuple[bool, int, str, str, bool]:
    try:
        process = subprocess.run(
            build_runner_command(script_path),
            input=input_data,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            cwd=cwd,
            env=build_runner_env(),
            close_fds=True,
        )
    except subprocess.TimeoutExpired:
        return (
            False,
            0,
            "",
            f"Time limit exceeded ({timeout_seconds}s)",
            True,
        )
    except OSError as exc:
        return False, 0, "", f"Runner error: {exc}", False

    stdout = normalize_output(process.stdout)
    stderr = normalize_output(process.stderr)
    success = process.returncode == 0
    return success, process.returncode, stdout, stderr, False


def run_python_program(
    code: str,
    input_data: str = "",
    timeout_seconds: int | None = None,
) -> Tuple[bool, int, str, str, bool]:
    validation_error = validate_code_payload(code)
    if validation_error:
        return False, 0, "", validation_error, False

    timeout_seconds = timeout_seconds or DEFAULT_TIMEOUT_SECONDS

    with tempfile.TemporaryDirectory() as temp_dir:
        script_path = os.path.join(temp_dir, "solution.py")
        with open(script_path, "w", encoding="utf-8") as script_file:
            script_file.write(code)

        return execute_python_script(
            script_path,
            input_data=input_data,
            timeout_seconds=timeout_seconds,
            cwd=temp_dir,
        )


def run_python_solution(
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

    with tempfile.TemporaryDirectory() as temp_dir:
        script_path = os.path.join(temp_dir, "solution.py")
        with open(script_path, "w", encoding="utf-8") as script_file:
            script_file.write(code)

        for case in tests:
            success, exit_code, stdout, stderr, timed_out = execute_python_script(
                script_path,
                input_data=case.input_data,
                timeout_seconds=timeout_seconds,
                cwd=temp_dir,
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
