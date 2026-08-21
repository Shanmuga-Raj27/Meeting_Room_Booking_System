import { createSchema, createYoga } from "graphql-yoga";
import { resolvers } from "./graphql/resolvers";
import path from "path";

const currentDir = import.meta.dir;

const resourceSchema = await Bun.file(
  path.join(currentDir, "graphql/schemas/resource.graphql")
).text();
const bookingSchema = await Bun.file(
  path.join(currentDir, "graphql/schemas/booking.graphql")
).text();
const paginationSchema = await Bun.file(
  path.join(currentDir, "graphql/schemas/pagination.graphql")
).text();

const schema = createSchema({
  typeDefs: [resourceSchema, bookingSchema, paginationSchema],
  resolvers,
});

const yoga = createYoga({
  schema,
  graphqlEndpoint: "/graphql",
  landingPage: true,
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

Bun.serve({
  port,
  fetch: (request) => yoga.handle(request),
});

console.log(`Room Booking API Server is running at http://localhost:${port}/graphql`);
