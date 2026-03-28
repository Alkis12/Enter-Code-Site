import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
from pathlib import Path

from models.programming_language import ProgrammingLanguage, normalize_programming_language


PYTHON_FLAGS = ["-I", "-B", "-S"]
RUNNER_ENV_KEYS = [
    "SYSTEMROOT",
    "WINDIR",
    "PATH",
    "PATHEXT",
    "TEMP",
    "TMP",
    "TMPDIR",
]
MAX_OUTPUT_CHARS = int(os.getenv("CODE_RUNNER_MAX_OUTPUT_CHARS", "12000"))


def normalize_output(value: str) -> str:
    return value.replace("\r\n", "\n").strip()


def truncate_output(value: str) -> str:
    if len(value) <= MAX_OUTPUT_CHARS:
        return value
    return f"{value[:MAX_OUTPUT_CHARS]}\n...[output truncated]..."


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


def find_node_binary() -> str | None:
    configured = os.getenv("CODE_RUNNER_NODE_BIN")
    if configured:
        return configured

    for candidate in ["node", "nodejs"]:
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    return None


def build_runner_command(language: ProgrammingLanguage, script_path: Path) -> list[str]:
    if language == ProgrammingLanguage.PYTHON:
        return [sys.executable, *PYTHON_FLAGS, str(script_path)]

    if language == ProgrammingLanguage.JAVASCRIPT:
        node_binary = find_node_binary()
        if not node_binary:
            raise RuntimeError("Node.js runtime is not configured for JavaScript tasks")
        return [
            node_binary,
            "--disable-proto=delete",
            "--max-old-space-size=64",
            str(script_path),
        ]

    raise RuntimeError(f"Unsupported programming language: {language}")


def get_process_spawn_options() -> dict:
    if os.name == "nt":
        return {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
    return {"start_new_session": True}


def kill_process_tree(process: subprocess.Popen) -> None:
    try:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(process.pid)],
                capture_output=True,
                text=True,
                check=False,
            )
            return

        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        return
    except Exception:
        process.kill()


def build_script_path(temp_dir: Path, language: ProgrammingLanguage) -> Path:
    extension = ".js" if language == ProgrammingLanguage.JAVASCRIPT else ".py"
    return temp_dir / f"solution{extension}"


def execute_program(payload: dict) -> dict:
    language = normalize_programming_language(payload.get("language"))
    code = str(payload.get("code", ""))
    input_data = str(payload.get("input_data", ""))
    timeout_seconds = int(payload.get("timeout_seconds", 2))

    with tempfile.TemporaryDirectory() as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        script_path = build_script_path(temp_dir, language)
        script_path.write_text(code, encoding="utf-8")

        try:
            process = subprocess.Popen(
                build_runner_command(language, script_path),
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=str(temp_dir),
                env=build_runner_env(),
                close_fds=True,
                **get_process_spawn_options(),
            )
        except OSError as exc:
            return {
                "success": False,
                "exit_code": 0,
                "stdout": "",
                "stderr": "",
                "timed_out": False,
                "runner_error": f"Runner error: {exc}",
            }
        except RuntimeError as exc:
            return {
                "success": False,
                "exit_code": 0,
                "stdout": "",
                "stderr": "",
                "timed_out": False,
                "runner_error": str(exc),
            }

        try:
            stdout, stderr = process.communicate(input=input_data, timeout=timeout_seconds)
        except subprocess.TimeoutExpired:
            kill_process_tree(process)
            try:
                stdout, stderr = process.communicate(timeout=1)
            except Exception:
                stdout, stderr = "", ""
            return {
                "success": False,
                "exit_code": 0,
                "stdout": normalize_output(truncate_output(stdout)),
                "stderr": f"Time limit exceeded ({timeout_seconds}s)",
                "timed_out": True,
                "runner_error": "",
            }

        return {
            "success": process.returncode == 0,
            "exit_code": process.returncode,
            "stdout": normalize_output(truncate_output(stdout)),
            "stderr": normalize_output(truncate_output(stderr)),
            "timed_out": False,
            "runner_error": "",
        }


def main() -> int:
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError as exc:
        print(
            json.dumps(
                {
                    "success": False,
                    "exit_code": 0,
                    "stdout": "",
                    "stderr": "",
                    "timed_out": False,
                    "runner_error": f"Invalid harness payload: {exc}",
                }
            )
        )
        return 0

    print(json.dumps(execute_program(payload)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
