"use client";
import React, { useMemo } from "react";
import Navbar from "@/components/landing-sections/navbar";
import Footer from "@/components/landing-sections/footer";
import Image from "next/image";

import { trpc } from "@/lib/trpc";
import { imageTestimonials } from "@/data/testimonials";
import { Skeleton } from "@/components/ui/skeleton";

type TestimonialBase = {
  id: string;
  type: "text" | "image";
};

type TextTestimonial = TestimonialBase & {
  type: "text";
  content: string;
  user: {
    name: string;
    username?: string; // e.g. @username
    avatar: string;
  };
};

type ImageTestimonial = TestimonialBase & {
  type: "image";
  imageUrl: string;
  alt: string;
};

type Testimonial = TextTestimonial | ImageTestimonial;

const TestimonialCard = ({ item }: { item: Testimonial }) => {
  if (item.type === "image") {
    return (
      <div className="mb-4 break-inside-avoid rounded-xl border border-[#252525] bg-neutral-900/50 overflow-hidden hover:border-neutral-700 transition-colors">
        <div className="relative w-full">
          <Image
            src={item.imageUrl}
            alt={item.alt}
            width={600}
            height={400}
            className="w-full h-auto object-cover"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 break-inside-avoid rounded-xl border border-[#252525] bg-neutral-900/50 p-6 hover:border-neutral-700 transition-colors flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 rounded-full overflow-hidden border border-white/10">
          <Image
            src={item.user.avatar}
            alt={item.user.name}
            fill
            className="object-cover"
          />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white">
            {item.user.name}
          </span>
          {item.user.username && (
            <span className="text-xs text-neutral-400">
              {item.user.username}
            </span>
          )}
        </div>
      </div>
      <p className="text-neutral-300 text-sm leading-relaxed">{item.content}</p>
    </div>
  );
};

const TestimonialsPage = () => {
  // Fetch text testimonials from tRPC
  const { data: textTestimonialsData, isLoading } =
    trpc.testimonial.getAll.useQuery();

  // Combine text testimonials from backend with image testimonials from data file
  const allTestimonials = useMemo(() => {
    const textTestimonials: TextTestimonial[] = (
      textTestimonialsData || []
    ).map(
      (t: { id: string; content: string; name: string; avatar: string }) => ({
        id: t.id,
        type: "text" as const,
        content: t.content,
        user: {
          name: t.name,
          avatar: t.avatar,
        },
      })
    );

    // Interleave text and image testimonials for better visual distribution
    const combined: Testimonial[] = [];
    let imageIndex = 0;

    // Add text testimonials and interleave images every 2-3 items
    for (let i = 0; i < textTestimonials.length; i++) {
      combined.push(textTestimonials[i]);

      // Add an image every 2-3 text testimonials
      if ((i + 1) % 3 === 0 && imageIndex < imageTestimonials.length) {
        combined.push(imageTestimonials[imageIndex]);
        imageIndex++;
      }
    }

    // Add any remaining image testimonials at the end
    while (imageIndex < imageTestimonials.length) {
      combined.push(imageTestimonials[imageIndex]);
      imageIndex++;
    }

    return combined;
  }, [textTestimonialsData]);

  return (
    <main className="min-h-screen w-full bg-[#101010] text-white font-sans overflow-hidden relative">
      <Navbar />

      <div className="min-h-screen w-full max-w-[2000px] mx-auto border-x border-[#252525] overflow-hidden pt-32 pb-20 px-4 md:px-6 lg:px-10">
        {/* Header */}
        <div className="max-w-2xl mx-auto text-center mb-16 space-y-4">
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tighter text-white">
            Loved by <span className="text-purple-500">Developers</span>
          </h1>
          <p className="text-lg text-neutral-400">
            See what the community is saying about how Opensox is changing their
            open source workflow.
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4 mx-auto max-w-7xl">
            {/* Text testimonial skeleton */}
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="mb-4 break-inside-avoid rounded-xl border border-[#252525] bg-neutral-900/50 p-6 flex flex-col gap-4"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex flex-col gap-2 flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
            {/* Image testimonial skeleton */}
            {[...Array(3)].map((_, i) => (
              <div
                key={`img-${i}`}
                className="mb-4 break-inside-avoid rounded-xl border border-[#252525] bg-neutral-900/50 overflow-hidden"
              >
                <Skeleton className="w-full h-64" />
              </div>
            ))}
          </div>
        )}

        {/* Masonry/Bento Grid */}
        {!isLoading && allTestimonials.length > 0 && (
          <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4 mx-auto max-w-7xl">
            {allTestimonials.map((testimonial) => (
              <TestimonialCard key={testimonial.id} item={testimonial} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && allTestimonials.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <p className="text-neutral-400 text-lg">
              No testimonials yet. Be the first to share your experience!
            </p>
          </div>
        )}
      </div>

      <div className="max-w-[2000px] w-full mx-auto">
        <Footer />
      </div>
    </main>
  );
};

export default TestimonialsPage;
