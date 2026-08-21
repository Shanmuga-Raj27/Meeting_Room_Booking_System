export interface ErrorDetail {
  message: string;
  code: string;
  status: number;
}

export const ERROR_MAP: Record<string, ErrorDetail> = {
  RESOURCE_NOT_FOUND: {
    message: "The requested meeting room or resource could not be found.",
    code: "RESOURCE_NOT_FOUND",
    status: 404,
  },
  BOOKING_NOT_FOUND: {
    message: "The requested booking could not be found.",
    code: "BOOKING_NOT_FOUND",
    status: 404,
  },
  INVALID_TIME_RANGE: {
    message: "The start time of the booking must be earlier than the end time, and both dates must be valid.",
    code: "INVALID_TIME_RANGE",
    status: 400,
  },
  RESOURCE_UNAVAILABLE: {
    message: "This meeting room is already reserved during the requested time slot. Please choose another time.",
    code: "RESOURCE_UNAVAILABLE",
    status: 409,
  },
  BOOKING_ALREADY_CANCELLED: {
    message: "This booking has already been cancelled.",
    code: "BOOKING_ALREADY_CANCELLED",
    status: 400,
  },
  CONCURRENCY_CONFLICT: {
    message: "Another booking request is being processed for this room at the same time. Please try again.",
    code: "CONCURRENCY_CONFLICT",
    status: 409,
  },
  INVALID_CURSOR: {
    message: "The provided pagination cursor is invalid or malformed.",
    code: "INVALID_CURSOR",
    status: 400,
  },
  RESOURCE_ALREADY_EXISTS: {
    message: "A meeting room or resource with this name already exists.",
    code: "RESOURCE_ALREADY_EXISTS",
    status: 409,
  },
};
