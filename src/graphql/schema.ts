import { GraphQLError } from "graphql";
import {
  isValidPushToken,
  registerPushToken,
  sendPushToUser,
  unregisterPushToken,
} from "../push.js";
import type { Context } from "./context.js";

export const typeDefs = `#graphql
  type User {
    id: ID!
    email: String!
    name: String!
    emailVerified: Boolean!
    image: String
  }

  type Query {
    health: String!
    me: User
  }

  type Mutation {
    "Registers an Expo push token for the current user's device."
    registerPushToken(token: String!, platform: String!): Boolean!
    "Removes a push token, e.g. when the user signs out on that device."
    unregisterPushToken(token: String!): Boolean!
    "Sends a test push to all of the current user's devices. Returns the number of devices targeted."
    sendTestPush: Int!
  }
`;

function requireUser(ctx: Context) {
  if (!ctx.session) {
    throw new GraphQLError("Not authenticated", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return ctx.session.user;
}

export const resolvers = {
  Query: {
    health: () => "ok",
    me: (_parent: unknown, _args: unknown, ctx: Context) => requireUser(ctx),
  },
  Mutation: {
    registerPushToken: async (
      _parent: unknown,
      args: { token: string; platform: string },
      ctx: Context,
    ) => {
      const user = requireUser(ctx);
      if (!isValidPushToken(args.token)) {
        throw new GraphQLError("Invalid Expo push token", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      await registerPushToken(user.id, args.token, args.platform);
      return true;
    },
    unregisterPushToken: async (_parent: unknown, args: { token: string }, ctx: Context) => {
      const user = requireUser(ctx);
      await unregisterPushToken(user.id, args.token);
      return true;
    },
    sendTestPush: (_parent: unknown, _args: unknown, ctx: Context) => {
      const user = requireUser(ctx);
      return sendPushToUser(user.id, {
        title: "Push notifications are working",
        body: `Hi ${user.name}, this was sent from the backend.`,
      });
    },
  },
};
