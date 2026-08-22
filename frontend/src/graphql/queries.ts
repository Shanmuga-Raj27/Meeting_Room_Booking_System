import { gql } from '@apollo/client';

export const GET_RESOURCES = gql`
  query GetResources {
    resources {
      id
      name
      capacity
      createdAt
    }
  }
`;

export const GET_BOOKINGS = gql`
  query GetBookings($resourceId: String, $status: BookingStatus, $first: Int, $after: String) {
    bookings(resourceId: $resourceId, status: $status, first: $first, after: $after) {
      edges {
        cursor
        node {
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
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

export const GET_AVAILABILITY = gql`
  query GetAvailability($resourceId: ID!, $startTime: DateTime!, $endTime: DateTime!) {
    availability(resourceId: $resourceId, startTime: $startTime, endTime: $endTime) {
      available
      resourceId
      startTime
      endTime
    }
  }
`;
