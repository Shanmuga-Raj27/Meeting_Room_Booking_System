import { BookingService } from "../../services/booking.service";
import { ResourceService } from "../../services/resource.service";
import { BookingStatus } from "@prisma/client";

export const bookingResolvers = {
  Query: {
    bookings: async (
      _parent: any,
      args: {
        resourceId?: string | null;
        status?: BookingStatus | null;
        first?: number | null;
        after?: string | null;
      }
    ) => {
      return BookingService.getBookings(args);
    },
    availability: async (
      _parent: any,
      args: { resourceId: string; startTime: string; endTime: string }
    ) => {
      const start = new Date(args.startTime);
      const end = new Date(args.endTime);
      return BookingService.checkAvailability(args.resourceId, start, end);
    },
  },
  Mutation: {
    createBooking: async (
      _parent: any,
      args: {
        title: string;
        startTime: string;
        endTime: string;
        resourceId: string;
      }
    ) => {
      const start = new Date(args.startTime);
      const end = new Date(args.endTime);
      return BookingService.createBooking(
        args.title,
        start,
        end,
        args.resourceId
      );
    },
    rescheduleBooking: async (
      _parent: any,
      args: { id: string; startTime: string; endTime: string }
    ) => {
      const start = new Date(args.startTime);
      const end = new Date(args.endTime);
      return BookingService.rescheduleBooking(args.id, start, end);
    },
    cancelBooking: async (_parent: any, args: { id: string }) => {
      return BookingService.cancelBooking(args.id);
    },
    deleteBooking: async (_parent: any, args: { id: string }) => {
      return BookingService.deleteBooking(args.id);
    },
  },
  Booking: {
    resource: async (parent: { resourceId: string }) => {
      return ResourceService.getResourceById(parent.resourceId);
    },
  },
};
