/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        canvas: "#080b0e",
        surface: "#10151a",
        raised: "#151c22",
        line: "#29343d",
        ink: "#f2f6f7",
        muted: "#9bacb7",
        mint: "#9cf4c8",
        warning: "#ffd37a"
      }
    }
  }
};
