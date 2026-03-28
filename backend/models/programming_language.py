from enum import Enum


class ProgrammingLanguage(str, Enum):
    PYTHON = "python"
    JAVASCRIPT = "javascript"


LANGUAGE_ALIASES = {
    "py": ProgrammingLanguage.PYTHON,
    "python": ProgrammingLanguage.PYTHON,
    "python3": ProgrammingLanguage.PYTHON,
    "js": ProgrammingLanguage.JAVASCRIPT,
    "javascript": ProgrammingLanguage.JAVASCRIPT,
    "node": ProgrammingLanguage.JAVASCRIPT,
    "nodejs": ProgrammingLanguage.JAVASCRIPT,
}


def normalize_programming_language(value: str | ProgrammingLanguage | None) -> ProgrammingLanguage:
    if isinstance(value, ProgrammingLanguage):
        return value

    normalized = str(value or ProgrammingLanguage.PYTHON.value).strip().lower()
    language = LANGUAGE_ALIASES.get(normalized)
    if language:
        return language

    raise ValueError(f"Unsupported programming language: {value}")


def get_programming_language_label(value: str | ProgrammingLanguage | None) -> str:
    language = normalize_programming_language(value)
    if language == ProgrammingLanguage.JAVASCRIPT:
        return "JavaScript"
    return "Python"

