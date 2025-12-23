"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { trpc } from "@/lib/trpc";
import { useSubscription } from "@/hooks/useSubscription";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import Navbar from "@/components/landing-sections/navbar";
import Footer from "@/components/landing-sections/footer";
import { Loader2, Link as LinkIcon, ArrowLeft } from "lucide-react";
import { useSession } from "next-auth/react";

// Supported social platforms for validation
const SUPPORTED_PLATFORMS = [
  "twitter.com",
  "x.com",
  "linkedin.com",
  "instagram.com",
  "youtube.com",
  "youtu.be",
];

const validateSocialLink = (url: string) => {
  if (!url) return true; // Empty is allowed (optional)
  try {
    const parsedUrl = new URL(url);
    return SUPPORTED_PLATFORMS.some((platform) =>
      parsedUrl.hostname.includes(platform)
    );
  } catch {
    return false;
  }
};

/**
 * Schema for testimonial submission
 */
const formSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(40, "Name must be at most 40 characters"),
  content: z
    .string()
    .min(10, "Testimonial must be at least 10 characters")
    .max(1000, "Testimonial must be at most 1000 characters"),
  socialLink: z
    .string()
    .refine(
      (val) => !val || validateSocialLink(val),
      "Only Twitter/X, LinkedIn, Instagram, and YouTube links are supported"
    )
    .optional()
    .or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

export default function SubmitTestimonialPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { isPaidUser, isLoading: isSubscriptionLoading } = useSubscription();

  // Fetch existing testimonial data to check if already submitted
  const { data, isLoading: isDataLoading } = (
    trpc as any
  ).testimonial.getMyTestimonial.useQuery(undefined, {
    enabled: !!isPaidUser,
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0, // Always fetch fresh data
  });

  // Check if user already submitted a testimonial
  const hasSubmittedTestimonial = !!data?.testimonial;

  const [error, setError] = useState<string | null>(null);

  const submitMutation = (trpc as any).testimonial.submit.useMutation({
    onSuccess: async () => {
      // Redirect to testimonials page
      router.push("/testimonials");
    },
    onError: (error: any) => {
      setError(error.message || "Error submitting testimonial");
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      content: "",
      socialLink: "",
    },
  });

  const nameValue = watch("name");
  const contentValue = watch("content");
  const socialLinkValue = watch("socialLink");

  const displayAvatar = data?.testimonial?.avatar || session?.user?.image;

  // Effect to populate form with user session data (not existing testimonial since editing is disabled)
  useEffect(() => {
    if (session?.user && !hasSubmittedTestimonial) {
      reset({
        name: session.user.name || "",
        content: "",
        socialLink: "",
      });
    }
  }, [session, reset, hasSubmittedTestimonial]);

  const onSubmit = (values: FormValues) => {
    setError(null); // Clear previous errors
    if (!displayAvatar) {
      setError("Profile picture not found. Please log in again.");
      return;
    }

    submitMutation.mutate({
      name: values.name,
      content: values.content,
      avatar: displayAvatar,
      socialLink: values.socialLink || undefined,
    });
  };

  // Loading State
  if (
    sessionStatus === "loading" ||
    isSubscriptionLoading ||
    (isPaidUser && isDataLoading)
  ) {
    return (
      <main className="min-h-screen w-full bg-[#101010] text-white font-sans overflow-hidden flex flex-col relative">
        <Navbar />
        <div className="flex-1 w-full max-w-[2000px] mx-auto border-x border-[#252525] flex flex-col pt-32 pb-20 px-4 md:px-6 lg:px-10 mt-10">
          <div className="max-w-2xl mx-auto w-full space-y-8">
            <div className="text-center space-y-2">
              <Skeleton className="h-10 w-3/4 mx-auto bg-neutral-800" />
              <Skeleton className="h-5 w-1/2 mx-auto bg-neutral-800" />
            </div>

            <div className="bg-neutral-900/50 border border-[#252525] rounded-2xl p-6 md:p-8 space-y-6">
              {/* Profile & Name Skeleton */}
              <div className="space-y-2">
                <Skeleton className="h-4 w-40 bg-neutral-800" />
                <div className="flex gap-4 items-start">
                  <Skeleton className="w-16 h-16 rounded-full bg-neutral-800" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-10 w-full bg-neutral-800" />
                    <Skeleton className="h-3 w-16 bg-neutral-800" />
                  </div>
                </div>
              </div>

              {/* Content Skeleton */}
              <div className="space-y-2">
                <Skeleton className="h-4 w-24 bg-neutral-800" />
                <Skeleton className="h-32 w-full bg-neutral-800" />
                <Skeleton className="h-3 w-20 bg-neutral-800" />
              </div>

              {/* Social Link Skeleton */}
              <div className="space-y-2">
                <Skeleton className="h-4 w-32 bg-neutral-800" />
                <Skeleton className="h-10 w-full bg-neutral-800" />
                <Skeleton className="h-3 w-48 bg-neutral-800" />
              </div>

              {/* Submit Button Skeleton */}
              <Skeleton className="h-10 w-full bg-neutral-800" />
            </div>
          </div>
        </div>
        <div className="max-w-[2000px] w-full mx-auto">
          <Footer />
        </div>
      </main>
    );
  }

  // Not Logged In State
  if (sessionStatus === "unauthenticated") {
    return (
      <main className="min-h-screen w-full bg-[#101010] text-white font-sans overflow-hidden flex flex-col relative">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 px-4 text-center z-10 pt-24">
          <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center border border-neutral-700 mb-4">
            <span className="text-2xl">👤</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Login Required</h1>
          <p className="text-neutral-400 max-w-md">
            You need to be logged in to submit a testimonial. Please log in to
            your account to continue.
          </p>
          <div className="flex gap-4">
            <Button
              onClick={() => router.push("/login")}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Login
            </Button>
            <Button
              onClick={() => router.push("/testimonials")}
              variant="outline"
              className="border-[#252525] bg-transparent hover:bg-white/5 text-white"
            >
              Back to Testimonials
            </Button>
          </div>
        </div>
        <div className="w-full max-w-[2000px] mx-auto border-t border-[#252525]">
          <Footer />
        </div>
      </main>
    );
  }

  // Access Denied State (Logged in but not paid)
  if (!isPaidUser) {
    return (
      <main className="min-h-screen w-full bg-[#101010] text-white font-sans overflow-hidden flex flex-col relative">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 px-4 text-center z-10 pt-24">
          <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20 mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Premium Feature</h1>
          <p className="text-neutral-400 max-w-md">
            This feature is exclusively for premium users. Please upgrade your
            plan to submit a testimonial.
          </p>
          <div className="flex gap-4">
            <Button
              onClick={() => router.push("/pricing")}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              View Plans
            </Button>
            <Button
              onClick={() => router.push("/testimonials")}
              variant="outline"
              className="border-[#252525] bg-transparent hover:bg-white/5 text-white"
            >
              Back to Testimonials
            </Button>
          </div>
        </div>
        <div className="w-full max-w-[2000px] mx-auto border-t border-[#252525]">
          <Footer />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-[#101010] text-white font-sans overflow-hidden relative flex flex-col">
      <Navbar />

      <div className="flex-1 w-full max-w-[2000px] mx-auto border-x border-[#252525] flex flex-col pt-32 pb-20 px-4 md:px-6 lg:px-10 mt-10">
        <div className="max-w-2xl mx-auto w-full space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              What you think about me?
            </h1>
            <p className="text-neutral-400">
              Share your experience with the community.
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard/home")}
            className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Home</span>
          </button>

          <div className="bg-neutral-900/50 border border-[#252525] rounded-2xl p-6 md:p-8 space-y-6">
            {/* Already Submitted State */}
            {hasSubmittedTestimonial ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20 mx-auto">
                  <span className="text-2xl">✓</span>
                </div>
                <h2 className="text-xl font-semibold">
                  Testimonial Already Submitted
                </h2>
                <p className="text-neutral-400">
                  Thank you! You have already submitted your testimonial.
                  Testimonials cannot be edited once submitted.
                </p>
                <Button
                  onClick={() => router.push("/testimonials")}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  View Testimonials
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Profile Picture and Display Name in Same Row */}
                <div className="space-y-2">
                  <Label className="text-neutral-300">
                    Profile & Display Name
                  </Label>
                  <div className="flex gap-4 items-start">
                    <div className="relative w-16 h-16 rounded-full overflow-hidden border border-[#252525] bg-neutral-800 flex-shrink-0">
                      {displayAvatar ? (
                        <Image
                          src={displayAvatar}
                          alt="Profile Picture"
                          fill
                          className="object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              `https://i.pravatar.cc/150?u=error`;
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-neutral-500">
                          No Img
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input
                        {...register("name")}
                        id="name"
                        placeholder="Your Name"
                        maxLength={40}
                        className="bg-neutral-950 border-[#252525] focus:border-purple-500 text-white placeholder:text-neutral-600"
                      />
                      <div className="flex justify-between items-center">
                        {errors.name && (
                          <p className="text-red-500 text-xs">
                            {errors.name.message}
                          </p>
                        )}
                        <p className="text-xs text-neutral-500 ml-auto">
                          {nameValue?.length || 0}/40
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content Field */}
                <div className="space-y-2">
                  <Label htmlFor="content" className="text-neutral-300">
                    Testimonial
                  </Label>
                  <Textarea
                    {...register("content")}
                    id="content"
                    placeholder="Tell us what you think about Opensox..."
                    maxLength={1000}
                    className="bg-neutral-950 border-[#252525] focus:border-purple-500 text-white placeholder:text-neutral-600 min-h-[120px]"
                  />
                  <div className="flex justify-between items-center">
                    {errors.content && (
                      <p className="text-red-500 text-xs">
                        {errors.content.message}
                      </p>
                    )}
                    <p className="text-xs text-neutral-500 ml-auto">
                      {contentValue?.length || 0}/1000
                    </p>
                  </div>
                </div>

                {/* Social Link Field (Optional) */}
                <div className="space-y-2">
                  <Label htmlFor="socialLink" className="text-neutral-300">
                    Social Link{" "}
                    <span className="text-neutral-500">(Optional)</span>
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                      <LinkIcon className="h-4 w-4" />
                    </div>
                    <Input
                      {...register("socialLink")}
                      id="socialLink"
                      placeholder="https://twitter.com/username"
                      className="bg-neutral-950 border-[#252525] focus:border-purple-500 text-white placeholder:text-neutral-600 pl-10"
                    />
                  </div>
                  {errors.socialLink && (
                    <p className="text-red-500 text-xs">
                      {errors.socialLink.message}
                    </p>
                  )}
                  <p className="text-xs text-neutral-500">
                    {socialLinkValue
                      ? "Supported: Twitter/X, LinkedIn, Instagram, YouTube"
                      : "Add your Twitter, LinkedIn, Instagram, or YouTube profile"}
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting || submitMutation.isPending}
                  className="w-full bg-white text-black hover:bg-neutral-200 font-medium"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Testimonial"
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[2000px] w-full mx-auto">
        <Footer />
      </div>
    </main>
  );
}
