import { z } from 'zod';

export const commentSchema = z.object({
  id: z.string().min(1).max(128),
  comment: z.string().trim().min(1).max(5000),
  intent: z.enum(['comment', 'remove', 'simplify']).default('comment'),
  status: z.enum(['open', 'resolved']),
  createdAt: z.string().datetime({ offset: true }),
  anchor: z.object({ kind: z.literal('html'), selector: z.string().min(1).max(2000) }).passthrough(),
  revision: z.string().min(1).max(128).optional(),
});
export type ReviewComment = z.infer<typeof commentSchema>;
const artifactSchema = z.object({ id: z.string(), title: z.string(), project: z.string(), path: z.string(), revision: z.string(), updatedAt: z.string(), openComments: z.number() });
export type Artifact = z.infer<typeof artifactSchema>;
export const libraryQuerySchema = z.object({ query: z.string().max(500).optional(), project: z.string().max(256).optional(), offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(100).default(50) });
export const librarySchema = z.object({ kind: z.literal('library'), artifacts: z.array(artifactSchema), projects: z.array(z.string()), total: z.number(), nextOffset: z.number().nullable() });
export const savedArtifactSchema = z.object({ kind: z.literal('artifact'), id: z.string(), revision: z.string(), html: z.string(), comments: z.array(commentSchema), title: z.string().optional(), artifactPath: z.string() });
export const presentationSchema = z.discriminatedUnion('kind', [librarySchema, savedArtifactSchema]);
export const commentsSchema = z.object({ comments: z.array(commentSchema) });
export const savedCommentSchema = z.object({ comment: commentSchema });
export const reviewMessageSchema = z.object({ channel: z.literal('vs-review'), requestId: z.string().min(1).max(128), action: z.enum(['load', 'save']), comment: commentSchema.optional() });
export type Library = z.infer<typeof librarySchema>;
export type SavedArtifact = z.infer<typeof savedArtifactSchema>;
export type ToolArguments = z.input<typeof libraryQuerySchema> | { artifactId: string; revision?: string; comment?: ReviewComment };
export type ReviewReply = { channel: 'vs-review-result'; requestId: string } & ({ comments: ReviewComment[]; revision: string } | { comment: ReviewComment } | { error: string });
export type CommentEvent = { eventId: string; name: 'comment.created'; timestamp: string; data: { artifact_id: string; project_id: string; comment_id: string; text: string; revision: string; anchor: ReviewComment['anchor'] }; cursor: null };
