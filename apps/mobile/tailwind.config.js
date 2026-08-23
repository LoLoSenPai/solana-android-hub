/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        canvas: "#010213",
        surface: "#0D1A29",
        raised: "#14253A",
        line: "#26384D",
        ink: "#F7F8FC",
        muted: "#9EADC0",
        mint: "#77A7FF",
        coral: "#8B5CF6",
        warning: "#FFD58A"
      }
    }
  }
};
