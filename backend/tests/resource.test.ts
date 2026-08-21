import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { prisma } from "../app/database/prisma";
import { ResourceService } from "../app/services/resource.service";

describe("Phase 5 - Resource Service Test Suite", () => {
  beforeAll(async () => {
    await prisma.booking.deleteMany();
    await prisma.resource.deleteMany();
  });

  beforeEach(async () => {
    await prisma.booking.deleteMany();
    await prisma.resource.deleteMany();
  });

  afterAll(async () => {
    await prisma.booking.deleteMany();
    await prisma.resource.deleteMany();
    await prisma.$disconnect();
  });

  test("1. Creating resources with valid parameters (verify DB persistence)", async () => {
    const resource = await ResourceService.createResource("Conference Room A", 10);
    expect(resource.id).toBeDefined();
    expect(resource.name).toBe("Conference Room A");
    expect(resource.capacity).toBe(10);

    const dbResource = await prisma.resource.findUnique({
      where: { id: resource.id },
    });
    expect(dbResource).not.toBeNull();
    expect(dbResource?.name).toBe("Conference Room A");
    expect(dbResource?.capacity).toBe(10);
  });

  test("2. Capacity constraints enforcement (capacity <= 0 must reject)", async () => {
    expect(
      ResourceService.createResource("Zero Capacity Room", 0)
    ).rejects.toThrow("Capacity must be greater than zero");

    expect(
      ResourceService.createResource("Negative Capacity Room", -5)
    ).rejects.toThrow("Capacity must be greater than zero");
  });

  test("3. Unique constraint rejection (duplicate name throws RESOURCE_ALREADY_EXISTS)", async () => {
    await ResourceService.createResource("Unique Executive Room", 8);

    expect(
      ResourceService.createResource("Unique Executive Room", 12)
    ).rejects.toThrow("RESOURCE_ALREADY_EXISTS");
  });
});
