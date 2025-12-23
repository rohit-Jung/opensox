import { router, protectedProcedure, publicProcedure } from "../trpc.js";
import { z } from "zod";
import { userService } from "../services/user.service.js";
import { TRPCError } from "@trpc/server";
import { validateAvatarUrl } from "../utils/avatar-validator.js";

export const testimonialRouter = router({
    getAll: publicProcedure.query(async ({ ctx }: any) => {
        // Fetch testimonials directly from database without caching
        const testimonials = await ctx.db.prisma.testimonial.findMany({
            orderBy: {
                createdAt: 'desc',
            },
        });

        return testimonials;
    }),

    getMyTestimonial: protectedProcedure.query(async ({ ctx }: any) => {
        const userId = ctx.user.id;

        // Check subscription
        const { isPaidUser } = await userService.checkSubscriptionStatus(ctx.db.prisma, userId);

        if (!isPaidUser) {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "Only premium users can submit testimonials",
            });
        }

        const testimonial = await ctx.db.prisma.testimonial.findUnique({
            where: { userId },
        });

        return {
            testimonial,
        };
    }),

    submit: protectedProcedure
        .input(z.object({
            name: z.string().min(1, "Name is required").max(40, "Name must be at most 40 characters"),
            content: z.string().min(10, "Testimonial must be at least 10 characters").max(1000, "Testimonial must be at most 1000 characters"),
            avatar: z.string().url("Invalid avatar URL"),
            socialLink: z.string().url("Invalid social link URL").refine((url) => {
                const supportedPlatforms = [
                    'twitter.com',
                    'x.com',
                    'linkedin.com',
                    'instagram.com',
                    'youtube.com',
                    'youtu.be',
                ];
                try {
                    const parsedUrl = new URL(url);
                    return supportedPlatforms.some(platform => parsedUrl.hostname.includes(platform));
                } catch {
                    return false;
                }
            }, "Only Twitter/X, LinkedIn, Instagram, and YouTube links are supported").optional().or(z.literal('')),
        }))
        .mutation(async ({ ctx, input }: any) => {
            const userId = ctx.user.id;

            const { isPaidUser } = await userService.checkSubscriptionStatus(ctx.db.prisma, userId);
            if (!isPaidUser) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Only premium users can submit testimonials",
                });
            }



            // Check if testimonial already exists - prevent updates
            const existingTestimonial = await ctx.db.prisma.testimonial.findUnique({
                where: { userId },
            });

            if (existingTestimonial) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "You have already submitted a testimonial. Testimonials cannot be edited once submitted.",
                });
            }

            // Validate avatar URL with strict security checks
            await validateAvatarUrl(input.avatar);

            const result = await ctx.db.prisma.testimonial.create({
                data: {
                    userId,
                    name: input.name,
                    content: input.content,
                    avatar: input.avatar,
                    socialLink: input.socialLink || null,
                },
            });

            return result;
        }),
});
