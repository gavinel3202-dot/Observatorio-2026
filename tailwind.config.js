/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontSize: {
        base: ['1rem', '1.6'],
        lg: ['1.125rem', '1.6'],
        xl: ['1.25rem', '1.5'],
        '2xl': ['1.5rem', '1.4'],
      },
    },
  },
  plugins: [],
};
