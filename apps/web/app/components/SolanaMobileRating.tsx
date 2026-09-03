import type { SolanaMobileRatingDto } from "@hub/api-client";

export function SolanaMobileRating({
  rating,
  detail = false
}: {
  rating: SolanaMobileRatingDto | null;
  detail?: boolean;
}) {
  if (!rating || rating.reviewCount === 0) return null;
  const filledStars = Math.round(rating.averageRating);
  const reviews = `${rating.reviewCount.toLocaleString("en-US")} ${rating.reviewCount === 1 ? "review" : "reviews"}`;

  return (
    <span
      className={`solana-mobile-rating${detail ? " solana-mobile-rating-detail" : ""}`}
      aria-label={`${rating.averageRating.toFixed(1)} out of 5 from ${reviews} on Solana Mobile`}
    >
      {!detail ? <span className="solana-mobile-rating-stars" aria-hidden="true">★</span> : null}
      <strong>{rating.averageRating.toFixed(1)}</strong>
      {detail ? <span className="solana-mobile-rating-stars" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => index < filledStars ? "★" : "☆").join("")}
      </span> : null}
      <span>{detail ? `(${reviews})` : `(${rating.reviewCount.toLocaleString("en-US")})`}</span>
    </span>
  );
}
