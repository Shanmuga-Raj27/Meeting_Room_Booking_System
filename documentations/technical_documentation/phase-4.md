# Phase 4: Keyset Cursor Pagination & Data Access Optimization

This document outlines the architectural design, implementation details, and verification metrics for **Phase 4 (Keyset Cursor Pagination & Data Access Optimization)** of the Room Booking API. 

---

## Section 1: Keyset Pagination & Opaque Cursors

### 1.1 The "Why": Keyset Pagination vs. Offset Pagination
When building paginated APIs, developers typically start with offset-based pagination (using SQL's `LIMIT X OFFSET Y`). While simple, offset pagination degrades rapidly in performance as the offset $Y$ grows because the database must scan and discard $Y$ rows before returning the desired $X$ rows. Additionally, if items are inserted or deleted while a user is paginating, the offsets drift, causing items to be skipped or shown twice.

#### The Analogy: Flipping Pages vs. Book Index Search
*   **Offset Pagination (Flipped Pages)**: Imagine you are reading a 1,000-page book and want to read page 900. To get there, you are forced to count and flip through pages 1 to 899 one-by-one. If someone rips out page 10 while you are reading, your page count shifts, and you end up reading the wrong page.
*   **Keyset Pagination (Index Search)**: Imagine instead you remember the last sentence you read on page 899. You open the index, look up that exact sentence, and immediately jump to the next sentence (the keyset). It takes the same millisecond to find your spot whether you are on page 5 or page 995, and ripped-out pages elsewhere won't shift your search target.

In our system, bookings are ordered deterministically by the composite key `(startTime ASC, id ASC)`. The `startTime` orders bookings chronologically, and the `id` serves as a tie-breaker so that every booking's position is strictly unique.

### 1.2 Opaque Base64 Cursor Structure
To keep database-level keyset details hidden from API clients, the cursor is transmitted as a URL-safe Base64-encoded string. Internally, this decodes to a JSON object representing the keyset state of the last item returned on a page:

```json
{
  "startTime": "2026-10-01T09:00:00.000Z",
  "id": "bf4ea41c-627d-4df8-96f7-b5f0bbd69f50"
}
```

### 1.3 Cursor Decoding and Error Guarding (`INVALID_CURSOR`)
When a client requests a page using an `after` cursor, `BookingService.decodeCursor` parses and validates it. It performs three critical validation checks:
1. Ensure the cursor is a valid, decodeable Base64 string representing JSON.
2. Verify the decoded object contains both `startTime` (as a valid ISO timestamp string) and `id` (as a non-empty string).
3. Confirm that the `startTime` date can be successfully parsed into a valid JS `Date` object.

If any of these checks fail (e.g. malformed base64, missing properties, or invalid dates), the service immediately throws an `INVALID_CURSOR` exception. This is captured by our GraphQL Yoga error middleware and translated to a friendly HTTP 400 Bad Request error.

---

## Section 2: Database Seek Optimization & Index Alignment

### 2.1 Prisma Keyset Translation
When the pagination cursor is validated, the service translates the keyset values into a structured Prisma `OR` query to retrieve records that chronologically follow the cursor:

```typescript
whereClause.OR = [
  { startTime: { gt: afterStartTime } },
  { startTime: afterStartTime, id: { gt: afterId } }
];
```
This Prisma query maps directly to the following SQL equivalent:
```sql
WHERE "startTime" > $afterStartTime OR ("startTime" = $afterStartTime AND "id" > $afterId)
```

### 2.2 Index Range Seek Optimization
Because we pre-configured a composite index on the target columns in our Prisma schema:
```prisma
@@index([startTime, id])
```
PostgreSQL can perform a high-performance **index range scan** (seeking directly to the matching index record) instead of running a full table scan or wasting processing power skipping offsets. This makes data retrieval perform at $O(1)$ complexity, remaining highly scalable even with millions of rows.

### 2.3 Lookahead Strategy (`first + 1`)
To determine if a next page exists (`hasNextPage`) without executing an expensive `SELECT COUNT(*)` query, we fetch `first + 1` rows:
- If the database returns `first + 1` rows, we know there is a next page. We set `hasNextPage = true` and slice the extra lookahead item off before returning the data to the client.
- If it returns fewer than `first + 1` rows, we know we have reached the end. We set `hasNextPage = false` and return all fetched rows.
- The `totalCount` field is calculated based strictly on the original filters (`resourceId`, `status`) and is unaffected by the pagination boundaries.

---

## Section 3: Input Safety & Custom Error Handling

To transition database-level constraint violations and raw SQL errors into elegant API responses, we implemented robust pre-flight safety validations:

### 3.1 Duplicate Resource Name Guard (`RESOURCE_ALREADY_EXISTS`)
Because the resource `name` column has a unique constraint, attempting to create a resource with a duplicate name would throw a Prisma DB constraint error (`P2002`). Unchecked, this would crash the request and return a generic `INTERNAL_SERVER_ERROR`. 

We added a database check prior to creation in `ResourceService.createResource`:
```typescript
const existing = await prisma.resource.findUnique({ where: { name } });
if (existing) {
  throw new Error("RESOURCE_ALREADY_EXISTS");
}
```
This resolves the issue gracefully and returns a descriptive custom error message (HTTP 409).

### 3.2 UUID Input Safety Guard (`validateUuid`)
In PostgreSQL, querying a UUID column with a string that is not a valid UUID format (for example, `"not-a-uuid"`) triggers a syntax type error within Postgres. Because we lock resources inside database transactions using raw SQL (`FOR UPDATE`), passing a malformed UUID would cause the database layer to throw a query crash, resulting in a masked 500 error.

We introduced a strict UUID validation helper:
```typescript
private static validateUuid(id: string, errorName: "RESOURCE_NOT_FOUND" | "BOOKING_NOT_FOUND"): void {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || !UUID_REGEX.test(id)) {
    throw new Error(errorName);
  }
}
```
All resource IDs and booking IDs are pre-validated before any query execution. If the UUID is malformed, the system intercepts the request early and returns a clean `RESOURCE_NOT_FOUND` (404) or `BOOKING_NOT_FOUND` (404) error.

---

## Section 4: Test Coverage & Verification Evidence

We wrote comprehensive tests in `backend/tests/pagination.test.ts` to prove that the keyset pagination engine is mathematically sound, robust, and Relay-compliant.

### 4.1 Integration Test Matrix
*   **Test 1 (Page 1 Pagination)**: Asserts that querying `first: 2` returns the first two chronological bookings and indicates `hasNextPage: true`.
*   **Test 2 (Page 2 Continuation)**: Asserts that passing the `endCursor` from Page 1 returns the next two bookings chronologically.
*   **Test 3 (Boundaries & Final Page)**: Asserts that when the last page is fetched, `hasNextPage` becomes `false`.
*   **Test 4 (Opaque Cursor Format)**: Asserts that the returned cursor successfully decodes into valid JSON matching the exact resource keys.
*   **Test 5 (Malformed Cursors)**: Asserts that passing corrupted cursor strings correctly throws `INVALID_CURSOR`.
*   **Test 6 (GraphQL E2E Connectivity)**: Verifies that Relay-structured connection payloads can be retrieved successfully via GraphQL HTTP interface.
*   **Test 7 (E2E Error Formatting)**: Verifies that passing a malformed cursor to the GraphQL endpoint returns a formatted GraphQL custom error with HTTP status 400.

### 4.2 Test Verification Run
All tests pass successfully under Bun's native test runner with **zero TypeScript errors**:

```text
D:\Meeting_Room_Booking_System\backend> bun test

tests\booking.test.ts:
✓ 1. Time Range Validation: Reject invalid startTime >= endTime
✓ 2. Half-Open Interval Overlap: Reject overlapping booking
✓ 3. Half-Open Interval Boundary: Allow back-to-back bookings
✓ 4. Cancelled Booking Exclusion: Free up time slot when booking is cancelled
✓ 5. Rescheduling Logic: Self-exclusion allows moving booking within open or same slot
✓ 6. Cancellation & Double Cancel Guard
✓ 7. Hard Deletion
✓ 8. Check Availability Query

tests\concurrency.test.ts:
✓ Concurrent double-booking race condition: exactly 1 succeeds, 1 fails

tests\graphql.test.ts:
✓ 1. Overlapping booking returns user-friendly RESOURCE_UNAVAILABLE message and code
✓ 2. Cancelling non-existent booking returns user-friendly BOOKING_NOT_FOUND error

tests\pagination.test.ts:
✓ 1. Forward Pagination Page 1: Retrieve first 2 records and verify pageInfo
✓ 2. Forward Pagination Page 2: Retrieve next 2 records using after cursor
✓ 3. Final Page & Boundaries: Retrieve remaining records where hasNextPage becomes false
✓ 4. Opaque Base64 Cursor Format: Cursor decodes to JSON with startTime and id
✓ 5. Malformed Cursor Error: Throw INVALID_CURSOR on corrupted base64 or invalid structure
✓ 6. GraphQL E2E Connection Query: Verify Relay schema compliance and HTTP status
✓ 7. GraphQL E2E Malformed Cursor Error: Verify INVALID_CURSOR HTTP 400 response

 18 pass
 0 fail
 57 expect() calls
Ran 18 tests across 4 files. [677.00ms]
```
