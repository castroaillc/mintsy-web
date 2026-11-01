import { GraphQLError } from "graphql";
import { getPublishedBook, listPublishedBooks, type BookDoc, type EpisodeDoc } from "../catalog.js";
import { FREE_EPISODES } from "../constants.js";
import { refreshPremium } from "../entitlements.js";
import { thumbnailUrl, videoUrl } from "../media.js";
import {
  isValidPushToken,
  registerPushToken,
  sendPushToUser,
  unregisterPushToken,
} from "../push.js";
import {
  continueWatching,
  CONTINUE_WATCHING_MAX,
  finishedBookIds,
  progressForBook,
  setProgress,
  type ProgressView,
} from "../progress.js";
import { listSaved, setSaved, type SavedKind } from "../saved.js";
import { EMPTY_RESULT, keyIdeas, normalizeQuery, searchCatalog, type EpisodeMatch } from "../search.js";
import type { Context } from "./context.js";

export const typeDefs = `#graphql
  type User {
    id: ID!
    email: String!
    name: String!
    emailVerified: Boolean!
    image: String
    "The user's mintsy Premium subscription (RevenueCat entitlement premium)."
    premium: Premium!
    "Book ids the user saved to My List, most recently saved first. May include ids no longer in the catalog: skip those."
    savedBookIds: [ID!]!
    "Episode ids (<bookId>-<number>) the user saved, most recently saved first. May include ids no longer in the catalog."
    savedEpisodeIds: [ID!]!
    """
    Continue watching: one entry per book, the book with the most recent activity first. Each is the book's
    most recently watched episode if it isn't completed, otherwise the next episode that isn't completed
    (positionSec 0 if never started). That next episode may be locked (episode.locked): show an upsell.
    Books where every published episode is completed are left out. limit: 0-50.
    """
    continueWatching(limit: Int = 10): [EpisodeProgress!]!
    "Every episode of the book with stored progress, by episode number. Empty if none."
    progress(bookId: ID!): [EpisodeProgress!]!
    "Published books whose every published episode is completed, most recently finished first."
    finishedBookIds: [ID!]!
  }

  "The viewer's place in one episode."
  type EpisodeProgress {
    "Same as episodeId."
    id: ID!
    "Episode id: <bookId>-<number> (the same ids as Episode.id and savedEpisodeIds)."
    episodeId: ID!
    bookId: ID!
    episodeNumber: Int!
    "Seconds watched, between 0 and durationSec."
    positionSec: Int!
    "The episode's duration in seconds."
    durationSec: Int!
    "Watched to the end: position reached 95% of the duration, or setProgress(completed: true)."
    completed: Boolean!
    "When this was last saved (ISO 8601, server time)."
    updatedAt: String!
    "The episode, or null if it's no longer published."
    episode: Episode
    "The book, or null if it's no longer published."
    book: Book
  }

  enum SavedKind {
    BOOK
    EPISODE
  }

  type Premium {
    "True while the subscription (or trial) gives access; false once expiresAt has passed."
    active: Boolean!
    "End of the current period (ISO 8601). Null if never subscribed."
    expiresAt: String
    "False once the user cancelled or billing failed."
    willRenew: Boolean!
    "RevenueCat period type, lowercased: trial, normal or intro. Null if never subscribed."
    periodType: String
    "Store product id of the subscription, e.g. the yearly or monthly product."
    productId: String
    "Where it was bought (lowercased RevenueCat store): app_store, rc_billing (web), stripe, play_store, promotional, ... Null if never subscribed. Manage the subscription where it was bought."
    store: String
  }

  type TranscriptLine {
    startSec: Int!
    text: String!
  }

  type Episode {
    "Stable id: <bookId>-<number>"
    id: ID!
    number: Int!
    title: String!
    summary: String!
    durationSec: Int!
    "Empty when locked."
    transcript: [TranscriptLine!]!
    "Empty when locked."
    takeaways: [String!]!
    "Progressive MP4; null until the episode's video is uploaded, and null when locked. May be a short-lived signed URL: refetch rather than storing it."
    videoUrl: String
    thumbnailUrl: String
    "True when the viewer needs Premium to watch: number > 3 (FREE_EPISODES) and the viewer isn't Premium. Signed-out viewers are never Premium."
    locked: Boolean!
  }

  type Book {
    id: ID!
    title: String!
    author: String!
    category: String!
    coverTone: String!
    "Rendered cover image (2:3 JPEG, at least 1000×1500), or null when the book has none yet: draw the coverTone tile instead. Signed and short-lived when media is private, like Episode.thumbnailUrl."
    coverUrl: String
    tint: String!
    description: String!
    episodes: [Episode!]!
    "The book in 5 ideas (at most 5). Curated ideas when the book has them; otherwise the first takeaway of each episode the viewer can watch, in order, deduplicated (so at most 3 for free viewers). Can be empty."
    keyIdeas: [String!]!
  }

  "Results of search(query). Both lists are empty for queries shorter than 2 characters."
  type SearchResult {
    "Books whose title, author or category contains the query: title matches first, then author, then category. At most 20."
    books: [Book!]!
    "Transcript lines that mention the query: those from the matched books first, then the rest of the catalog, in episode and time order. At most 30, and at most 3 per episode. Locked episodes are not searched."
    episodes: [EpisodeMatch!]!
  }

  "One transcript line that mentions the search query."
  type EpisodeMatch {
    "Stable id: <bookId>-<number>-<startSec>"
    id: ID!
    bookId: ID!
    bookTitle: String!
    "Episode id: <bookId>-<number>"
    episodeId: ID!
    episodeNumber: Int!
    episodeTitle: String!
    "The full episode (thumbnail, duration, locked state)."
    episode: Episode!
    "Start of the matching transcript line, in seconds: open the player here."
    startSec: Int!
    "About 80-120 characters of the line around the match, with a leading/trailing … when cut."
    snippet: String!
    "Offset of the match in snippet, in UTF-16 code units (JavaScript string indices)."
    matchStart: Int!
    "Length of the match in snippet, in UTF-16 code units. snippet.slice(matchStart, matchStart + matchLength) is the matched text."
    matchLength: Int!
  }

  type Query {
    health: String!
    me: User
    "The catalog is public: the welcome screen shows it before sign-in."
    books: [Book!]!
    book(id: ID!): Book
    "Public catalog search (works signed out) over book titles, authors, categories and episode transcripts. Case-insensitive; the query is trimmed and cut to 100 characters."
    search(query: String!): SearchResult!
  }

  type Mutation {
    "Registers an Expo push token for the current user's device."
    registerPushToken(token: String!, platform: String!): Boolean!
    "Removes a push token, e.g. when the user signs out on that device."
    unregisterPushToken(token: String!): Boolean!
    "Sends a test push to all of the current user's devices. Returns the number of devices targeted."
    sendTestPush: Int!
    "Refetches the current user's subscription from RevenueCat (call right after a purchase or restore), stores and returns it."
    refreshPremium: Premium!
    "Saves (saved: true) or removes (saved: false) a book or episode in the viewer's My List. Idempotent; re-saving keeps the original position. At most 500 per kind. Returns the updated viewer."
    setSaved(kind: SavedKind!, id: ID!, saved: Boolean!): User!
    """
    Saves the viewer's place in a published episode (idempotent; call every ~10 s while playing, and on
    pause, seek and exit). positionSec is clamped to [0, durationSec]. completed: true / false sets it
    (false = mark as not watched); omitted or null keeps it, and a position at 95% of the duration or more
    sets it. Last write wins by server time, except that a backwards move arriving within 2 s of the
    previous save is ignored as out of order (the stored progress is returned).
    Errors: UNAUTHENTICATED; BAD_USER_INPUT "Unknown episode"; FORBIDDEN "Premium required" (locked episode).
    """
    setProgress(episodeId: ID!, positionSec: Int!, completed: Boolean): EpisodeProgress!
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

function viewerOnly(user: { id: string }, ctx: Context) {
  // `me` and `setSaved` are the only ways to reach a User, so this is always the viewer
  if (ctx.session?.user.id !== user.id) throw new GraphQLError("Forbidden", { extensions: { code: "FORBIDDEN" } });
}

const SAVED_KIND = { BOOK: "book", EPISODE: "episode" } as const satisfies Record<string, SavedKind>;

async function isLocked(episode: EpisodeDoc, ctx: Context) {
  if (episode.number <= FREE_EPISODES) return false;
  return !(await ctx.viewerPremium()).active;
}

/** Synchronous lock check for a whole request (loads the viewer's Premium state once). */
async function lockCheck(ctx: Context) {
  const premium = (await ctx.viewerPremium()).active;
  return (episode: EpisodeDoc) => episode.number > FREE_EPISODES && !premium;
}

const episodeWithId = (book: BookDoc, episode: EpisodeDoc) => ({ ...episode, id: `${book._id}-${episode.number}` });

export const resolvers = {
  Query: {
    health: () => "ok",
    me: (_parent: unknown, _args: unknown, ctx: Context) => requireUser(ctx),
    books: () => listPublishedBooks(),
    book: (_parent: unknown, args: { id: string }) => getPublishedBook(args.id),
    search: async (_parent: unknown, args: { query: string }, ctx: Context) => {
      if (!normalizeQuery(args.query)) return EMPTY_RESULT;
      const [catalog, locked] = await Promise.all([listPublishedBooks(), lockCheck(ctx)]);
      return searchCatalog(catalog, args.query, locked);
    },
  },
  Book: {
    id: (book: BookDoc) => book._id,
    // Episodes don't know their book, so derive their ids here
    episodes: (book: BookDoc) => book.episodes.map((e) => episodeWithId(book, e)),
    keyIdeas: async (book: BookDoc, _args: unknown, ctx: Context) => keyIdeas(book, await lockCheck(ctx)),
    coverUrl: (book: BookDoc) => thumbnailUrl(book.coverPath),
  },
  EpisodeProgress: {
    id: (p: ProgressView) => p.episodeId,
    durationSec: (p: ProgressView) => p.episode?.durationSec ?? p.durationSec,
    updatedAt: (p: ProgressView) => p.updatedAt.toISOString(),
    episode: (p: ProgressView) => (p.book && p.episode ? episodeWithId(p.book, p.episode) : null),
    book: (p: ProgressView) => p.book,
  },
  EpisodeMatch: {
    id: (m: EpisodeMatch) => `${m.book._id}-${m.episode.number}-${m.startSec}`,
    bookId: (m: EpisodeMatch) => m.book._id,
    bookTitle: (m: EpisodeMatch) => m.book.title,
    episodeId: (m: EpisodeMatch) => `${m.book._id}-${m.episode.number}`,
    episodeNumber: (m: EpisodeMatch) => m.episode.number,
    episodeTitle: (m: EpisodeMatch) => m.episode.title,
    episode: (m: EpisodeMatch) => episodeWithId(m.book, m.episode),
  },
  User: {
    premium: (user: { id: string }, _args: unknown, ctx: Context) => {
      viewerOnly(user, ctx);
      return ctx.viewerPremium();
    },
    savedBookIds: (user: { id: string }, _args: unknown, ctx: Context) => {
      viewerOnly(user, ctx);
      return listSaved(user.id, "book");
    },
    savedEpisodeIds: (user: { id: string }, _args: unknown, ctx: Context) => {
      viewerOnly(user, ctx);
      return listSaved(user.id, "episode");
    },
    continueWatching: (user: { id: string }, args: { limit?: number | null }, ctx: Context) => {
      viewerOnly(user, ctx);
      const limit = args.limit ?? 10;
      if (limit < 0 || limit > CONTINUE_WATCHING_MAX) {
        throw new GraphQLError(`limit must be between 0 and ${CONTINUE_WATCHING_MAX}`, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      return continueWatching(user.id, limit);
    },
    progress: (user: { id: string }, args: { bookId: string }, ctx: Context) => {
      viewerOnly(user, ctx);
      return progressForBook(user.id, args.bookId);
    },
    finishedBookIds: (user: { id: string }, _args: unknown, ctx: Context) => {
      viewerOnly(user, ctx);
      return finishedBookIds(user.id);
    },
  },
  Episode: {
    locked: (episode: EpisodeDoc, _args: unknown, ctx: Context) => isLocked(episode, ctx),
    videoUrl: async (episode: EpisodeDoc, _args: unknown, ctx: Context) =>
      (await isLocked(episode, ctx)) ? null : videoUrl(episode.videoPath),
    transcript: async (episode: EpisodeDoc, _args: unknown, ctx: Context) =>
      (await isLocked(episode, ctx)) ? [] : episode.transcript,
    takeaways: async (episode: EpisodeDoc, _args: unknown, ctx: Context) =>
      (await isLocked(episode, ctx)) ? [] : episode.takeaways,
    thumbnailUrl: (episode: EpisodeDoc) => thumbnailUrl(episode.thumbnailPath),
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
    refreshPremium: async (_parent: unknown, _args: unknown, ctx: Context) => {
      const user = requireUser(ctx);
      const premium = await refreshPremium(user.id);
      ctx.setViewerPremium(premium);
      return premium;
    },
    setSaved: async (
      _parent: unknown,
      args: { kind: keyof typeof SAVED_KIND; id: string; saved: boolean },
      ctx: Context,
    ) => {
      const user = requireUser(ctx);
      const result = await setSaved(user.id, SAVED_KIND[args.kind], args.id, args.saved);
      if (result === "unknown-id") {
        throw new GraphQLError("Unknown id", { extensions: { code: "BAD_USER_INPUT" } });
      }
      if (result === "full") {
        throw new GraphQLError("My List is full (500 per kind)", { extensions: { code: "BAD_USER_INPUT" } });
      }
      return user;
    },
    setProgress: async (
      _parent: unknown,
      args: { episodeId: string; positionSec: number; completed?: boolean | null },
      ctx: Context,
    ) => {
      const user = requireUser(ctx);
      const result = await setProgress(user.id, args.episodeId, args.positionSec, args.completed, await lockCheck(ctx));
      if (result === "unknown-episode") {
        throw new GraphQLError("Unknown episode", { extensions: { code: "BAD_USER_INPUT" } });
      }
      if (result === "locked") {
        throw new GraphQLError("Premium required", { extensions: { code: "FORBIDDEN" } });
      }
      return result;
    },
  },
};
