/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        canvas: "#091018",
        surface: "#111B27",
        raised: "#172536",
        line: "#26384D",
        ink: "#F4F7FB",
        muted: "#95A5B7",
        mint: "#77A7FF",
        coral: "#F49A8A",
        warning: "#FFD58A"
      }
    }
  }
};
