import { ResourceService } from "../../services/resource.service";

export const resourceResolvers = {
  Query: {
    resources: async () => {
      return ResourceService.getResources();
    },
    resource: async (_parent: any, args: { id: string }) => {
      return ResourceService.getResourceById(args.id);
    },
  },
  Mutation: {
    createResource: async (
      _parent: any,
      args: { name: string; capacity: number }
    ) => {
      return ResourceService.createResource(args.name, args.capacity);
    },
  },
  Resource: {
    bookings: async (parent: { id: string }) => {
      const res = await ResourceService.getResourceById(parent.id);
      return res?.bookings || [];
    },
  },
};
