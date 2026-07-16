# SRE and Reliability Plan

This document defines the reliability targets, indicators, error budgets, and operational runbook for the URL Shortener service.

---

## 1. Service Level Indicators (SLIs)

SLIs are the measured signals used to assess whether the service is behaving within acceptable bounds.

| SLI | Definition | Measurement source |
|-----|------------|--------------------|
| **Availability** | Proportion of HTTP requests that return a non-5xx response | Access logs / `GET /metrics` |
| **Latency (p95)** | 95th-percentile end-to-end response time for successful requests | Request logger duration field |
| **Error rate** | Proportion of requests returning 5xx over a rolling window | Access logs |
| **Health check success** | `GET /api/v1/health/ready` returns HTTP 200 | Uptime monitor / Kubernetes readiness probe |
| **Redirect correctness** | `GET /:id` returns HTTP 302 with a valid `Location` header | Synthetic probe |
| **Rate limit headroom** | Proportion of requests returning HTTP 429 | Access logs |

---

## 2. Service Level Objectives (SLOs)

SLOs set the reliability targets the team commits to maintaining.

| SLO | Target | Window |
|-----|--------|--------|
| Availability | ≥ 99.9 % of requests succeed (non-5xx) | Rolling 30 days |
| Latency p95 | ≤ 300 ms for shorten and redirect | Rolling 7 days |
| Error rate | < 1 % of all requests return 5xx | Rolling 30 days |
| Health check | `GET /api/v1/health/ready` succeeds within 1 s ≥ 99.9 % of the time | Rolling 30 days |
| Redirect correctness | 100 % of valid short-URL lookups return a correct 302 | Rolling 7 days |

---

## 3. Error Budget

An error budget is the allowed downtime or failures implied by the SLO.

| SLO | Allowed failures per 30 days |
|-----|------------------------------|
| Availability 99.9 % | 0.1 % of total requests may fail |
| Latency p95 ≤ 300 ms | 5 % of requests may exceed 300 ms |
| Error rate < 1 % | Up to 1 % of requests may return 5xx |

**Error budget policy**

- If the error budget is > 50 % consumed in the first half of the window, trigger a reliability review.
- If the error budget is exhausted, freeze non-critical feature work and focus only on reliability improvements until budget is restored.
- All deployments require passing CI and a green `GET /health` check before promoting.

---

## 4. Alerting Thresholds

| Alert | Trigger | Severity | Action |
|-------|---------|----------|--------|
| High error rate | 5xx rate > 2 % over 5 minutes | Critical | Page on-call; follow runbook section 6.1 |
| Elevated latency | p95 > 500 ms over 10 minutes | Warning | Investigate DB and connection pool |
| Health check failing | `/api/v1/health/live` non-200 for 2 consecutive probes | Critical | Page on-call; follow runbook section 6.2 |
| Rate limit spike | 429s > 10 % of requests over 5 minutes | Warning | Investigate abuse or misconfigured client |
| Container restart | Pod/container restarted more than 2 times in 10 minutes | Warning | Check startup logs and memory limits |

---

## 5. Operational Practices

- **Health and readiness probes** — all container deployments use `GET /api/v1/health/ready` for readiness (when service is ready for traffic) and `GET /api/v1/health/live` for liveness (when process is still alive). The service is removed from the load balancer while the readiness probe is failing.
- **Structured logging** — every request logs method, path, status code, and duration. Logs are emitted to stdout for collection by the container runtime.
- **Request ID tracing** — each request carries an `x-request-id` header (generated if absent). Use this to correlate log lines across services.
- **Metrics endpoint** — `GET /api/v1/metrics` returns in-process counters (total requests, health checks, shortens, redirects, analytics calls). Scrape this with Prometheus or poll it from a health dashboard.
- **Versioned deployments** — every deploy uses a Git SHA image tag. This makes rollbacks deterministic.
- **Change management** — all changes go through a pull request and pass CI (tests + build) before merging to `main`.

---

## 6. Runbook

### 6.1 High error rate (5xx spike)

**Symptoms:** Alert fires, access logs show 5xx on shorten or redirect endpoints.

**Steps:**
1. Check `GET /api/v1/health/live` — if it returns non-200, the process itself is unhealthy (go to 6.2).
2. Check `GET /api/v1/metrics` to identify which counter has increased: `shortenCount`, `redirectCount`, or `analyticsCount`.
3. Tail the container logs:
   ```bash
   docker logs url-shortener --tail 100
   # or in Kubernetes:
   kubectl logs deploy/url-shortener --tail=100
   ```
4. Look for stack traces or unhandled exceptions in the log output.
5. If a recent deployment is correlated, roll it back:
   ```bash
   # Docker Compose — pull the previous image tag and redeploy
   docker compose down && docker compose up -d

   # Kubernetes — roll back to the previous ReplicaSet
   kubectl rollout undo deployment/url-shortener
   ```
6. Verify recovery: confirm `GET /health` returns 200 and the 5xx rate drops to zero in the next 2 minutes of logs.
7. File a post-incident note documenting what changed and what was affected.

---

### 6.2 Health check failing

**Symptoms:** Readiness or liveness probe failing; container restarting; upstream returns 502/503.

**Steps:**
1. Check whether the container process is running:
   ```bash
   docker ps | grep url-shortener
   # or
   kubectl get pods -l app=url-shortener
   ```
2. Retrieve recent logs:
   ```bash
   docker logs url-shortener --tail 50
   # or
   kubectl logs deploy/url-shortener --previous
   ```
3. Common causes:
   - **Port conflict** — another process is bound to port 3000. Free the port or change `PORT` in the environment.
   - **Database error on startup** — the SQLite file under `data/` is missing or corrupt. Check the data volume mount and disk space.
   - **OOM kill** — the container hit its memory limit. Increase memory limits or investigate a memory leak.
4. Once the root cause is resolved, restart the container:
   ```bash
   docker compose restart app
   # or
   kubectl rollout restart deployment/url-shortener
   ```
5. Confirm probes pass within 30 seconds.

---

### 6.3 High latency

**Symptoms:** p95 latency alert fires; users report slow redirects.

**Steps:**
1. Check `GET /metrics` for overall request volume — a traffic spike can cause queueing.
2. Check disk usage on the host running SQLite:
   ```bash
   df -h
   ```
3. Check for long-running queries (if using WAL mode, high write contention can cause reads to stall).
4. If latency is caused by traffic growth, scale the service horizontally:
   ```bash
   # Kubernetes
   kubectl scale deployment/url-shortener --replicas=3
   ```
5. If a code change is correlated, roll it back (see 6.1 step 5).

---

### 6.4 Rate limit spike (HTTP 429)

**Symptoms:** 429 rate alert fires; legitimate users are being throttled.

**Steps:**
1. Identify the source IP from the access logs:
   ```bash
   docker logs url-shortener 2>&1 | grep 429 | awk '{print $1}' | sort | uniq -c | sort -rn | head
   ```
2. If traffic is from a known legitimate client, either whitelist the IP in the rate limiter config or increase `MAX_REQUESTS` in `src/middleware/rateLimiter.ts`.
3. If traffic is abusive, block the IP at the network or load balancer layer.
4. Deploy the updated limiter config and verify that legitimate requests are no longer throttled.

---

## 7. On-Call Escalation

| Level | Contact | Criteria |
|-------|---------|----------|
| L1 — on-call engineer | Automated alert | Any Critical alert |
| L2 — service owner | Paged after 15 minutes unresolved | Critical alert not resolved |
| L3 — infrastructure lead | Paged after 30 minutes unresolved | Full outage or data loss risk |

All incidents must be followed by a blameless post-incident review within 48 hours.

