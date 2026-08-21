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
});
