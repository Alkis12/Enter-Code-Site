import os
import subprocess
import sys
import tempfile
from typing import List, Tuple

from models.task import TaskTestCase, TaskTestRunResult


DEFAULT_TIMEOUT_SECONDS = int(os.getenv("CODE_RUNNER_TIMEOUT_SECONDS", "2"))
MAX_CODE_SIZE = int(os.getenv("CODE_RUNNER_MAX_CODE_SIZE", "20000"))


def normalize_output(value: str) -> str:
    return value.replace("\r\n", "\n").strip()


def run_python_solution(
    code: str,
    tests: List[TaskTestCase],
    timeout_seconds: int | None = None,
) -> Tuple[bool, int, str, str, List[TaskTestRunResult]]:
    code = code or ""

    if not code.strip():
        return False, 0, "", "Solution code is empty", []

    if len(code.encode("utf-8")) > MAX_CODE_SIZE:
        return False, 0, "", f"Solution code exceeds {MAX_CODE_SIZE} bytes", []

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
            try:
                process = subprocess.run(
                    [sys.executable, script_path],
                    input=case.input_data,
                    capture_output=True,
                    text=True,
                    timeout=timeout_seconds,
                    cwd=temp_dir,
                    env={**os.environ, "PYTHONIOENCODING": "utf-8"},
                )
            except subprocess.TimeoutExpired:
                test_results.append(
                    TaskTestRunResult(
                        input_data=case.input_data,
                        expected_output=case.expected_output,
                        actual_output="",
                        stderr=f"Time limit exceeded ({timeout_seconds}s)",
                        passed=False,
                    )
                )
                return (
                    False,
                    passed,
                    "",
                    f"Time limit exceeded ({timeout_seconds}s)",
                    test_results,
                )
            except OSError as exc:
                test_results.append(
                    TaskTestRunResult(
                        input_data=case.input_data,
                        expected_output=case.expected_output,
                        actual_output="",
                        stderr=f"Runner error: {exc}",
                        passed=False,
                    )
                )
                return False, passed, "", f"Runner error: {exc}", test_results
            stdout = normalize_output(process.stdout)
            stderr = normalize_output(process.stderr)
            expected = normalize_output(case.expected_output)
            stdout_parts.append(stdout)
            stderr_parts.append(stderr)
            test_passed = process.returncode == 0 and stdout == expected
            test_results.append(
                TaskTestRunResult(
                    input_data=case.input_data,
                    expected_output=case.expected_output,
                    actual_output=stdout,
                    stderr=stderr,
                    passed=test_passed,
                )
            )
            if process.returncode != 0:
                return (
                    False,
                    passed,
                    stdout,
                    stderr or f"Exit code {process.returncode}",
                    test_results,
                )
            if stdout != expected:
                return False, passed, stdout, "", test_results
            passed += 1

    return (
        True,
        passed,
        "\n".join(stdout_parts).strip(),
        "\n".join(stderr_parts).strip(),
        test_results,
    )
