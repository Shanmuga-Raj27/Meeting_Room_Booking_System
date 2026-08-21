import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { prisma } from "../app/database/prisma";
import { BookingService } from "../app/services/booking.service";
import { ResourceService } from "../app/services/resource.service";
import { yoga } from "../app/index";

describe("Phase 4 - Keyset Cursor Pagination & Data Access Optimization", () => {
  let resourceId1: string;
  let resourceId2: string;
  const bookingIds: string[] = [];

  beforeAll(async () => {
    await prisma.booking.deleteMany();
    await prisma.resource.deleteMany();

    const room1 = await ResourceService.createResource("Pagination Room Alpha", 12);
    const room2 = await ResourceService.createResource("Pagination Room Beta", 6);
    resourceId1 = room1.id;
    resourceId2 = room2.id;

    // Seed 5 bookings in room1 with distinct start times
    const b1 = await BookingService.createBooking(
      "Booking 1",
      new Date("2026-10-01T09:00:00Z"),
      new Date("2026-10-01T10:00:00Z"),
      resourceId1
    );
    const b2 = await BookingService.createBooking(
      "Booking 2",
      new Date("2026-10-01T10:00:00Z"),
      new Date("2026-10-01T11:00:00Z"),
      resourceId1
    );
    const b3 = await BookingService.createBooking(
      "Booking 3",
      new Date("2026-10-01T11:00:00Z"),
      new Date("2026-10-01T12:00:00Z"),
      resourceId1
    );
    const b4 = await BookingService.createBooking(
      "Booking 4",
      new Date("2026-10-01T12:00:00Z"),
      new Date("2026-10-01T13:00:00Z"),
      resourceId1
    );
    const b5 = await BookingService.createBooking(
      "Booking 5",
      new Date("2026-10-01T13:00:00Z"),
      new Date("2026-10-01T14:00:00Z"),
      resourceId1
    );

    // Seed 1 booking in room2
    const b6 = await BookingService.createBooking(
      "Booking Room 2",
      new Date("2026-10-01T09:30:00Z"),
      new Date("2026-10-01T10:30:00Z"),
      resourceId2
    );

    bookingIds.push(b1.id, b2.id, b3.id, b4.id, b5.id, b6.id);
  });

  afterAll(async () => {
    await prisma.booking.deleteMany();
    await prisma.resource.deleteMany();
    await prisma.$disconnect();
  });

  test("1. Forward Pagination Page 1: Retrieve first 2 records and verify pageInfo", async () => {
    const res = await BookingService.getBookings({
      resourceId: resourceId1,
      first: 2,
    });

    expect(res.edges.length).toBe(2);
    expect(res.pageInfo.hasNextPage).toBe(true);
    expect(res.pageInfo.endCursor).toBeDefined();
    expect(res.totalCount).toBe(5);
    expect(res.edges[0]!.node.title).toBe("Booking 1");
    expect(res.edges[1]!.node.title).toBe("Booking 2");
  });

  test("2. Forward Pagination Page 2: Retrieve next 2 records using after cursor", async () => {
    const page1 = await BookingService.getBookings({
      resourceId: resourceId1,
      first: 2,
    });

    const cursor = page1.pageInfo.endCursor;
    expect(cursor).not.toBeNull();

    const page2 = await BookingService.getBookings({
      resourceId: resourceId1,
      first: 2,
      after: cursor,
    });

    expect(page2.edges.length).toBe(2);
    expect(page2.pageInfo.hasNextPage).toBe(true);
    expect(page2.totalCount).toBe(5);
    expect(page2.edges[0]!.node.title).toBe("Booking 3");
    expect(page2.edges[1]!.node.title).toBe("Booking 4");
  });

  test("3. Final Page & Boundaries: Retrieve remaining records where hasNextPage becomes false", async () => {
    const page1 = await BookingService.getBookings({
      resourceId: resourceId1,
      first: 4,
    });

    const cursor = page1.pageInfo.endCursor;

    const lastPage = await BookingService.getBookings({
      resourceId: resourceId1,
      first: 2,
      after: cursor,
    });

    expect(lastPage.edges.length).toBe(1);
    expect(lastPage.pageInfo.hasNextPage).toBe(false);
    expect(lastPage.totalCount).toBe(5);
    expect(lastPage.edges[0]!.node.title).toBe("Booking 5");
  });

  test("4. Opaque Base64 Cursor Format: Cursor decodes to JSON with startTime and id", async () => {
    const res = await BookingService.getBookings({
      resourceId: resourceId1,
      first: 1,
    });

    const rawCursor = res.edges[0]!.cursor;
    const jsonStr = Buffer.from(rawCursor, "base64").toString("utf-8");
    const parsed = JSON.parse(jsonStr);

    expect(parsed.startTime).toBeDefined();
    expect(parsed.id).toBe(res.edges[0]!.node.id);
  });

  test("5. Malformed Cursor Error: Throw INVALID_CURSOR on corrupted base64 or invalid structure", async () => {
    // Completely invalid string
    expect(
      BookingService.getBookings({ first: 2, after: "not-a-valid-base64-json" })
    ).rejects.toThrow("INVALID_CURSOR");

    // Valid Base64 JSON but missing id
    const invalidJsonCursor = Buffer.from(JSON.stringify({ startTime: "2026-10-01T09:00:00Z" })).toString("base64");
    expect(
      BookingService.getBookings({ first: 2, after: invalidJsonCursor })
    ).rejects.toThrow("INVALID_CURSOR");
  });

  test("6. GraphQL E2E Connection Query: Verify Relay schema compliance and HTTP status", async () => {
    const response = await yoga.handle(
      new Request("http://localhost/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            query GetBookings($resourceId: String, $first: Int) {
              bookings(resourceId: $resourceId, first: $first) {
                totalCount
                pageInfo {
                  hasNextPage
                  endCursor
                }
                edges {
                  cursor
                  node {
                    id
                    title
                    startTime
                    endTime
                    status
                  }
                }
              }
            }
          `,
          variables: { resourceId: resourceId1, first: 3 },
        }),
      })
    );

    expect(response.status).toBe(200);
    const body: any = await response.json();
    expect(body.errors).toBeUndefined();
    const data = body.data.bookings;
    expect(data.totalCount).toBe(5);
    expect(data.edges.length).toBe(3);
    expect(data.pageInfo.hasNextPage).toBe(true);
    expect(data.pageInfo.endCursor).toBeDefined();
  });

  test("7. GraphQL E2E Malformed Cursor Error: Verify INVALID_CURSOR HTTP 400 response", async () => {
    const response = await yoga.handle(
      new Request("http://localhost/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            query GetBookingsWithBadCursor {
              bookings(first: 2, after: "invalid_cursor_payload!!!") {
                totalCount
              }
            }
          `,
        }),
      })
    );

    expect(response.status).toBe(400);
    const body: any = await response.json();
    expect(body.errors).toBeDefined();
    expect(body.errors[0].extensions.code).toBe("INVALID_CURSOR");
    expect(body.errors[0].message).toBe(
      "The provided pagination cursor is invalid or malformed."
    );
  });
});
