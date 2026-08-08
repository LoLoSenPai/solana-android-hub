/// <reference types="nativewind/types" />

declare module "*.css";

declare module "*.png" {
  const source: import("react-native").ImageSourcePropType;
  export default source;
}
