import HomePage from "@/components/home/HomePage";
import { testimonials } from "@/lib/landing";
import { loadTestimonialFollowers } from "@/lib/testimonials/server";

export const revalidate = 60;

export default async function Page() {
  const testimonialFollowers = testimonials.every((testimonial) => testimonial.platformGrowth)
    ? {}
    : await loadTestimonialFollowers();
  return <HomePage testimonialFollowers={testimonialFollowers} />;
}
