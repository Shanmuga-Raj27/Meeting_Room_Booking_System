import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { prisma } from "../app/database/prisma";
import { BookingService } from "../app/services/booking.service";
import { ResourceService } from "../app/services/resource.service";

describe("Phase 5 - Availability Service Test Suite", () => {
  let resourceId: string;

  beforeAll(async () => {
    await prisma.booking.deleteMany();
    await prisma.resource.deleteMany();

    const resource = await ResourceService.createResource("Availability Room Alpha", 15);
    resourceId = resource.id;
  });

  beforeEach(async () => {
    await prisma.booking.deleteMany();
  });

  afterAll(async () => {
    await prisma.booking.deleteMany();
    await prisma.resource.deleteMany();
    await prisma.$disconnect();
  });

  test("1. Checking availability in an open time range returns available: true", async () => {
    const start = new Date("2026-09-02T10:00:00Z");
    const end = new Date("2026-09-02T11:00:00Z");

    const result = await BookingService.checkAvailability(resourceId, start, end);
    expect(result.available).toBe(true);
    expect(result.resourceId).toBe(resourceId);
  });

  test("2. Checking availability in a range overlapping an existing CONFIRMED booking returns available: false", async () => {
    const start = new Date("2026-09-02T10:00:00Z");
    const end = new Date("2026-09-02T11:00:00Z");

    await BookingService.createBooking("Confirmed Meeting", start, end, resourceId);

    // Overlapping window: 10:30 to 11:30
    const queryStart = new Date("2026-09-02T10:30:00Z");
    const queryEnd = new Date("2026-09-02T11:30:00Z");

    const result = await BookingService.checkAvailability(resourceId, queryStart, queryEnd);
    expect(result.available).toBe(false);
  });

  test("3. Checking availability with CANCELLED booking does not block slot (returns available: true)", async () => {
    const start = new Date("2026-09-02T14:00:00Z");
    const end = new Date("2026-09-02T15:00:00Z");

    const booking = await BookingService.createBooking("Cancelled Meeting", start, end, resourceId);
    await BookingService.cancelBooking(booking.id);

    const result = await BookingService.checkAvailability(resourceId, start, end);
    expect(result.available).toBe(true);
  });

  test("4. Invalid date bounds (startTime >= endTime) throw INVALID_TIME_RANGE", async () => {
    const start = new Date("2026-09-02T10:00:00Z");
    const endEqual = new Date("2026-09-02T10:00:00Z");
    const endEarlier = new Date("2026-09-02T09:00:00Z");

    expect(
      BookingService.checkAvailability(resourceId, start, endEqual)
    ).rejects.toThrow("INVALID_TIME_RANGE");

    expect(
      BookingService.checkAvailability(resourceId, start, endEarlier)
    ).rejects.toThrow("INVALID_TIME_RANGE");
  });

  test("5. Malformed resource IDs throw RESOURCE_NOT_FOUND (safeguarded by UUID validation)", async () => {
    const start = new Date("2026-09-02T10:00:00Z");
    const end = new Date("2026-09-02T11:00:00Z");

    // Invalid string
    expect(
      BookingService.checkAvailability("invalid-resource-uuid-format", start, end)
    ).rejects.toThrow("RESOURCE_NOT_FOUND");

    // Non-existent valid UUID
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    expect(
      BookingService.checkAvailability(nonExistentId, start, end)
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
  });
});
