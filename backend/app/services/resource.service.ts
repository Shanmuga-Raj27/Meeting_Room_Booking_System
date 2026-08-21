import { prisma } from "../database/prisma";

export class ResourceService {
  static async createResource(name: string, capacity: number) {
    if (capacity <= 0) {
      throw new Error("Capacity must be greater than zero");
    }
    return prisma.resource.create({
      data: {
        name,
        capacity,
      },
    });
  }

  static async getResources() {
    return prisma.resource.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  static async getResourceById(id: string) {
    return prisma.resource.findUnique({
      where: { id },
      include: {
        bookings: {
          orderBy: {
            startTime: "asc",
          },
        },
      },
    });
  }
}
