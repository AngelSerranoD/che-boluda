/**
 * Ché boluda — foto de perfil recortada en el propio móvil.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * Se recorta al centro en cuadrado y se baja a 320 px en JPEG: unos 25 kB en
 * vez de los 3 MB de una foto del iPhone. Así sube rápido y cabe en el bucket.
 */
import { ErrorApp } from './servicio/errores.js';

const LADO = 320;

export async function prepararFoto(archivo) {
  if (!archivo?.type?.startsWith('image/')) throw new ErrorApp('Elige una imagen.');
  const url = URL.createObjectURL(archivo);
  try {
    const imagen = await new Promise((resolver, rechazar) => {
      const img = new Image();
      img.onload = () => resolver(img);
      img.onerror = () => rechazar(new ErrorApp('No se ha podido leer esa imagen (prueba con una foto JPEG o PNG).'));
      img.src = url;
    });
    const corto = Math.min(imagen.naturalWidth, imagen.naturalHeight);
    const lienzo = document.createElement('canvas');
    lienzo.width = LADO;
    lienzo.height = LADO;
    const ctx = lienzo.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imagen, (imagen.naturalWidth - corto) / 2, (imagen.naturalHeight - corto) / 2, corto, corto, 0, 0, LADO, LADO);
    const blob = await new Promise((r) => lienzo.toBlob(r, 'image/jpeg', 0.85));
    if (!blob) throw new ErrorApp('No se ha podido preparar la foto.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
