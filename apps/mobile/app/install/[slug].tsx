import { Redirect, useLocalSearchParams } from "expo-router";

export default function InstallLink() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <Redirect href={slug ? { pathname: "/apps/[slug]", params: { slug } } : "/"} />;
}
