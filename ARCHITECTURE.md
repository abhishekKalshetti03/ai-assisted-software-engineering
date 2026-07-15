# Architecture

## System Overview

The URL shortener is a small but production-oriented Express + TypeScript service with a simple layered architecture:

```text
Client
  |
Express Server
  |
URL Service Layer
  |
SQLite DB
```

## Responsibilities

- Client: Sends HTTP requests for shortening URLs, redirecting, and analytics.
- Express Server: Handles routing, request validation, and response generation.
- URL Service Layer: Implements the business logic for validating URLs, generating short IDs, updating click counts, and returning analytics.
- SQLite DB: Persists URL mappings and analytics state locally.

## AI-Assisted Development Flow

```text
Requirement
  |
Engineer interprets and decomposes the work
  |
AI assists with code, tests, docs, and debugging
  |
Engineer validates the outputs and refines them
  |
Production-ready implementation
```

## Design Decisions and Trade-offs

- SQLite was chosen for simplicity, portability, and rapid development.
- Express was used because it is lightweight and well-suited for a prototype API.
- The current implementation favors clarity and maintainability over high-scale distributed concerns.
- Validation and test coverage were prioritized to reduce risk from AI-generated code.

## Engineering Deliverables

The solution includes:

- API implementation for shorten, redirect, and analytics actions
- SQLite persistence for URLs and click counts
- Jest tests for success and negative paths
- Documentation for setup, architecture, risks, and API usage

## Handling Real-World Engineering Scenarios

The design supports both steady-state delivery and realistic change management:

- Greenfield work: create new routes, services, and persistence from scratch
- Brownfield work: evolve an existing implementation through feature additions, refactoring, or bug fixes
- Test and documentation improvements: strengthen regression coverage and update user-facing guidance as behavior changes
- Well-defined requirements: implement directly against clear acceptance criteria
- Ambiguous requirements: clarify assumptions, document decisions, and build safeguards around uncertain behavior

## Notes

This project is intentionally structured to reflect a realistic engineering workflow:

1. Understand the requirement
2. Break it into tasks
3. Use AI to assist within each task
4. Validate outputs before accepting them
5. Deliver a cohesive working prototype
