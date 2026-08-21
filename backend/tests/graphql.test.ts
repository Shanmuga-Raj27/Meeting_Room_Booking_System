import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { prisma } from "../app/database/prisma";
import { ResourceService } from "../app/services/resource.service";
import { BookingService } from "../app/services/booking.service";
import { yoga } from "../app/index";

describe("GraphQL E2E - Custom Error Handling", () => {
  let resourceId: string;

  beforeAll(async () => {
    await prisma.booking.deleteMany();
    await prisma.resource.deleteMany();

    const resource = await ResourceService.createResource("Boardroom E2E", 10);
    resourceId = resource.id;
  });

  afterAll(async () => {
    await prisma.booking.deleteMany();
    await prisma.resource.deleteMany();
    await prisma.$disconnect();
  });

  test("1. Overlapping booking returns user-friendly RESOURCE_UNAVAILABLE message and code", async () => {
    const start = new Date("2026-09-10T10:00:00Z");
    const end = new Date("2026-09-10T11:00:00Z");
    await BookingService.createBooking("Project Kickoff", start, end, resourceId);

    const response = await yoga.handle(
      new Request("http://localhost/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation CreateBooking($resourceId: ID!) {
              createBooking(
                title: "Overlapping Sync"
                startTime: "2026-09-10T10:30:00.000Z"
                endTime: "2026-09-10T11:30:00.000Z"
                resourceId: $resourceId
              ) {
                id
              }
            }
          `,
          variables: { resourceId },
        }),
      })
    );

    const result: any = await response.json();
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].message).toBe(
      "This meeting room is already reserved during the requested time slot. Please choose another time."
    );
    expect(result.errors[0].extensions?.code).toBe("RESOURCE_UNAVAILABLE");
    expect(response.status).toBe(409);
  });

  test("2. Cancelling non-existent booking returns user-friendly BOOKING_NOT_FOUND error", async () => {
    const response = await yoga.handle(
      new Request("http://localhost/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation CancelBooking {
              cancelBooking(id: "00000000-0000-0000-0000-000000000000") {
                id
              }
            }
          `,
        }),
      })
    );

    const result: any = await response.json();
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].message).toBe("The requested booking could not be found.");
    expect(result.errors[0].extensions?.code).toBe("BOOKING_NOT_FOUND");
    expect(response.status).toBe(404);
  });

  test("3. Booking non-existent resource returns RESOURCE_NOT_FOUND error (404)", async () => {
    const response = await yoga.handle(
      new Request("http://localhost/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation CreateBookingForMissingResource {
              createBooking(
                title: "Ghost Room"
                startTime: "2026-09-10T14:00:00.000Z"
                endTime: "2026-09-10T15:00:00.000Z"
                resourceId: "00000000-0000-0000-0000-000000000000"
              ) {
                id
              }
            }
          `,
        }),
      })
    );

    const result: any = await response.json();
    expect(result.errors).toBeDefined();
    expect(result.errors[0].extensions?.code).toBe("RESOURCE_NOT_FOUND");
    expect(result.errors[0].message).toBe("The requested meeting room or resource could not be found.");
    expect(response.status).toBe(404);
  });

  test("4. Invalid startTime >= endTime returns INVALID_TIME_RANGE error (400)", async () => {
    const response = await yoga.handle(
      new Request("http://localhost/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation CreateBookingBadTime($resourceId: ID!) {
              createBooking(
                title: "Time Travel Meeting"
                startTime: "2026-09-10T15:00:00.000Z"
                endTime: "2026-09-10T14:00:00.000Z"
                resourceId: $resourceId
              ) {
                id
              }
            }
          `,
          variables: { resourceId },
        }),
      })
    );

    const result: any = await response.json();
    expect(result.errors).toBeDefined();
    expect(result.errors[0].extensions?.code).toBe("INVALID_TIME_RANGE");
    expect(result.errors[0].message).toBe(
      "The start time of the booking must be earlier than the end time, and both dates must be valid."
    );
    expect(response.status).toBe(400);
  });

  test("5. Cancelling an already cancelled booking returns BOOKING_ALREADY_CANCELLED error (400)", async () => {
    const start = new Date("2026-09-20T10:00:00Z");
    const end = new Date("2026-09-20T11:00:00Z");
    const booking = await BookingService.createBooking("To Be Cancelled", start, end, resourceId);
    await BookingService.cancelBooking(booking.id);

    const response = await yoga.handle(
      new Request("http://localhost/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation CancelTwice($id: ID!) {
              cancelBooking(id: $id) {
                id
              }
            }
          `,
          variables: { id: booking.id },
        }),
      })
    );

    const result: any = await response.json();
    expect(result.errors).toBeDefined();
    expect(result.errors[0].extensions?.code).toBe("BOOKING_ALREADY_CANCELLED");
    expect(result.errors[0].message).toBe("This booking has already been cancelled.");
    expect(response.status).toBe(400);
  });

  test("6. Duplicate resource creation returns RESOURCE_ALREADY_EXISTS error (409)", async () => {
    const response = await yoga.handle(
      new Request("http://localhost/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation CreateDuplicateResource {
              createResource(name: "Boardroom E2E", capacity: 20) {
                id
              }
            }
          `,
        }),
      })
    );

    const result: any = await response.json();
    expect(result.errors).toBeDefined();
    expect(result.errors[0].extensions?.code).toBe("RESOURCE_ALREADY_EXISTS");
    expect(result.errors[0].message).toBe("A meeting room or resource with this name already exists.");
    expect(response.status).toBe(409);
  });

  test("7. Querying bookings with malformed cursor returns INVALID_CURSOR error (400)", async () => {
    const response = await yoga.handle(
      new Request("http://localhost/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            query BadCursorQuery {
              bookings(first: 5, after: "malformed_cursor_data_123") {
                totalCount
              }
            }
          `,
        }),
      })
    );

    const result: any = await response.json();
    expect(result.errors).toBeDefined();
    expect(result.errors[0].extensions?.code).toBe("INVALID_CURSOR");
    expect(result.errors[0].message).toBe("The provided pagination cursor is invalid or malformed.");
    expect(response.status).toBe(400);
  });
});
