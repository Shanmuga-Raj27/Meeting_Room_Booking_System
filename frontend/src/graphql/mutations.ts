import { gql } from '@apollo/client';

export const CREATE_RESOURCE = gql`
  mutation CreateResource($name: String!, $capacity: Int!) {
    createResource(name: $name, capacity: $capacity) {
      id
      name
      capacity
      createdAt
    }
  }
`;

export const CREATE_BOOKING = gql`
  mutation CreateBooking($title: String!, $startTime: DateTime!, $endTime: DateTime!, $resourceId: ID!) {
    createBooking(title: $title, startTime: $startTime, endTime: $endTime, resourceId: $resourceId) {
      id
      title
      startTime
      endTime
      status
      resourceId
      resource {
        id
        name
      }
    }
  }
`;

export const RESCHEDULE_BOOKING = gql`
  mutation RescheduleBooking($id: ID!, $startTime: DateTime!, $endTime: DateTime!) {
    rescheduleBooking(id: $id, startTime: $startTime, endTime: $endTime) {
      id
      title
      startTime
      endTime
      status
      resourceId
    }
  }
`;

export const CANCEL_BOOKING = gql`
  mutation CancelBooking($id: ID!) {
    cancelBooking(id: $id) {
      id
      status
    }
  }
`;

export const DELETE_BOOKING = gql`
  mutation DeleteBooking($id: ID!) {
    deleteBooking(id: $id) {
      id
    }
  }
`;
