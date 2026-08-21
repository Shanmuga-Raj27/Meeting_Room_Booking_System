# Technical Documentation - Phase 2 Backend API & Concurrency Protection Layer

---

## 1. Overview & Architecture

Phase 2 focuses on building the full GraphQL backend application inside the `backend/app/` directory. The goal is to construct a modular, high-performance, and concurrency-safe room booking API using **Bun**, **TypeScript**, **GraphQL Yoga v5**, and **Prisma ORM v7** with **PostgreSQL**.

### Key Architectural Goals
1. **Layered Separation**: Strict separation of concerns between GraphQL HTTP Resolvers, Business Domain Services, Database Data Access, and Schema Contracts.
2. **Schema-First GraphQL**: Defining type contracts using schema `.graphql` files rather than code-first inline objects.
3. **Concurrency Safety**: Protecting room reservations against race conditions (double-bookings under simultaneous requests) using PostgreSQL row-level locks.
4. **Relay Keyset Pagination**: Implementing cursor-based pagination for high-performance timeline querying without slow database offsets.

### System Data Flow Architecture

```text
┌──────────────────────────┐
│  GraphQL Client / Yoga   │  (Receives HTTP POST requests at /graphql)
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   GraphQL Resolvers      │  (Thin mapping layer: app/graphql/resolvers/)
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Domain Services        │  (Business logic & concurrency locks: app/services/)
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Prisma ORM & Driver    │  (Database abstraction: app/database/prisma.ts)
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   PostgreSQL Database    │  (Transactional storage & row-level FOR UPDATE locking)
└──────────────────────────┘
```

### Technology Stack Specifications
- **Runtime**: Bun (`Bun.serve` HTTP server executing native TypeScript)
- **Language**: TypeScript in Strict Compiler Mode (`tsconfig.json`)
- **API Server**: GraphQL Yoga (v5.22.0) with custom `DateTime` scalar support
- **ORM**: Prisma ORM (v7.9.1)
- **Database Driver Adapter**: `@prisma/adapter-pg` with `pg` Pool (`v8.23.0`)
- **Database**: PostgreSQL with enum types and covering composite indexes

---

## 2. Environment & Driver Adapter Configuration

### 2.1 Package Script Modifications (`package.json`)
The development script in `backend/package.json` was updated to point directly to the application entrypoint inside `backend/app/`:
```json
{
  "scripts": {
    "dev": "bun --watch app/index.ts",
    "db:migrate": "prisma migrate dev",
    "test": "bun test"
  }
}
```

### 2.2 Prisma 7 Database Connection Architecture (`app/database/prisma.ts`)
In **Prisma v7**, static database connection URLs inside `schema.prisma` have been deprecated in favor of dynamic runtime driver adapters. To connect to PostgreSQL cleanly in Bun/Node environments, the application instantiates a native PostgreSQL connection pool via `pg` and wraps it with `@prisma/adapter-pg`.

```typescript
// backend/app/database/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

// 1. Create a native PostgreSQL pool connection using the DATABASE_URL secret
const pool = new Pool({ connectionString });

// 2. Wrap the pool in Prisma 7's PostgreSQL driver adapter
const adapter = new PrismaPg(pool);

// 3. Export a singleton PrismaClient instance for the application lifecycle
export const prisma = new PrismaClient({ adapter });
```

> **Why a Singleton?** Creating multiple `PrismaClient` instances across different files can exhaust PostgreSQL database connection pools. Exporting a single `prisma` instance guarantees optimal connection reuse.

---

## 3. Schema-First GraphQL Specifications (`app/graphql/schemas/`)

The API contracts are defined cleanly using schema-first `.graphql` files stored in `backend/app/graphql/schemas/`.

### 3.1 Resource Schema (`schemas/resource.graphql`)
Defines physical meeting room resources and their capacities:
```graphql
scalar DateTime

type Resource {
  id: ID!
  name: String!
  capacity: Int!
  createdAt: DateTime!
  bookings: [Booking!]!
}

type Query {
  resources: [Resource!]!
  resource(id: ID!): Resource
}

type Mutation {
  createResource(name: String!, capacity: Int!): Resource!
}
```

### 3.2 Booking Schema (`schemas/booking.graphql`)
Defines booking status enums, availability check payloads, and mutations for reserving, rescheduling, cancelling, and deleting bookings:
```graphql
enum BookingStatus {
  CONFIRMED
  CANCELLED
}

type Booking {
  id: ID!
  title: String!
  startTime: DateTime!
  endTime: DateTime!
  status: BookingStatus!
  resourceId: String!
  resource: Resource!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type AvailabilityResult {
  available: Boolean!
  resourceId: ID!
  startTime: DateTime!
  endTime: DateTime!
}

extend type Query {
  bookings(resourceId: String, status: BookingStatus, first: Int, after: String): BookingConnection!
  availability(resourceId: ID!, startTime: DateTime!, endTime: DateTime!): AvailabilityResult!
}

extend type Mutation {
  createBooking(title: String!, startTime: DateTime!, endTime: DateTime!, resourceId: ID!): Booking!
  rescheduleBooking(id: ID!, startTime: DateTime!, endTime: DateTime!): Booking!
  cancelBooking(id: ID!): Booking!
  deleteBooking(id: ID!): Booking!
}
```

### 3.3 Pagination Schema (`schemas/pagination.graphql`)
Implements the standardized **Relay Cursor Connection Specification** for cursor pagination:
```graphql
type PageInfo {
  hasNextPage: Boolean!
  endCursor: String
}

type BookingEdge {
  cursor: String!
  node: Booking!
}

type BookingConnection {
  edges: [BookingEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}
```

---

## 4. Domain Service Layer & Business Rules (`app/services/`)

The service layer contains all business logic, range validation, collision checks, and database transaction controls, keeping GraphQL resolvers completely decoupled from database internals.

### 4.1 Resource Service (`services/resource.service.ts`)
Manages CRUD operations for meeting room resources:
- `createResource(name, capacity)`: Validates that capacity is greater than 0 and inserts the resource.
- `getResources()`: Lists all resources sorted by creation date descending.
- `getResourceById(id)`: Fetches a single resource including its associated bookings.

---

### 4.2 Booking Service & Business Logic (`services/booking.service.ts`)

#### Rule 1: Time Window Validation
Before querying the database, all booking operations enforce:
$$\text{startTime} < \text{endTime}$$
If $\text{startTime} \ge \text{endTime}$, the service immediately throws `INVALID_TIME_RANGE`.

#### Rule 2: Half-Open Interval Overlap Formula `[startTime, endTime)`
Booking time ranges operate as half-open intervals:
$$[\text{startTime}, \text{endTime})$$

An existing `CONFIRMED` booking conflicts with a requested time window $(\text{newStart}, \text{newEnd})$ for the same resource if and only if:
$$\text{existing.startTime} < \text{newEnd} \quad \text{AND} \quad \text{existing.endTime} > \text{newStart}$$

```text
Existing Booking:   [10:00 ──────────────────── 11:00)
New Request A:                 [10:30 ──────────────────── 11:30)   ❌ CONFLICT (10:00 < 11:30 AND 11:00 > 10:30)
New Request B:                                            [11:00 ────────── 12:00)   ✅ ALLOWED (Back-to-back: 11:00 < 11:00 is FALSE)
```

- **Back-to-Back Bookings Allowed**: Request B starting at 11:00 does not conflict with a booking ending at 11:00.
- **Cancelled Exclusion**: Bookings with status `CANCELLED` are ignored during overlap validation, releasing the time slot immediately.

---

#### Rule 3: Concurrency Protection Engine (Resource-Level Row Locking)

##### The Problem: Race Conditions & Phantom Reads
If two users issue simultaneous booking requests for the exact same open room at 10:00–11:00:
1. User A checks DB for overlapping bookings $\rightarrow$ Finds 0 rows.
2. User B checks DB for overlapping bookings $\rightarrow$ Finds 0 rows.
3. User A inserts a booking $\rightarrow$ Success.
4. User B inserts a booking $\rightarrow$ Success.
5. **Result: DOUBLE-BOOKING BUG!**

> **Why Locking Booking Rows Fails (Phantom Reads):**
> If you try to run `SELECT ... FROM "Booking" WHERE ... FOR UPDATE`, PostgreSQL can only lock rows that **already exist**. When a time slot is completely unbooked, the query returns 0 rows. In PostgreSQL, locking 0 rows acquires **zero locks**. Thus, both concurrent requests acquire no lock, see an empty slot, and both insert conflicting bookings.

##### The Solution: Resource-Level Write Lock
To prevent this, every write mutation (`createBooking`, `rescheduleBooking`) locks the parent `Resource` row inside a PostgreSQL interactive transaction (`prisma.$transaction`) before checking overlaps:

```text
Request A (Thread 1) ────────┐
                             ├──> PostgreSQL Transaction ($transaction)
Request B (Thread 2) ────────┘    1. SELECT "id" FROM "Resource" WHERE "id" = $1 FOR UPDATE
                                  2. Check Overlap Formula against current DB state
                                  3. INSERT Booking (if clear) or ABORT (if conflict)
```

```typescript
// Code Snippet from app/services/booking.service.ts
return prisma.$transaction(
  async (tx: Prisma.TransactionClient) => {
    // 1. Lock the target Resource row to serialize concurrent writes on this room
    const resources = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Resource" WHERE "id" = ${resourceId} FOR UPDATE
    `;

    if (!resources || resources.length === 0) {
      throw new Error("RESOURCE_NOT_FOUND");
    }

    // 2. Check for overlapping CONFIRMED bookings under the lock
    const hasOverlap = await this.checkOverlap(tx, resourceId, startTime, endTime);
    if (hasOverlap) {
      throw new Error("RESOURCE_UNAVAILABLE");
    }

    // 3. Safe insertion
    return tx.booking.create({
      data: {
        title,
        startTime,
        endTime,
        status: BookingStatus.CONFIRMED,
        resourceId,
      },
    });
  },
  { timeout: 10000 }
);
```

**How It Works:**
When Request A issues `SELECT ... FOR UPDATE` on Resource ID `R1`, PostgreSQL locks that Resource row. When Request B tries to run `SELECT ... FOR UPDATE` on Resource ID `R1`, PostgreSQL forces Request B to **wait** until Request A's transaction completes. When Request B unblocks, Request A's booking is already saved in the database. Request B evaluates the overlap check, sees Request A's booking, and gets safely rejected with `RESOURCE_UNAVAILABLE`.

---

#### Rule 4: Availability Lookup (`checkAvailability`)
Evaluates whether a room is free for a given time window without acquiring write locks:
- Enforces `startTime < endTime`.
- Confirms the resource exists in the database.
- Checks `checkOverlap(prisma, resourceId, startTime, endTime)`.
- Returns `{ available: boolean, resourceId, startTime, endTime }`.

---

#### Rule 5: Rescheduling & Cancellation Workflows
- **`rescheduleBooking(id, startTime, endTime)`**:
  - Finds the existing booking.
  - Locks the target resource row (`SELECT ... FOR UPDATE`).
  - Checks for overlapping `CONFIRMED` bookings **excluding the current booking ID** (`excludeBookingId: id`).
  - Updates `startTime`, `endTime`, and ensures status is set to `CONFIRMED`.
- **`cancelBooking(id)`**:
  - Validates that the booking exists and is not already `CANCELLED`.
  - Updates `status` to `CANCELLED` (liberates the slot for future bookings while preserving historical logs).
- **`deleteBooking(id)`**: Permanently removes the booking record.

---

## 5. Keyset Cursor-Based Pagination Implementation

To support scalable frontend feed scrolling without performance degradation, `getBookings` implements Relay-style **Keyset Cursor Pagination**.

### 5.1 Keyset Composite Ordering & Index Support
Bookings are ordered deterministically by:
$$(\text{startTime ASC}, \text{id ASC})$$
This query directly leverages the covering composite index defined in `schema.prisma`:
`@@index([startTime, id])`

### 5.2 Opaque Cursor Encoding & Decoding
Cursors are base64-encoded JSON strings containing the boundary record's values:
```typescript
// Cursor Payload Example: {"startTime":"2026-08-25T10:00:00.000Z","id":"uuid-string"}
// Encoded Base64: "eyJzdGFydFRpbWUiOiIyMDI2LTA4LTI1VDEwOjAwOjAwLjAwMFoiLCJpZCI6InV1aWQtc3RyaW5nIn0="
```

### 5.3 Keyset Query Translation
When a client requests items `after: cursor`, the service translates the cursor into a database keyset clause using Prisma `OR`:

```typescript
if (args.after) {
  const { startTime: afterStartTimeStr, id: afterId } = this.decodeCursor(args.after);
  const afterStartTime = new Date(afterStartTimeStr);

  whereClause.OR = [
    { startTime: { gt: afterStartTime } },
    { startTime: afterStartTime, id: { gt: afterId } },
  ];
}
```

### 5.4 PageInfo & Count Computation
To determine `hasNextPage` without executing an extra SQL `COUNT`, the service queries `take: limit + 1`:
```typescript
const bookings = await prisma.booking.findMany({
  where: whereClause,
  orderBy: [{ startTime: "asc" }, { id: "asc" }],
  take: limit + 1,
});

const hasNextPage = bookings.length > limit;
const items = hasNextPage ? bookings.slice(0, limit) : bookings;
const totalCount = await prisma.booking.count({ where: countWhere });
```

---

## 6. Resolvers & Server Entrypoint

### 6.1 Resolver Delegators (`app/graphql/resolvers/`)
Resolvers are kept thin and only handle payload delegation and date object conversions:

- **`resource.resolver.ts`**: Maps `Query.resources`, `Query.resource`, `Mutation.createResource`, and nested field `Resource.bookings`.
- **`booking.resolver.ts`**: Converts date strings to JavaScript `Date` objects and maps `Query.bookings`, `Query.availability`, `Mutation.createBooking`, `Mutation.rescheduleBooking`, `Mutation.cancelBooking`, `Mutation.deleteBooking`, and nested field `Booking.resource`.
- **`index.ts`**: Combines resolvers and defines the GraphQL `DateTime` custom scalar parser/serializer:

```typescript
// backend/app/graphql/resolvers/index.ts
import { GraphQLScalarType, Kind } from "graphql";
import { resourceResolvers } from "./resource.resolver";
import { bookingResolvers } from "./booking.resolver";

const dateTimeScalar = new GraphQLScalarType({
  name: "DateTime",
  description: "DateTime custom scalar type for ISO 8601 strings",
  serialize(value: any) {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  },
  parseValue(value: any) {
    return new Date(value);
  },
  parseLiteral(ast) {
    return ast.kind === Kind.STRING ? new Date(ast.value) : null;
  },
});

export const resolvers = {
  DateTime: dateTimeScalar,
  Query: { ...resourceResolvers.Query, ...bookingResolvers.Query },
  Mutation: { ...resourceResolvers.Mutation, ...bookingResolvers.Mutation },
  Resource: { ...resourceResolvers.Resource },
  Booking: { ...bookingResolvers.Booking },
};
```

---

### 6.2 Application Entrypoint (`app/index.ts`)
Loads schema files using native `Bun.file`, instantiates GraphQL Yoga, and starts the server via `Bun.serve`:

```typescript
// backend/app/index.ts
import { createSchema, createYoga } from "graphql-yoga";
import { resolvers } from "./graphql/resolvers";
import path from "path";

const currentDir = import.meta.dir;

// 1. Load schema files asynchronously using Bun native file APIs
const resourceSchema = await Bun.file(path.join(currentDir, "graphql/schemas/resource.graphql")).text();
const bookingSchema = await Bun.file(path.join(currentDir, "graphql/schemas/booking.graphql")).text();
const paginationSchema = await Bun.file(path.join(currentDir, "graphql/schemas/pagination.graphql")).text();

// 2. Compile schema and resolvers
const schema = createSchema({
  typeDefs: [resourceSchema, bookingSchema, paginationSchema],
  resolvers,
});

// 3. Instantiate GraphQL Yoga server container
const yoga = createYoga({
  schema,
  graphqlEndpoint: "/graphql",
  landingPage: true,
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

// 4. Start HTTP Server using native Bun.serve
Bun.serve({
  port,
  fetch: (request) => yoga.handle(request),
});

console.log(`Room Booking API Server is running at http://localhost:${port}/graphql`);
```

---

## 7. Verification & Operational Status

### 7.1 Static Type Check Verification
The entire Phase 2 backend codebase operates under strict TypeScript compiler rules. Running the type checker verifies zero compilation errors:
```bash
bun x tsc --noEmit
# Exit Code: 0 (Passed with 0 errors)
```

### 7.2 Development Server Verification
Running `bun run dev` boots the server in watch mode:
```text
$ bun --watch app/index.ts
Room Booking API Server is running at http://localhost:4000/graphql
```

### 7.3 Summary Checklist
- [x] Layered architecture implemented in `backend/app/`.
- [x] Prisma 7 dynamic driver adapter configured with `@prisma/adapter-pg`.
- [x] Schema-first GraphQL schemas loaded and resolved.
- [x] Half-open interval collision validation `[startTime, endTime)` enforced.
- [x] Resource-level PostgreSQL row locking (`SELECT ... FOR UPDATE`) implemented for concurrency safety.
- [x] Keyset cursor pagination operational with Base64 tokens.
- [x] Standardized custom error taxonomy & GraphQL Yoga error masking integrated.
- [x] Server running and verified on `http://localhost:4000/graphql`.

---

## 8. Standardized Custom Error System & Robustness

To ensure uniform client error responses across all GraphQL mutations and queries, custom application errors are centrally mapped in `backend/app/graphql/errors.ts` and masked by GraphQL Yoga middleware in `backend/app/index.ts`.

### 8.1 Custom Error Hierarchy Taxonomy

| Error Code | HTTP Status | Description / Client Message | Trigger Condition |
| :--- | :--- | :--- | :--- |
| `RESOURCE_NOT_FOUND` | 404 | "The requested meeting room or resource could not be found." | Resource ID does not exist or invalid UUID format |
| `BOOKING_NOT_FOUND` | 404 | "The requested booking could not be found." | Booking ID does not exist or invalid UUID format |
| `INVALID_TIME_RANGE` | 400 | "The start time of the booking must be earlier than the end time, and both dates must be valid." | `startTime >= endTime` or invalid date string |
| `RESOURCE_UNAVAILABLE` | 409 | "This meeting room is already reserved during the requested time slot. Please choose another time." | Requested window overlaps with an existing `CONFIRMED` booking |
| `BOOKING_ALREADY_CANCELLED` | 400 | "This booking has already been cancelled." | Attempting to cancel an already `CANCELLED` booking |
| `CONCURRENCY_CONFLICT` | 409 | "Another booking request is being processed for this room at the same time. Please try again." | Transaction lock timeout or serialization conflict |
| `INVALID_CURSOR` | 400 | "The provided pagination cursor is invalid or malformed." | Corrupted or malformed base64 pagination cursor |
| `RESOURCE_ALREADY_EXISTS` | 409 | "A meeting room or resource with this name already exists." | Attempting to create a resource with duplicate name |

### 8.2 GraphQL Yoga Error Masking Integration (`app/index.ts`)

```typescript
export const yoga = createYoga({
  schema,
  graphqlEndpoint: "/graphql",
  landingPage: true,
  maskedErrors: {
    maskError(error: any, message: string, isDev?: boolean) {
      const originalError = error.originalError || error;
      const errorKey = originalError?.message;

      if (errorKey && ERROR_MAP[errorKey]) {
        const mapped = ERROR_MAP[errorKey];
        return createGraphQLError(mapped.message, {
          extensions: {
            code: mapped.code,
            http: { status: mapped.status },
          },
        });
      }

      if (
        originalError?.code === "P2028" ||
        (typeof originalError?.message === "string" &&
          (originalError.message.includes("Transaction timed out") ||
            originalError.message.includes("lock timeout")))
      ) {
        const mapped = ERROR_MAP.CONCURRENCY_CONFLICT;
        return createGraphQLError(mapped.message, {
          extensions: {
            code: mapped.code,
            http: { status: mapped.status },
          },
        });
      }

      return createGraphQLError("An unexpected error occurred. Please try again later.", {
        extensions: {
          code: "INTERNAL_SERVER_ERROR",
          http: { status: 500 },
        },
      });
    },
  },
});
```

