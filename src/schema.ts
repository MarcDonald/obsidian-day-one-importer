import { z } from 'zod';

export const MediaObjectSchema = z.object({
	identifier: z.string(),
	md5: z.string(),
	type: z.string().optional(),
});

export type MediaObject = z.infer<typeof MediaObjectSchema>;

export const DayOneItemSchema = z.object({
	modifiedDate: z.string().datetime(),
	creationDate: z.string().datetime(),
	isAllDay: z.boolean().optional(),
	isPinned: z.boolean().optional(),
	starred: z.boolean().optional(),
	tags: z.array(z.string()).optional(),
	text: z.string().default(''),
	userActivity: z
		.object({
			activityName: z.string().optional(),
		})
		.optional(),
	location: z
		.object({
			localityName: z.string().optional(),
			country: z.string().optional(),
			placeName: z.string().optional(),
			latitude: z.number(),
			longitude: z.number(),
		})
		.optional(),
	uuid: z.string(),
	photos: z.array(MediaObjectSchema).optional(),
	videos: z.array(MediaObjectSchema).optional(),
	audios: z.array(MediaObjectSchema).optional(),
	pdfAttachments: z.array(MediaObjectSchema).optional(),
});

export type DayOneItem = z.infer<typeof DayOneItemSchema>;
