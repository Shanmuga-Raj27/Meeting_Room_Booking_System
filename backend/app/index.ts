import { createSchema, createYoga, createGraphQLError } from "graphql-yoga";
import { resolvers } from "./graphql/resolvers";
import { ERROR_MAP } from "./graphql/errors";
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

export const yoga = createYoga({
  schema,
  graphqlEndpoint: "/graphql",
  landingPage: true,
  maskedErrors: {
    maskError(error: any, message: string, isDev?: boolean) {
      const originalError = error.originalError || error;
      const errorKey = originalError?.message;

      if (errorKey && ERROR_MAP[errorKey]) {
        const mapped = ERROR_MAP[errorKey];
        return createGraphQLError(mapped.message, {
          extensions: {
            code: mapped.code,
            http: { status: mapped.status },
          },
        });
      }

      if (
        originalError?.code === "P2028" ||
        (typeof originalError?.message === "string" &&
          (originalError.message.includes("Transaction timed out") ||
            originalError.message.includes("lock timeout")))
      ) {
        const mapped = ERROR_MAP["CONCURRENCY_CONFLICT"];
        if (mapped) {
          return createGraphQLError(mapped.message, {
            extensions: {
              code: mapped.code,
              http: { status: mapped.status },
            },
          });
        }
      }

      // Default user-friendly error for unhandled internal failures
      return createGraphQLError("An unexpected error occurred. Please try again later.", {
        extensions: {
          code: "INTERNAL_SERVER_ERROR",
          http: { status: 500 },
        },
      });
    },
  },
});

if (import.meta.main) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

  Bun.serve({
    port,
    fetch: (request) => yoga.handle(request),
  });

  console.log(`Room Booking API Server is running at http://localhost:${port}/graphql`);
}

