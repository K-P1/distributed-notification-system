# Commit Message Guide (Conventional Commits)

We follow **Conventional Commits** specification to keep git history clean, enable automated changelog generation, and make code reviews easier.
Every commit should **describe what and why**, not just what changed.

## Format
```
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

### Allowed `<type>`
| Type         | Purpose                                      | Example                                                      |
| ------------ | -------------------------------------------- | ------------------------------------------------------------ |
| **feat**     | New feature or functionality                 | `feat(email-service): implement SMTP send logic`             |
| **fix**      | Bug or issue resolution                      | `fix(push-service): handle invalid device token gracefully`  |
| **chore**    | Maintenance or tooling updates               | `chore: update pre-commit hook`                              |
| **refactor** | Code restructure without changing behavior   | `refactor(user-service): simplify preference lookup`         |
| **docs**     | Documentation changes                        | `docs: add README for template service`                      |
| **test**     | Adding or improving tests                    | `test(api-gateway): add integration tests for queue routing` |
| **style**    | Formatting, linting, or stylistic cleanup    | `style: reformat imports using isort`                        |
| **perf**     | Performance-related improvement              | `perf(email-service): cache SMTP connection pool`            |
| **ci**       | Continuous integration or deployment changes | `ci: add GitHub Action for lint + test`                      |

### `<scope>` (optional but recommended)
The service or component affected:
- `api-gateway`
- `user`
- `template`
- `email`
- `push`
- `infra`
- `docs`

### Rules
1. **Subject line** (first line):
   - Imperative mood (`add`, not `added`)
   - No capital letter at start
   - No period at the end
   - Max 72 characters
2. **Body** (optional):
   - Explain **what** and **why**, not how
   - Blank line between subject and body
3. **Breaking changes**:
   - Add `BREAKING CHANGE:` in footer
   - Or use `!` after type/scope: `feat(api-gateway)!: drop old v1 endpoint`
4. **Use English** only

### Good Examples
```
feat(api-gateway): add idempotency check with Redis

- Store request_id for 24h
- Return 200 if already processed

Closes #42
```

```
fix(email): respect user opt-out preference

Fetch preferences from Redis cache before sending.
Add correlation_id to logs.
```

```
chore(infra): bump RabbitMQ to 3.13-alpine
```

### Bad Examples
```
Fixed bug
Added code
Update
```

### Tools
- VS Code extension: **Conventional Commits**
