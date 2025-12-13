import { router, protectedProcedure, publicProcedure } from "../trpc.js";
import { z } from "zod";
import { userService } from "../services/user.service.js";
import { TRPCError } from "@trpc/server";
import { redisCache } from "@opensox/shared";
import { validateAvatarUrl } from "../utils/avatar-validator.js";

// Cache key for all testimonials
const TESTIMONIALS_CACHE_KEY = "testimonials:all";
// Cache TTL: 5 minutes (300 seconds)
const TESTIMONIALS_CACHE_TTL = 300;

export const testimonialRouter = router({
    getAll: publicProcedure.query(async ({ ctx }: any) => {
        // Try to get from cache first
        const cached = await redisCache.get<any[]>(TESTIMONIALS_CACHE_KEY);
        if (cached) {
            console.log("Testimonials served from cache");
            return cached;
        }
        console.log("[testimonials] cache MISS", TESTIMONIALS_CACHE_KEY);

        // If not in cache, fetch from database
        const testimonials = await ctx.db.prisma.testimonial.findMany({
            orderBy: {
                createdAt: 'desc',
            },
        });

        // Store in cache for future requests
        await redisCache.set(TESTIMONIALS_CACHE_KEY, testimonials, TESTIMONIALS_CACHE_TTL);
        console.log("Testimonials fetched from database and cached");

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

            // Validate avatar URL with strict security checks
            await validateAvatarUrl(input.avatar);

            const result = await ctx.db.prisma.testimonial.upsert({
                where: { userId },
                create: {
                    userId,
                    name: input.name,
                    content: input.content,
                    avatar: input.avatar,
                },
                update: {
                    name: input.name,
                    content: input.content,
                    avatar: input.avatar,
                }
            });

            // Invalidate cache after testimonial submission
            await redisCache.del(TESTIMONIALS_CACHE_KEY);
            console.log("Testimonials cache invalidated after submission");

            return result;
        }),
});
