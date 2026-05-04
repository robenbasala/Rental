/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      borderRadius: {
        xl2: "1rem",
        xl3: "1.25rem"
      },
      backgroundImage: {
        "hero-gradient":
          "linear-gradient(135deg, rgb(79 70 229) 0%, rgb(124 58 237) 45%, rgb(217 70 239) 100%)",
        "brand-gradient":
          "linear-gradient(135deg, rgb(79 70 229) 0%, rgb(124 58 237) 50%, rgb(192 38 211) 100%)"
      }
    }
  },
  plugins: []
};
