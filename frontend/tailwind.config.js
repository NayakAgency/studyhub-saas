/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],

  // Class-based dark mode toggle (ready when dark theme is added)
  darkMode: 'class',

  theme: {
    // ── Responsive breakpoints (real device widths) ────────────
    screens: {
      'xs':  '390px',   // iPhone SE / small Android (Galaxy A series)
      'sm':  '640px',   // Large phones / small tablet portrait
      'md':  '768px',   // iPad Mini / iPad portrait
      'lg':  '1024px',  // iPad Pro landscape / small laptops
      'xl':  '1280px',  // Standard desktop
      '2xl': '1536px',  // Wide / ultrawide desktop
    },

    extend: {
      // ── Fonts ────────────────────────────────────────────────
      fontFamily: {
        display: ['Sora', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
        sans:    ['Inter', 'sans-serif'],
      },

      // ── Brand colors ─────────────────────────────────────────
      colors: {
        primary: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        success: '#10B981',
        warning: '#F59E0B',
        error:   '#EF4444',
        info:    '#06B6D4',
      },

      // ── Spacing (safe areas + common values) ─────────────────
      spacing: {
        // Device notch / home-bar safe areas
        'safe-top':    'env(safe-area-inset-top, 0px)',
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        'safe-left':   'env(safe-area-inset-left, 0px)',
        'safe-right':  'env(safe-area-inset-right, 0px)',
        // Common layout values
        '18': '4.5rem',
        '22': '5.5rem',
        '68': '17rem',
        '76': '19rem',
      },

      // ── Min heights (dynamic viewport) ───────────────────────
      minHeight: {
        // dvh = stable on iOS Safari; vh = fallback
        'screen':    ['100vh', '100dvh'],
        'screen-90': ['90vh', '90dvh'],
        'touch':     '44px',            // WCAG 2.5.5 minimum touch target
      },
      minWidth: {
        'touch': '44px',
      },
      maxHeight: {
        'screen-90':  ['90vh', '90dvh'],
        'screen-dvh': ['100vh', '100dvh'],
      },

      // ── Fluid typography (clamp — no media-query needed) ─────
      fontSize: {
        'fluid-xs':  ['clamp(0.7rem, 1.2vw, 0.8rem)',    { lineHeight: '1.4' }],
        'fluid-sm':  ['clamp(0.8rem, 1.5vw, 0.875rem)',  { lineHeight: '1.5' }],
        'fluid-base':['clamp(0.9rem, 2vw, 1rem)',         { lineHeight: '1.6' }],
        'fluid-lg':  ['clamp(1rem, 2.5vw, 1.125rem)',    { lineHeight: '1.55' }],
        'fluid-xl':  ['clamp(1.125rem, 3vw, 1.25rem)',   { lineHeight: '1.5' }],
        'fluid-2xl': ['clamp(1.25rem, 3.5vw, 1.5rem)',   { lineHeight: '1.4' }],
        'fluid-3xl': ['clamp(1.5rem, 4vw, 2rem)',         { lineHeight: '1.3' }],
        'fluid-4xl': ['clamp(1.875rem, 5vw, 2.5rem)',    { lineHeight: '1.2' }],
      },

      // ── Animations ───────────────────────────────────────────
      animation: {
        'fade-in':        'fadeIn 0.15s ease-in-out',
        'slide-in-right': 'slideInRight 0.2s ease-out',
        'slide-in-left':  'slideInLeft 0.2s ease-out',
        'slide-up':       'slideUp 0.2s ease-out',
        'slide-down':     'slideDown 0.2s ease-out',
        'scale-in':       'scaleIn 0.15s ease-out',
        'shimmer':        'shimmer 1.5s infinite',
        'spin-slow':      'spin 3s linear infinite',
        'bounce-soft':    'bounceSoft 0.4s ease-out',
      },
      keyframes: {
        fadeIn:       { from: { opacity: 0 },                                to: { opacity: 1 } },
        slideInRight: { from: { transform: 'translateX(100%)', opacity: 0 }, to: { transform: 'translateX(0)', opacity: 1 } },
        slideInLeft:  { from: { transform: 'translateX(-100%)',opacity: 0 }, to: { transform: 'translateX(0)', opacity: 1 } },
        slideUp:      { from: { transform: 'translateY(20px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
        slideDown:    { from: { transform: 'translateY(-20px)',opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
        scaleIn:      { from: { transform: 'scale(0.95)', opacity: 0 },      to: { transform: 'scale(1)', opacity: 1 } },
        bounceSoft:   { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        shimmer: {
          '0%':   { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition:  '1000px 0' },
        },
      },

      // ── Shadows ──────────────────────────────────────────────
      boxShadow: {
        'card':       '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        'modal':      '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        'nav':        '0 1px 0 rgb(0 0 0 / 0.05)',
        'float':      '0 4px 20px rgb(0 0 0 / 0.08)',
        'mobile-nav': '0 -2px 10px rgb(0 0 0 / 0.06)',
      },

      // ── Border radius ─────────────────────────────────────────
      borderRadius: {
        'xl':  '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },

      // ── Responsive container ──────────────────────────────────
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          xs:  '1rem',
          sm:  '1.5rem',
          md:  '2rem',
          lg:  '2rem',
          xl:  '2.5rem',
          '2xl': '3rem',
        },
      },

      // ── Z-index layers ────────────────────────────────────────
      zIndex: {
        'dropdown':      '1000',
        'sticky':        '1020',
        'fixed':         '1030',
        'modal-backdrop':'1040',
        'modal':         '1050',
        'toast':         '1060',
        'tooltip':       '1070',
        'mobile-nav':    '1080',  // Bottom nav always on top on phone
      },
    },
  },
  plugins: [],
};
