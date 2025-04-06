import { z } from 'zod';

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
	photos: z
		.array(
			z.object({
				type: z.string(),
				identifier: z.string(),
				md5: z.string(),
			})
		)
		.optional(),
	videos: z
		.array(
			z.object({
				type: z.string(),
				identifier: z.string(),
				md5: z.string(),
			})
		)
		.optional(),
	audios: z
		.array(
			z.object({
				format: z.string(),
				identifier: z.string(),
				md5: z.string(),
			})
		)
		.optional(),
});

export type DayOneItem = z.infer<typeof DayOneItemSchema>;
