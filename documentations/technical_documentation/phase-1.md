# Technical Documentation - Phase 1 Setup & Database Integration

## 1. Phase 1 Overview & Architecture
Phase 1 focuses on setting up the initial workspace architecture, installing dependencies, configuring PostgreSQL connectivity, defining the Prisma data models, and performing the initial database migrations.

### Technology Stack
- **Bun**: Next-generation JavaScript runtime, bundler, and package manager.
- **TypeScript**: Strict-mode configuration to enforce static typing and prevent runtime type bugs.
- **PostgreSQL**: Relational database engine for concurrent-safe transactional operations.
- **Prisma ORM (v7)**: Schema validation, migration management, and database client generation.
- **GraphQL Yoga (v5)**: Schema-first, high-performance web server container for executing GraphQL queries.

### Project Layout
```text
Meeting_Room_Booking_System/
├── .agents/                      # Workspace custom rules (tracked in git)
├── .gitignore                    # Root gitignore excluding vendor logs & agent temp files
├── documentations/               # Documentation folder
│   └── technical_documentation/
│       └── phase-1.md            # [THIS FILE] Phase 1 Documentation
└── backend/                      # Isolated backend project root
    ├── prisma/
    │   ├── migrations/           # SQL migration history
    │   └── schema.prisma         # Prisma data models & schemas
    ├── src/                      # Application source code
    │   └── index.ts              # Entry point
    ├── .env                      # Database configuration environment file
    ├── package.json              # Package metadata and helper scripts
    ├── prisma.config.ts          # Prisma v7 environment configuration file
    └── tsconfig.json             # TypeScript compiler settings
```

---

## 2. Environment & Dependency Setup

### Runtime Initialization
The backend workspace was initialized using:
```bash
bun init
```

### Dependencies Overview
#### Production Dependencies
- `graphql` (`^17.0.2`): The core GraphQL parser and schema engine.
- `graphql-yoga` (`^5.22.0`): The runtime engine for responding to GraphQL HTTP requests.
- `@prisma/client` (`^7.9.1`): Type-safe auto-generated database client matching database schemas.
- `date-fns` (`^4.4.0`): Lightweight date utilities for evaluating overlap ranges.

#### Development Dependencies
- `prisma` (`^7.9.1`): The Prisma CLI executor for running migrations and introspection.
- `@types/bun` (`latest`): Environment typings for the Bun runtime.
- `@types/node` (`^26.2.0`): Platform-level types mapping standard Node modules.

### TypeScript Strict Mode Setup (`tsconfig.json`)
The application operates under strict compiler constraints to capture missing bounds:
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun-types"],
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### Package Scripts (`package.json`)
Convenient wrapper scripts are defined to run development tools:
```json
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "test": "bun test"
  }
```

---

## 3. Database Configuration & Connectivity

### Environment Variable Structure
Prisma accesses database configuration through the `DATABASE_URL` environment variable inside [backend/.env](file:///d:/Meeting_Room_Booking_System/backend/.env):
```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/your_db?schema=public"
```

### Prisma 7 Configuration Strategy
In **Prisma v7**, datasource connection management has migrated out of the `schema.prisma` file and into a dynamic [prisma.config.ts](file:///d:/Meeting_Room_Booking_System/backend/prisma.config.ts) file. This allows clean, programmatic environment variable feeding via Node/Bun's `process.env`.
```typescript
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
```

---

## 4. Data Modeling & Table Creation (Prisma Schema)

The core data representation is declared in [backend/prisma/schema.prisma](file:///d:/Meeting_Room_Booking_System/backend/prisma/schema.prisma) containing two entity models connected by a one-to-many relationship:

```prisma
datasource db {
  provider = "postgresql"
}

generator client {
  provider = "prisma-client-js"
}

enum BookingStatus {
  CONFIRMED
  CANCELLED
}

model Resource {
  id        String    @id @default(uuid())
  name      String    @unique
  capacity  Int
  createdAt DateTime  @default(now())
  bookings  Booking[]
}

model Booking {
  id         String        @id @default(uuid())
  title      String
  startTime  DateTime
  endTime    DateTime
  status     BookingStatus @default(CONFIRMED)
  resourceId String
  resource   Resource      @relation(fields: [resourceId], references: [id], onDelete: Cascade)
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt

  @@index([startTime, id])
  @@index([resourceId, status, startTime, endTime])
}
```

### Indexed Optimization
- **`@@index([startTime, id])`**: Optimizes cursor-based pagination query performance when sorted chronologically by `startTime` (as mandated by the requirements).
- **`@@index([resourceId, status, startTime, endTime])`**: A covering composite index designed to execute overlapping validation checks instantaneously by targeting active (`CONFIRMED`) records under the selected resource.

### Generated SQL Migration
The migration generated by `bun run db:migrate` results in the following PostgreSQL execution:
```sql
-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Resource_name_key" ON "Resource"("name");

-- CreateIndex
CREATE INDEX "Booking_startTime_id_idx" ON "Booking"("startTime", "id");

-- CreateIndex
CREATE INDEX "Booking_resourceId_status_startTime_endTime_idx" ON "Booking"("resourceId", "status", "startTime", "endTime");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

---

## 5. Verification & Next Steps

### Verification Check
- **Connection**: Database connectivity verified successfully via the `prisma migrate dev` command applying SQL models to the local database container.
- **Client Output**: Prisma successfully compiled schema definitions and generated the typescript client mapping client objects to database constraints.

### Phase 2 Implementation Checklist
- [ ] Define the schema-first GraphQL API (`schema.graphql`) specifying resource query structures and booking mutations.
- [ ] Implement resource pagination queries.
- [ ] Create booking resolvers featuring concurrency checks:
  - Check for overlapping range intersections: `[startTime, endTime)`.
  - Exclude `CANCELLED` bookings from overlap restrictions.
  - Exclude the current booking node during rescheduling evaluations.
- [ ] Write integration test files leveraging `bun test` validating conflict-prevention constraints and simultaneous transaction handlers.
