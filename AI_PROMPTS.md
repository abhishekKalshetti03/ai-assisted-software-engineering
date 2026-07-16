# AI Prompts

This document contains the most important prompts for the URL shortener project.

## 1. Break down a URL shortener into engineering tasks

Prompt:

```text
Break down a URL shortener into engineering tasks. To identify implementation phases.
```

## 2. Implementation phases

Prompt:

```text
Generate Express controller. Review added validation.
```

Prompt:

```text
Generate Jest tests. Review added negative test cases.
```

Prompt:

```text
Generate Swagger documentation. Review corrected response codes.
```

## 3. Additional implementation prompts

Prompt:

```text
Create a new Express route in this TypeScript project for a GET /health endpoint that returns { status: "ok" }.
```

## 4. Real-world engineering scenarios

Prompt:

```text
Show how to use AI effectively in a software engineering task by breaking requirements into tasks, implementing features, reviewing the output, validating the result, and documenting trade-offs clearly.
```

Prompt:

```text
Improve the software design of this project by introducing separation of concerns, better error handling, stronger validation, and clearer service boundaries while keeping the implementation maintainable.
```

Prompt:

```text
Review and refine the generated code so it is correct, robust, and defensible, not just functional.
```

Prompt:

```text
Demonstrate ownership of AI-assisted code by identifying weaknesses, improving the implementation, and validating the result with tests and build checks.
```

Prompt:

```text
Strengthen the testing discipline for this project by adding regression tests for validation, redirect behavior, analytics, and operational endpoints.
```

Prompt:

```text
Document the engineering approach clearly so the rationale, design decisions, and validation steps are easy to defend in an evaluation setting.
```

Prompt:

```text
Build a greenfield feature for this URL shortener: add custom slug support allowing users to specify a 1-50 character alphanumeric slug (with hyphens). 
Implement:
- POST /api/v1/shorten body parameter: "slug" (optional)
- Validation: alphanumeric+hyphens, 1-50 chars, future expiration date (ISO 8601)
- Database: store slug in urls.id column, detect 409 Conflict on duplicates
- Error handling: ValidationError (400), ConflictError (409)
- Tests: 8 test cases covering valid slugs, duplicates, invalid formats, missing params
- Documentation: request/response examples with slug parameter
Include end-to-end implementation from route handler through database to integration tests.
```

Prompt:

```text
Build a brownfield enhancement for this URL shortener: add URL expiration support to existing shortened URLs.
Enhance:
- Schema: add expires_at TEXT column to urls table (nullable, auto-migrated)
- Service: isValidFutureDate(expiresAt) validates ISO 8601 future dates
- Redirect logic: return 410 Gone if URL expired, return 301/302 redirect if valid
- Storage: save expires_at on POST /api/v1/shorten (optional expiresAt param)
- API: GET /api/v1/analytics/:id returns expires_at timestamp
- Tests: 3 test cases for expired URLs, active URLs, and missing expiration
Ensure backward compatibility: existing URLs without expiration work unchanged, all current tests pass.
```

Prompt:

```text
Improve tests and documentation for this project by adding regression coverage, clarifying usage, and updating the API contract.
```

Prompt:

```text
Resolve an ambiguous requirement by identifying assumptions, documenting trade-offs, and proposing a practical implementation approach.
```

Prompt:

```text
Add SQLite logic to this Express TypeScript app to store shortened URLs in a simple urls table with id, original_url, click_count, and created_at columns.
```

Prompt:

```text
Add input validation so POST /shorten only accepts valid http or https URLs and returns a 400 error otherwise.
```

Prompt:

```text
Update the app so visiting a shortened URL increments the click_count in SQLite and the GET /analytics/:id endpoint returns the current click count.
```

Prompt:

```text
Create Jest tests for the POST /shorten endpoint covering valid URL, invalid URL, missing URL, redirect behavior, and analytics incrementing.
```

Prompt:

```text
Refactor this Express TypeScript project to be more production-ready with clear separation of routes, services, and database access.
```

This document is extremely important.
