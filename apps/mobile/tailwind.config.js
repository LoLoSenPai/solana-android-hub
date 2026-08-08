/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        canvas: "#061311",
        surface: "#0C1B19",
        raised: "#132320",
        line: "#243A36",
        ink: "#F5F7F2",
        muted: "#93A7A2",
        mint: "#72F0C6",
        coral: "#FF7A59",
        warning: "#FFC857"
      }
    }
  }
};
