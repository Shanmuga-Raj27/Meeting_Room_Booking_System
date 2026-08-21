import { prisma } from "../database/prisma";
import { BookingStatus, Booking, Prisma } from "@prisma/client";

export interface PaginationArgs {
  resourceId?: string | null;
  status?: BookingStatus | null;
  first?: number | null;
  after?: string | null;
}

export class BookingService {
  private static encodeCursor(startTime: Date, id: string): string {
    const payload = JSON.stringify({ startTime: startTime.toISOString(), id });
    return Buffer.from(payload).toString("base64");
  }

  private static decodeCursor(cursor: string): { startTime: string; id: string } {
    try {
      const decoded = Buffer.from(cursor, "base64").toString("utf-8");
      return JSON.parse(decoded);
    } catch (err) {
      throw new Error("INVALID_CURSOR");
    }
  }

  private static async checkOverlap(
    tx: Prisma.TransactionClient | typeof prisma,
    resourceId: string,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string
  ): Promise<boolean> {
    const conditions: any = {
      resourceId,
      status: BookingStatus.CONFIRMED,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    };

    if (excludeBookingId) {
      conditions.id = { not: excludeBookingId };
    }

    const conflict = await tx.booking.findFirst({
      where: conditions,
    });

    return conflict !== null;
  }

  static async createBooking(
    title: string,
    startTime: Date,
    endTime: Date,
    resourceId: string
  ) {
    if (startTime.getTime() >= endTime.getTime()) {
      throw new Error("INVALID_TIME_RANGE");
    }

    // Run within interactive transaction with Resource-level row locking
    return prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Lock the parent resource row to serialize bookings on it
        const resources = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Resource" WHERE "id" = ${resourceId} FOR UPDATE
        `;

        if (!resources || resources.length === 0) {
          throw new Error("RESOURCE_NOT_FOUND");
        }

        // Evaluate overlap
        const hasOverlap = await this.checkOverlap(tx, resourceId, startTime, endTime);
        if (hasOverlap) {
          throw new Error("RESOURCE_UNAVAILABLE");
        }

        // Insert new booking
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
      {
        timeout: 10000,
      }
    );
  }

  static async rescheduleBooking(id: string, startTime: Date, endTime: Date) {
    if (startTime.getTime() >= endTime.getTime()) {
      throw new Error("INVALID_TIME_RANGE");
    }

    const existingBooking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!existingBooking) {
      throw new Error("BOOKING_NOT_FOUND");
    }

    const resourceId = existingBooking.resourceId;

    return prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Lock the resource row to serialize concurrent writes
        const resources = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Resource" WHERE "id" = ${resourceId} FOR UPDATE
        `;

        if (!resources || resources.length === 0) {
          throw new Error("RESOURCE_NOT_FOUND");
        }

        // Evaluate overlap excluding self
        const hasOverlap = await this.checkOverlap(
          tx,
          resourceId,
          startTime,
          endTime,
          id
        );
        if (hasOverlap) {
          throw new Error("RESOURCE_UNAVAILABLE");
        }

        // Update booking times and force CONFIRMED status
        return tx.booking.update({
          where: { id },
          data: {
            startTime,
            endTime,
            status: BookingStatus.CONFIRMED,
          },
        });
      },
      {
        timeout: 10000,
      }
    );
  }

  static async cancelBooking(id: string) {
    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new Error("BOOKING_NOT_FOUND");
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new Error("BOOKING_ALREADY_CANCELLED");
    }

    return prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
      },
    });
  }

  static async deleteBooking(id: string) {
    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new Error("BOOKING_NOT_FOUND");
    }

    return prisma.booking.delete({
      where: { id },
    });
  }

  static async checkAvailability(
    resourceId: string,
    startTime: Date,
    endTime: Date
  ) {
    if (startTime.getTime() >= endTime.getTime()) {
      throw new Error("INVALID_TIME_RANGE");
    }

    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource) {
      throw new Error("RESOURCE_NOT_FOUND");
    }

    const hasConflict = await this.checkOverlap(
      prisma,
      resourceId,
      startTime,
      endTime
    );

    return {
      available: !hasConflict,
      resourceId,
      startTime,
      endTime,
    };
  }

  static async getBookings(args: PaginationArgs) {
    const limit = args.first && args.first > 0 ? args.first : 20;
    const whereClause: any = {};

    if (args.resourceId) {
      whereClause.resourceId = args.resourceId;
    }
    if (args.status) {
      whereClause.status = args.status;
    }

    // Capture the base filter before keyset pagination filter for total count
    const countWhere = { ...whereClause };

    if (args.after) {
      const { startTime: afterStartTimeStr, id: afterId } = this.decodeCursor(
        args.after
      );
      const afterStartTime = new Date(afterStartTimeStr);

      whereClause.OR = [
        {
          startTime: { gt: afterStartTime },
        },
        {
          startTime: afterStartTime,
          id: { gt: afterId },
        },
      ];
    }

    // Query limit + 1 items to see if hasNextPage is true
    const bookings = await prisma.booking.findMany({
      where: whereClause,
      orderBy: [{ startTime: "asc" }, { id: "asc" }],
      take: limit + 1,
    });

    const hasNextPage = bookings.length > limit;
    const items = hasNextPage ? bookings.slice(0, limit) : bookings;

    const totalCount = await prisma.booking.count({
      where: countWhere,
    });

    const edges = items.map((booking: Booking) => ({
      cursor: this.encodeCursor(booking.startTime, booking.id),
      node: booking,
    }));

    const endCursor =
      edges.length > 0 ? edges[edges.length - 1]?.cursor || null : null;

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor,
      },
      totalCount,
    };
  }
}
