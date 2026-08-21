# Concurrent-Safe Meeting Room Booking GraphQL API

A high-performance, concurrent-safe Room Booking GraphQL API built with **Bun**, **TypeScript**, **GraphQL Yoga v5**, **Prisma ORM v7**, and **PostgreSQL**.

---

## 🌟 Architecture & Key Features

- **Strict Type Safety**: Written in 100% strict TypeScript running natively on Bun.
- **Schema-First GraphQL API**: Clean GraphQL schema files (`.graphql`) powering queries, mutations, Relay-compliant pagination connections, and standard custom scalars (`DateTime`).
- **Concurrency Protection Engine**: PostgreSQL row-level locking (`SELECT ... FOR UPDATE`) inside interactive `$transaction` blocks on target `Resource` rows to guarantee 100% double-booking prevention under concurrent loads.
- **Half-Open Interval Collision Logic**: Enforces `[startTime, endTime)` logic allowing back-to-back bookings (e.g., 10:00–11:00 and 11:00–12:00 do not conflict).
- **Relay Keyset Cursor Pagination**: Zero-offset pagination using base64 opaque cursors backed by composite PostgreSQL indexes `@@index([startTime, id])`.
- **Standardized Error Taxonomy**: Centrally mapped application errors returning standardized GraphQL Yoga extensions and HTTP status codes (`400`, `404`, `409`).

---

## 🏗️ Monorepo Structure

```text
Meeting_Room_Booking_System/
│
├── backend/                                # Backend Bun + GraphQL Yoga application root
│   ├── app/                                # Core application source code
│   │   ├── database/                       # Prisma 7 dynamic driver adapter (pg Pool)
│   │   │   └── prisma.ts
│   │   ├── graphql/                        # Schemas, resolvers, and error taxonomy
│   │   │   ├── errors.ts                   # Central ERROR_MAP taxonomy
│   │   │   ├── resolvers/                  # Thin resolver mapping layer
│   │   │   └── schemas/                    # Schema-first .graphql definitions
│   │   ├── services/                       # Core domain business logic layer
│   │   │   ├── booking.service.ts          # Concurrency locks, overlap checks, keyset queries
│   │   │   └── resource.service.ts         # Resource management logic
│   │   └── index.ts                        # Server entrypoint & GraphQL Yoga masked errors
│   │
│   ├── prisma/                             # Database schema & migrations
│   │   ├── migrations/                     # Raw SQL PostgreSQL migrations
│   │   └── schema.prisma                   # Entity models, enums & composite indexes
│   │
│   ├── tests/                              # Database-backed test suite (bun test)
│   │   ├── availability.test.ts
│   │   ├── booking.test.ts
│   │   ├── concurrency.test.ts             # Double-booking race condition test
│   │   ├── graphql.test.ts                 # Full GraphQL HTTP E2E tests
│   │   ├── pagination.test.ts              # Keyset cursor pagination tests
│   │   └── resource.test.ts
│   │
│   └── package.json
│
├── frontend/                               # React UI Application (Phase 7)
│
└── documentations/                         # Comprehensive technical documentation
    ├── project_plan/
    │   └── planning.md                     # Master 8-Phase Architectural Plan
    └── technical_documentation/
        ├── phase-1.md                      # Phase 1 setup & database layer report
        └── phase-2.md                      # Phase 2 backend & concurrency layer report
```

---

## ⚡ Concurrency Protection Engine Explained

### The Problem: Phantom Reads & Double-Booking Race Conditions

In standard database querying, if two users issue concurrent booking requests for the exact same unbooked slot ($10:00 \rightarrow 11:00$):

```text
User A: SELECT * FROM "Booking" WHERE startTime < 11:00 AND endTime > 10:00;  --> Returns 0 rows
User B: SELECT * FROM "Booking" WHERE startTime < 11:00 AND endTime > 10:00;  --> Returns 0 rows
User A: INSERT INTO "Booking" ...                                            --> SUCCESS!
User B: INSERT INTO "Booking" ...                                            --> SUCCESS (DOUBLE BOOKING BUG!)
```

> **Why Locking "Booking" Rows Fails:**  
> Running `SELECT ... FROM "Booking" ... FOR UPDATE` only locks **existing** rows in PostgreSQL. When a time slot is completely open, the query returns `0` rows. Locking `0` rows acquires **zero locks**, allowing phantom reads and concurrent double-bookings.

---

### The Solution: Resource-Level Write Locking

To eliminate this vulnerability, the service layer acquires an explicit PostgreSQL write lock (`FOR UPDATE`) on the parent `Resource` row inside an interactive transaction (`prisma.$transaction`):

```text
Request A (Thread 1) ────────┐
                             ├──> PostgreSQL Interactive Transaction ($transaction)
Request B (Thread 2) ────────┘    1. SELECT "id" FROM "Resource" WHERE "id" = $1 FOR UPDATE
                                  2. Check Overlap Formula against current DB state
                                  3. INSERT Booking (if clear) or ABORT (if conflict)
```

```mermaid
sequenceDiagram
    autonumber
    actor UserA as Request A (10:00-11:00)
    actor UserB as Request B (10:00-11:00)
    participant DB as PostgreSQL Transaction Engine

    UserA->>DB: BEGIN Transaction & SELECT Resource FOR UPDATE
    Note over DB: Lock acquired on Resource R1 by Request A
    UserB->>DB: BEGIN Transaction & SELECT Resource FOR UPDATE
    Note over DB: Request B BLOCKS waiting for Resource R1 lock
    UserA->>DB: Check Overlap (0 collisions)
    UserA->>DB: INSERT Booking A (CONFIRMED) & COMMIT
    Note over DB: Lock released on Resource R1
    Note over DB: Request B UNBLOCKS & acquires lock
    UserB->>DB: Check Overlap (Found Booking A!)
    UserB->>DB: ROLLBACK Transaction & Throw RESOURCE_UNAVAILABLE
```

By serializing mutations on the target resource, concurrent requests safely queue. The second request re-evaluates the overlap against the newly committed booking state and is rejected with `RESOURCE_UNAVAILABLE` (HTTP 409).

---

## 🛠️ Execution & Setup Guide

### 1. Prerequisites

- **Bun Runtime**: v1.0.0 or higher ([bun.sh](https://bun.sh))
- **PostgreSQL Database**: v14 or higher running locally or via Docker/cloud host.

### 2. Environment Configuration

Navigate to `backend/` and configure `.env`:

```bash
cd backend
```

Ensure `.env` contains your PostgreSQL connection string:

```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/your_db?schema=public"
PORT=4000
```

### 3. Database Migration & Sync

Run Prisma database migrations to create the PostgreSQL tables, enums, and composite indexes:

```bash
bun run db:migrate
```

### 4. Server Launch & GraphQL Playground

Start the API server in watch mode:

```bash
bun run dev
```

The GraphQL Yoga server and GraphiQL Playground will be live at:  
👉 **`http://localhost:4000/graphql`**

---

## 🧪 Test Suite Execution

The project includes a 100% database-backed automated test suite covering CRUD operations, availability checks, half-open boundaries, Relay keyset pagination, concurrency race conditions, and custom error HTTP status mappings.

To run the type check and test suite:

```bash
# Static Type Checking
bun x tsc --noEmit

# Run Full Test Suite
bun test
```

---

## 📋 Standardized Custom Error Taxonomy

| Error Code | HTTP Status | Description / Client Message |
| :--- | :---: | :--- |
| `RESOURCE_NOT_FOUND` | `404` | The requested meeting room or resource could not be found. |
| `BOOKING_NOT_FOUND` | `404` | The requested booking could not be found. |
| `INVALID_TIME_RANGE` | `400` | The start time of the booking must be earlier than the end time, and both dates must be valid. |
| `RESOURCE_UNAVAILABLE` | `409` | This meeting room is already reserved during the requested time slot. Please choose another time. |
| `BOOKING_ALREADY_CANCELLED` | `400` | This booking has already been cancelled. |
| `CONCURRENCY_CONFLICT` | `409` | Another booking request is being processed for this room at the same time. Please try again. |
| `INVALID_CURSOR` | `400` | The provided pagination cursor is invalid or malformed. |
| `RESOURCE_ALREADY_EXISTS` | `409` | A meeting room or resource with this name already exists. |

---

## 📜 License

MIT License. Designed and engineered for high-concurrency room booking requirements.
