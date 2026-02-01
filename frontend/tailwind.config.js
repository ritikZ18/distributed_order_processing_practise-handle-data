/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#0a0d12",
                glass: {
                    bg: "rgba(15, 19, 24, 0.6)",
                    border: "rgba(255, 255, 255, 0.08)",
                },
                accent: {
                    blue: "#3b82f6",
                    cyan: "#22d3ee",
                    purple: "#a855f7",
                    emerald: "#10b981",
                    amber: "#f59e0b",
                    rose: "#f43f5e",
                }
            },
            fontFamily: {
                sans: ['Inter', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
                mono: ['"JetBrains Mono"', '"Fira Code"', '"SF Mono"', 'monospace'],
            },
            backdropBlur: {
                glass: '20px',
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
        },
    },
    plugins: [],
}
