import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			success: {
  				DEFAULT: 'hsl(var(--success))',
  				foreground: 'hsl(var(--success-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'orbit-center': {
  				'0%': { transform: 'translate(calc(-50% + 0px), calc(-50% + 10px))' },
  				'25%': { transform: 'translate(calc(-50% + 10px), calc(-50% + 0px))' },
  				'50%': { transform: 'translate(calc(-50% + 0px), calc(-50% - 10px))' },
  				'75%': { transform: 'translate(calc(-50% - 10px), calc(-50% + 0px))' },
  				'100%': { transform: 'translate(calc(-50% + 0px), calc(-50% + 10px))' }
  			},
  			'orbit-left': {
  				'0%': { transform: 'translate(0px, calc(-50% + 15px)) rotate(-12deg)' },
  				'25%': { transform: 'translate(-15px, calc(-50% + 0px)) rotate(-11deg)' },
  				'50%': { transform: 'translate(0px, calc(-50% - 15px)) rotate(-12deg)' },
  				'75%': { transform: 'translate(15px, calc(-50% + 0px)) rotate(-13deg)' },
  				'100%': { transform: 'translate(0px, calc(-50% + 15px)) rotate(-12deg)' }
  			},
  			'orbit-right': {
  				'0%': { transform: 'translate(0px, calc(-50% - 12px)) rotate(12deg)' },
  				'25%': { transform: 'translate(12px, calc(-50% + 0px)) rotate(13deg)' },
  				'50%': { transform: 'translate(0px, calc(-50% + 12px)) rotate(12deg)' },
  				'75%': { transform: 'translate(-12px, calc(-50% + 0px)) rotate(11deg)' },
  				'100%': { transform: 'translate(0px, calc(-50% - 12px)) rotate(12deg)' }
  			},
  			'float-center': {
  				'0%': { transform: 'translate(-50%, calc(-50% + 8px))' },
  				'50%': { transform: 'translate(-50%, calc(-50% - 8px))' },
  				'100%': { transform: 'translate(-50%, calc(-50% + 8px))' }
  			},
  			'float-left': {
  				'0%': { transform: 'translate(0px, calc(-50% + 12px))' },
  				'50%': { transform: 'translate(0px, calc(-50% - 12px))' },
  				'100%': { transform: 'translate(0px, calc(-50% + 12px))' }
  			},
  			'float-right': {
  				'0%': { transform: 'translate(0px, calc(-50% - 10px))' },
  				'50%': { transform: 'translate(0px, calc(-50% + 10px))' },
  				'100%': { transform: 'translate(0px, calc(-50% - 10px))' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'orbit-center': 'orbit-center 45s ease-in-out infinite',
  			'orbit-left': 'orbit-left 55s ease-in-out infinite',
  			'orbit-right': 'orbit-right 40s ease-in-out infinite',
  			'float-center': 'float-center 35s ease-in-out infinite',
  			'float-left': 'float-left 40s ease-in-out infinite',
  			'float-right': 'float-right 30s ease-in-out infinite'
  		}
  	}
  },
  plugins: [tailwindcssAnimate],
};
export default config;
