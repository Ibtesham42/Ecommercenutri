import { z } from "zod";
import { isJnvClassLevel, JNV_FILE_KINDS } from "@/lib/jnv/catalog";

const classLevelSchema = z
  .number()
  .int()
  .refine(isJnvClassLevel, { message: "Invalid class" });

export const jnvFolderCreateSchema = z.object({
  classLevel: classLevelSchema,
  name: z.string().trim().min(1, "Enter a folder name").max(80),
  icon: z.string().trim().max(40).nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
});

export const jnvFolderUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Enter a folder name").max(80),
  icon: z.string().trim().max(40).nullable().optional(),
});

export const jnvFolderMoveSchema = z.object({
  id: z.string().min(1),
  parentId: z.string().min(1).nullable(),
});

export const jnvResourceCreateSchema = z.object({
  folderId: z.string().min(1),
  classLevel: classLevelSchema,
  subject: z.string().trim().max(60).nullable().optional(),
  title: z.string().trim().min(1, "Enter a title").max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  teacherName: z.string().trim().max(80).nullable().optional(),
  fileUrl: z.string().url("Upload a file first"),
  fileKind: z.enum(JNV_FILE_KINDS),
  mimeType: z.string().max(120).nullable().optional(),
  fileSize: z.number().int().min(0).max(500 * 1024 * 1024),
  thumbnailUrl: z.string().url().nullable().optional(),
  isAssignment: z.boolean().default(false),
  dueAt: z.coerce.date().nullable().optional(),
});

export const jnvResourceUpdateSchema = z.object({
  id: z.string().min(1),
  folderId: z.string().min(1).optional(),
  subject: z.string().trim().max(60).nullable().optional(),
  title: z.string().trim().min(1, "Enter a title").max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  teacherName: z.string().trim().max(80).nullable().optional(),
  isAssignment: z.boolean().default(false),
  dueAt: z.coerce.date().nullable().optional(),
});

export const jnvAnnouncementSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1, "Enter a title").max(160),
  body: z.string().trim().min(1, "Enter the announcement text").max(4000),
  classLevel: classLevelSchema.nullable().optional(),
  pinned: z.boolean().default(false),
});
