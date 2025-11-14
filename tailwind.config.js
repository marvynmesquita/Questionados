/** @type {import('tailwindcss').Config} */
module.exports = {
  // Informa ao Tailwind para procurar classes
  // em todos os arquivos .js e .jsx dentro da pasta 'src'
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}