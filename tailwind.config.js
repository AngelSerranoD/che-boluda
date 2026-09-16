/**
 * Ché boluda — configuración de Tailwind.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * Paleta de la marca: blanco, hueso, arena, lino y piedra. Son todos claros,
 * así que los textos usan tres tintas sacadas del contorno marrón del icono.
 * Contraste (comprobado en tests/paleta.test.js):
 *   sobre hueso: tinta 10,2 · corteza 6,2 · cuero 4,6
 *   sobre arena: corteza 5,4 · cuero 4,0 (solo texto grande o iconos)
 *   sobre lino: tinta 7,7 · sobre piedra: tinta 6,8 · corteza 4,2 (solo grande)
 *   sobre cuero: blanco 5,2
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        blanco: '#FFFFFF',
        hueso: '#F4F1EC',
        arena: '#E8E2D8',
        lino: '#DAD3C6',
        piedra: '#CFC7B8',
        cuero: '#8C6444', // contorno del icono: bordes, acentos y texto de apoyo
        corteza: '#6E5440', // texto secundario
        tinta: '#4A3526', // texto principal
      },
      fontFamily: {
        // SF Pro Rounded en iPhone: sin descargar nada y a juego con el icono.
        sans: ['ui-rounded', '"SF Pro Rounded"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        // Relieve de "arcilla", como el icono: luz arriba, sombra cálida abajo.
        arcilla: 'inset 0 1.5px 0 rgba(255,255,255,0.85), 0 1px 0 rgba(140,100,68,0.18), 0 6px 16px -6px rgba(110,84,64,0.28)',
        hundido: 'inset 0 2px 6px rgba(110,84,64,0.28), inset 0 -1px 0 rgba(255,255,255,0.7)',
      },
      keyframes: {
        subir: { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        fundido: { from: { opacity: '0' }, to: { opacity: '1' } },
        asomar: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        onda: {
          '0%': { transform: 'scale(1)', opacity: '0.55' },
          '100%': { transform: 'scale(1.9)', opacity: '0' },
        },
        latido: { '0%, 100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.06)' } },
      },
      animation: {
        subir: 'subir 280ms cubic-bezier(0.2, 0.9, 0.3, 1)',
        fundido: 'fundido 200ms ease-out',
        asomar: 'asomar 220ms ease-out',
        onda: 'onda 1.4s ease-out infinite',
        latido: 'latido 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
