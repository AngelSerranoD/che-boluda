"""
Ché boluda — genera los iconos de la PWA a partir del original.
Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.

El original es una baldosa redondeada sobre fondo TRANSPARENTE. iOS aplica su
propia máscara de esquinas, así que el apple-touch-icon tiene que ser un
cuadrado a sangre: se recorta la baldosa por su canal alfa y las esquinas se
rellenan con el color de la propia baldosa.

Uso:  python tool/generar_iconos.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "assets" / "icono-original.png"
DESTINO = RAIZ / "public" / "icons"
MAESTRO = RAIZ / "assets" / "icono-1024.png"

TAMANOS = (32, 152, 167, 180, 192, 512)
ZONA_SEGURA_MASKABLE = 0.80   # Android recorta hasta un círculo del 80 %
OPACO = 250
BISEL = 26


def limites(img):
    """Caja de la baldosa medida en la fila y la columna centrales: ahí no hay
    sombra difusa que engañe al getbbox() del alfa completo."""
    alfa = img.getchannel("A")
    ancho, alto = img.size
    fila = [x for x in range(ancho) if alfa.getpixel((x, alto // 2)) >= OPACO]
    columna = [y for y in range(alto) if alfa.getpixel((ancho // 2, y)) >= OPACO]
    izq, arriba, der = fila[0], columna[0], fila[-1] + 1
    # La baldosa es de "arcilla": abajo asoma su canto 3D (unos 20 px más
    # alta que ancha). Se recorta un cuadrado desde arriba y el canto se queda fuera.
    return izq, arriba, der, arriba + (der - izq)


def radio_esquina(img, caja):
    """Filas desde arriba hasta que el borde izquierdo deja de curvarse."""
    alfa = img.getchannel("A")
    izq, arriba, _, abajo = caja
    for dy in range(abajo - arriba):
        x = next(x for x in range(izq, izq + 400) if alfa.getpixel((x, arriba + dy)) >= OPACO)
        if x <= izq:
            return dy
    raise RuntimeError("No se ha podido medir la esquina")


def color_baldosa(baldosa):
    """Mediana de una franja interior del borde izquierdo, libre de dibujo."""
    _, alto = baldosa.size
    trozo = baldosa.convert("RGB").crop((20, alto // 3, 60, alto // 3 * 2))
    canales = list(zip(*trozo.getdata()))
    return tuple(sorted(c)[len(c) // 2] for c in canales)


def main():
    img = Image.open(ORIGEN).convert("RGBA")
    caja = limites(img)
    # Se entra BISEL px por cada lado: el borde de la baldosa tiene un brillo
    # que, bajo la máscara de iOS, se vería como un segundo contorno.
    radio = radio_esquina(img, caja) - BISEL
    caja = (caja[0] + BISEL, caja[1] + BISEL, caja[2] - BISEL, caja[3] - BISEL)
    baldosa = img.crop(caja)
    ancho, alto = baldosa.size
    fondo = color_baldosa(baldosa)
    print(f"baldosa {caja} ({ancho}x{alto}), radio {radio}, color {fondo}")

    # Máscara algo metida hacia dentro: el borde antialias queda fuera.
    margen = 4
    mascara = Image.new("L", baldosa.size, 0)
    ImageDraw.Draw(mascara).rounded_rectangle(
        (margen, margen, ancho - 1 - margen, alto - 1 - margen),
        radius=radio + margen, fill=255)
    mascara = mascara.filter(ImageFilter.GaussianBlur(2))

    sangre = Image.new("RGB", baldosa.size, fondo)
    sangre.paste(baldosa.convert("RGB"), (0, 0), mascara)
    sangre = sangre.resize((1024, 1024), Image.LANCZOS)
    sangre.save(MAESTRO)

    DESTINO.mkdir(parents=True, exist_ok=True)
    for lado in TAMANOS:
        sangre.resize((lado, lado), Image.LANCZOS).save(DESTINO / f"icon-{lado}.png", optimize=True)

    maskable = Image.new("RGB", (1024, 1024), fondo)
    interior = round(1024 * ZONA_SEGURA_MASKABLE)
    desplazamiento = (1024 - interior) // 2
    maskable.paste(sangre.resize((interior, interior), Image.LANCZOS), (desplazamiento, desplazamiento))
    maskable.resize((512, 512), Image.LANCZOS).save(DESTINO / "maskable-512.png", optimize=True)

    # Vista previa para WhatsApp (Open Graph): icono centrado en 1200x630.
    og = Image.new("RGB", (1200, 630), (244, 241, 236))
    og.paste(img.resize((560, 560), Image.LANCZOS), (320, 35), img.resize((560, 560), Image.LANCZOS))
    og.save(DESTINO / "og.png", optimize=True)

    img.save(RAIZ / "public" / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("iconos generados en", DESTINO)


if __name__ == "__main__":
    main()
