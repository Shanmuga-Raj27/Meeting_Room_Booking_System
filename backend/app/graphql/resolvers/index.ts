import { GraphQLScalarType, Kind } from "graphql";
import { resourceResolvers } from "./resource.resolver";
import { bookingResolvers } from "./booking.resolver";

const dateTimeScalar = new GraphQLScalarType({
  name: "DateTime",
  description: "DateTime custom scalar type",
  serialize(value: any) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === "string") {
      return new Date(value).toISOString();
    }
    return null;
  },
  parseValue(value: any) {
    if (typeof value === "string") {
      return new Date(value);
    }
    return null;
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null;
  },
});

export const resolvers = {
  DateTime: dateTimeScalar,
  Query: {
    ...resourceResolvers.Query,
    ...bookingResolvers.Query,
  },
  Mutation: {
    ...resourceResolvers.Mutation,
    ...bookingResolvers.Mutation,
  },
  Resource: {
    ...resourceResolvers.Resource,
  },
  Booking: {
    ...bookingResolvers.Booking,
  },
};
