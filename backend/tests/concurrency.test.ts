import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { prisma } from "../app/database/prisma";
import { BookingService } from "../app/services/booking.service";
import { ResourceService } from "../app/services/resource.service";

describe("Phase 3 - Concurrency Protection Engine", () => {
  let resourceId: string;

  beforeAll(async () => {
    await prisma.booking.deleteMany();
    await prisma.resource.deleteMany();

    const resource = await ResourceService.createResource("Concurrent Room Beta", 8);
    resourceId = resource.id;
  });

  afterAll(async () => {
    await prisma.booking.deleteMany();
    await prisma.resource.deleteMany();
    await prisma.$disconnect();
  });

  test("Concurrent double-booking race condition: exactly 1 succeeds, 1 fails", async () => {
    const start = new Date("2026-09-05T10:00:00Z");
    const end = new Date("2026-09-05T11:00:00Z");

    // Execute 2 simultaneous creation attempts for the exact same slot
    const results = await Promise.allSettled([
      BookingService.createBooking("Concurrent Request A", start, end, resourceId),
      BookingService.createBooking("Concurrent Request B", start, end, resourceId),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Verify DB contains exactly 1 booking for this time slot
    const count = await prisma.booking.count({
      where: {
        resourceId,
        startTime: start,
        endTime: end,
      },
    });

    expect(count).toBe(1);
  });
});
