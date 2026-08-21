import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { prisma } from "../app/database/prisma";
import { BookingService } from "../app/services/booking.service";
import { ResourceService } from "../app/services/resource.service";
import { BookingStatus } from "@prisma/client";

describe("Phase 3 - Booking Service Core Business Logic", () => {
  let resourceId: string;

  beforeAll(async () => {
    // Clean database before tests
    await prisma.booking.deleteMany();
    await prisma.resource.deleteMany();

    const resource = await ResourceService.createResource("Test Room Alpha", 10);
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

  test("1. Time Range Validation: Reject invalid startTime >= endTime", async () => {
    const start = new Date("2026-09-01T10:00:00Z");
    const endEqual = new Date("2026-09-01T10:00:00Z");
    const endEarlier = new Date("2026-09-01T09:00:00Z");

    expect(
      BookingService.createBooking("Test", start, endEqual, resourceId)
    ).rejects.toThrow("INVALID_TIME_RANGE");

    expect(
      BookingService.createBooking("Test", start, endEarlier, resourceId)
    ).rejects.toThrow("INVALID_TIME_RANGE");
  });

  test("2. Half-Open Interval Overlap: Reject overlapping booking", async () => {
    const start1 = new Date("2026-09-01T10:00:00Z");
    const end1 = new Date("2026-09-01T12:00:00Z");

    const b1 = await BookingService.createBooking("Booking 1", start1, end1, resourceId);
    expect(b1.status).toBe(BookingStatus.CONFIRMED);

    // Overlapping booking: 11:00 to 13:00
    const start2 = new Date("2026-09-01T11:00:00Z");
    const end2 = new Date("2026-09-01T13:00:00Z");

    expect(
      BookingService.createBooking("Booking 2", start2, end2, resourceId)
    ).rejects.toThrow("RESOURCE_UNAVAILABLE");
  });

  test("3. Half-Open Interval Boundary: Allow back-to-back bookings [10:00-11:00) and [11:00-12:00)", async () => {
    const start1 = new Date("2026-09-01T10:00:00Z");
    const end1 = new Date("2026-09-01T11:00:00Z");

    const start2 = new Date("2026-09-01T11:00:00Z");
    const end2 = new Date("2026-09-01T12:00:00Z");

    const b1 = await BookingService.createBooking("Slot 1", start1, end1, resourceId);
    const b2 = await BookingService.createBooking("Slot 2", start2, end2, resourceId);

    expect(b1.status).toBe(BookingStatus.CONFIRMED);
    expect(b2.status).toBe(BookingStatus.CONFIRMED);
  });

  test("4. Cancelled Booking Exclusion: Free up time slot when booking is cancelled", async () => {
    const start = new Date("2026-09-01T14:00:00Z");
    const end = new Date("2026-09-01T15:00:00Z");

    const b1 = await BookingService.createBooking("Initial Booking", start, end, resourceId);
    await BookingService.cancelBooking(b1.id);

    // Creating new booking for exact same time slot should succeed
    const b2 = await BookingService.createBooking("New Booking", start, end, resourceId);
    expect(b2.status).toBe(BookingStatus.CONFIRMED);
  });

  test("5. Rescheduling Logic: Self-exclusion allows moving booking within open or same slot", async () => {
    const start1 = new Date("2026-09-01T10:00:00Z");
    const end1 = new Date("2026-09-01T11:00:00Z");

    const b1 = await BookingService.createBooking("Reschedule Test", start1, end1, resourceId);

    const newStart = new Date("2026-09-01T10:30:00Z");
    const newEnd = new Date("2026-09-01T11:30:00Z");

    const updated = await BookingService.rescheduleBooking(b1.id, newStart, newEnd);
    expect(updated.startTime).toEqual(newStart);
    expect(updated.endTime).toEqual(newEnd);
  });

  test("6. Cancellation & Double Cancel Guard", async () => {
    const start = new Date("2026-09-01T16:00:00Z");
    const end = new Date("2026-09-01T17:00:00Z");

    const b = await BookingService.createBooking("Cancel Test", start, end, resourceId);
    const cancelled = await BookingService.cancelBooking(b.id);
    expect(cancelled.status).toBe(BookingStatus.CANCELLED);

    expect(BookingService.cancelBooking(b.id)).rejects.toThrow("BOOKING_ALREADY_CANCELLED");
  });

  test("7. Hard Deletion", async () => {
    const start = new Date("2026-09-01T18:00:00Z");
    const end = new Date("2026-09-01T19:00:00Z");

    const b = await BookingService.createBooking("Delete Test", start, end, resourceId);
    await BookingService.deleteBooking(b.id);

    expect(BookingService.cancelBooking(b.id)).rejects.toThrow("BOOKING_NOT_FOUND");
  });

  test("8. Check Availability Query", async () => {
    const start = new Date("2026-09-02T10:00:00Z");
    const end = new Date("2026-09-02T11:00:00Z");

    const avail1 = await BookingService.checkAvailability(resourceId, start, end);
    expect(avail1.available).toBe(true);

    await BookingService.createBooking("Slot", start, end, resourceId);

    const avail2 = await BookingService.checkAvailability(resourceId, start, end);
    expect(avail2.available).toBe(false);
  });
});
