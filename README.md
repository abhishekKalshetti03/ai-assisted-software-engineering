# URL Shortener API

A simple URL shortener built with Express, TypeScript, SQLite, and Jest.

## What it does

This project supports:

- Creating short URLs with POST /shorten
- Redirecting short URLs to the original destination
- Viewing analytics with GET /analytics/:id
- Running tests with Jest

## Prerequisites

Make sure the following are installed on the machine:

- Node.js 18 or newer
- npm

## Setup on a fresh machine

1. Clone the repository
2. Change into the project folder
3. Install dependencies

```bash
npm install
```

## Run the app

### Development mode

```bash
npm run dev
```

### Production build

```bash
npm run build
npm start
```

The server will run on port 3000 by default.

## Test the API

Open a second terminal and run:

### Create a short URL

```bash
curl -X POST http://127.0.0.1:3000/shorten \
  -H "content-type: application/json" \
  -d '{"url":"https://www.google.com"}'
```

### Visit the shortened URL

```bash
curl -I http://127.0.0.1:3000/<id>
```

### Check analytics

```bash
curl http://127.0.0.1:3000/analytics/<id>
```

## Run tests

```bash
npm test
```

## Project structure

```text
src/
  app.ts
  server.ts
  routes/
    health.ts
    shorten.ts
  database/
    db.ts
  __tests__/
    shorten.test.ts
```

## Notes

- SQLite database files are stored in the data folder.
- The app uses TypeScript for type safety.
- The server uses Express and basic middleware for security and logging.