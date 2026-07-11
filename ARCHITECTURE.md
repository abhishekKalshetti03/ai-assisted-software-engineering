# Architecture

## Request Flow

```
Client
  |
Express Server
  |
URL Service Layer
  |
SQLite DB
```

## Components

- Client: Sends HTTP requests to shorten URLs or access analytics.
- Express Server: Handles incoming API requests and routes them to the appropriate service logic.
- URL Service Layer: Validates URLs, generates short IDs, stores records, and updates click counts.
- SQLite DB: Persists URL mappings and analytics data.

## Development Flow

```
Requirement
  |
Engineer
  |
AI assists
  |
Engineer validates
  |
Production Output
```

## Notes

This project follows a simple layered structure:

1. API layer for request handling
2. Service layer for business logic
3. Database layer for persistence

That separation keeps the implementation easy to extend and test.
