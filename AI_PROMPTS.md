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
