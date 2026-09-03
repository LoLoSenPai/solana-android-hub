import type { SolanaMobileRatingDto } from "@hub/api-client";
import { Text, View } from "react-native";

export function SolanaMobileRating({
  rating,
  detail = false
}: {
  rating: SolanaMobileRatingDto | null;
  detail?: boolean;
}) {
  if (!rating || rating.reviewCount === 0) return null;
  const filledStars = Math.round(rating.averageRating);
  const stars = Array.from({ length: 5 }, (_, index) => index < filledStars ? "★" : "☆").join("");
  const reviewCount = rating.reviewCount.toLocaleString("en-US");
  const reviews = `${reviewCount} ${rating.reviewCount === 1 ? "review" : "reviews"}`;

  return (
    <View
      accessible
      accessibilityLabel={`${rating.averageRating.toFixed(1)} out of 5 from ${reviews} on Solana Mobile`}
      className={detail ? "mt-3 flex-row items-center" : "flex-row items-center"}
    >
      {!detail ? <Text className="text-xs text-warning">★</Text> : null}
      <Text className={detail ? "text-sm font-bold text-ink" : "text-xs font-semibold text-ink"}>
        {rating.averageRating.toFixed(1)}
      </Text>
      {detail ? <Text className="ml-2 text-base text-warning">{stars}</Text> : null}
      <Text className={detail ? "ml-2 text-sm text-muted" : "ml-1 text-xs text-muted"}>
        {detail ? `(${reviews})` : `(${reviewCount})`}
      </Text>
    </View>
  );
}
