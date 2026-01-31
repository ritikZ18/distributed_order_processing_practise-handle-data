/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#0b0f14",
                terminal: {
                    header: "#1a1e24",
                    text: "#a9b1d6",
                    accent: "#1793d1", // Arch Linux Blue
                    success: "#9ece6a",
                    error: "#f7768e",
                    bracket: "#bb9af7"
                }
            },
            fontFamily: {
                mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
            },
        },
    },
    plugins: [],
}
