import unittest

from models.task import TaskTestCase
from services.code_runner_service import (
    run_javascript_program,
    run_javascript_solution,
    run_python_program,
)


class CodeRunnerServiceTest(unittest.TestCase):
    def test_python_runner_times_out(self):
        success, exit_code, stdout, stderr, timed_out = run_python_program(
            "while True:\n    pass\n",
            timeout_seconds=1,
        )

        self.assertFalse(success)
        self.assertEqual(exit_code, 0)
        self.assertEqual(stdout, "")
        self.assertTrue(timed_out)
        self.assertIn("Time limit exceeded", stderr)

    def test_javascript_runner_returns_stdout(self):
        success, exit_code, stdout, stderr, timed_out = run_javascript_program(
            'console.log("42");',
            timeout_seconds=1,
        )

        self.assertTrue(success)
        self.assertEqual(exit_code, 0)
        self.assertEqual(stdout, "42")
        self.assertEqual(stderr, "")
        self.assertFalse(timed_out)

    def test_javascript_solution_runs_test_cases(self):
        passed, passed_tests, stdout, stderr, test_results = run_javascript_solution(
            '\n'.join(
                [
                    'const fs = require("fs");',
                    'const input = fs.readFileSync(0, "utf8").trim();',
                    "console.log(String(Number(input) + 1));",
                ]
            ),
            [
                TaskTestCase(input_data="5", expected_output="6"),
                TaskTestCase(input_data="41", expected_output="42"),
            ],
            timeout_seconds=1,
        )

        self.assertTrue(passed)
        self.assertEqual(passed_tests, 2)
        self.assertIn("6", stdout)
        self.assertIn("42", stdout)
        self.assertEqual(stderr, "")
        self.assertEqual(len(test_results), 2)
        self.assertTrue(all(item.passed for item in test_results))


if __name__ == "__main__":
    unittest.main()
