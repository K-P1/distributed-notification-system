"""Template rendering service using Jinja2."""

import re
from typing import Any

from jinja2 import Environment, Template as Jinja2Template, TemplateError, meta


class TemplateRenderer:
    """Service for rendering templates with Jinja2."""

    def __init__(self) -> None:
        """Initialize Jinja2 environment."""
        self.env = Environment(
            autoescape=True,  # Auto-escape HTML for security
            trim_blocks=True,
            lstrip_blocks=True,
        )

    def extract_variables(self, template_string: str) -> list[str]:
        """Extract variable names from a template string."""
        try:
            ast = self.env.parse(template_string)
            variables = meta.find_undeclared_variables(ast)
            return sorted(list(variables))
        except TemplateError:
            # If parsing fails, fall back to regex extraction
            return self._extract_variables_regex(template_string)

    def _extract_variables_regex(self, template_string: str) -> list[str]:
        """Extract variables using regex as fallback."""
        # Match {{variable}} patterns
        pattern = r"\{\{\s*(\w+)\s*\}\}"
        matches = re.findall(pattern, template_string)
        return sorted(list(set(matches)))

    def render(self, template_string: str, variables: dict[str, Any]) -> str:
        """Render a template string with provided variables."""
        try:
            template = self.env.from_string(template_string)
            return template.render(**variables)
        except TemplateError as e:
            raise ValueError(f"Template rendering error: {str(e)}")

    def validate_template(self, template_string: str) -> tuple[bool, str | None]:
        """Validate template syntax."""
        try:
            self.env.parse(template_string)
            return True, None
        except TemplateError as e:
            return False, str(e)

    def render_template_parts(
        self, subject: str, body_html: str, body_text: str, variables: dict[str, Any]
    ) -> tuple[str, str, str, list[str]]:
        """
        Render all template parts and return used variables.

        Returns:
            Tuple of (rendered_subject, rendered_html, rendered_text, variables_used)
        """
        # Extract all variables from all parts
        subject_vars = set(self.extract_variables(subject))
        html_vars = set(self.extract_variables(body_html))
        text_vars = set(self.extract_variables(body_text))
        all_vars = subject_vars | html_vars | text_vars

        # Render each part
        rendered_subject = self.render(subject, variables)
        rendered_html = self.render(body_html, variables)
        rendered_text = self.render(body_text, variables)

        return rendered_subject, rendered_html, rendered_text, sorted(list(all_vars))
