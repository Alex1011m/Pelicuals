# Smart TV Hub (Legacy Client + Vercel Serverless)

Una aplicación web ultra-ligera en **HTML5 / JavaScript ES5 puro (cero dependencias externas en frontend)** diseñada para convertir cualquier Smart TV en un centro de entretenimiento completo, controlable al 100% con las flechas y la tecla OK del control remoto.

Diseñado específicamente para desplegarse de forma gratuita en **Vercel** y funcionar **24/7 sin necesidad de una computadora encendida en casa**.

---

## Características Principales

- **Compatibilidad Extrema (ES5):** Diseñado para ejecutarse en navegadores web de Smart TVs (Samsung Orsay/Tizen, LG NetCast/webOS, Sony Opera TV/Vewd, Hisense VIDAA, Philips, Android TV, etc.).
- **Navegación Espacial 2D con Control Remoto:**
  - `◄ ▲ ▼ ►` (Flechas D-Pad): Navegación geométrica fluida.
  - `OK / Enter`: Seleccionar o pausar video.
  - `ATRÁS / ESC / Return (LG 461, Samsung 10009)`: Salir del reproductor o volver.
- **Menú Lateral Desplegable (Sidebar):** Filtrado por Todo el Catálogo, Películas, Series, Anime y Géneros temáticos.
- **Catálogo Multi-Proveedor Completo:**
  - PelisPedia, Cuevana 3, TYanime y Archive.org con scraping multi-página en paralelo.
  - Más de 1,000 títulos en catálogo instantáneo con caché local.
- **Televisión en Vivo Segmentada (455 canales):**
  - Televisión de España, México, Argentina, Latinoamérica (Colombia, Chile, Perú).
  - Canales 24/7 de Cine, Deportes, Noticias, Infantil y Documentales de fuentes abiertas de iptv-org.
- **Detector Inteligente de Calidad:** Distingue automáticamente entre copias digitales limpias (HD 1080p) y grabaciones de sala (CINE/CAM con anuncios de apuestas).
- **Consumo Mínimo de Recursos:** Menos de 15 MB de memoria RAM en el televisor.
- **Reproductor de Video Nativo:** HLS.js con búfer anti-freeze y reproducción directa de MP4.

---

## Despliegue en Vercel (Paso a Paso)

### Mediante GitHub (Recomendado)
1. Sube este proyecto a tu repositorio de GitHub:
   ```bash
   git init
   git add .
   git commit -m "Smart TV Hub - Version Final"
   git branch -M main
   git remote add origin https://github.com/Alex1011m/Pelicuals.git
   git push -u origin main
   ```
2. Entra en [vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
3. Haz clic en **"Add New..."** -> **"Project"**.
4. Importa el repositorio `Alex1011m/Pelicuals`.
5. En **Framework Preset**, déjalo en **"Other"**.
6. Haz clic en **Deploy**. ¡En menos de 1 minuto tendrás tu enlace `https://pelicuals.vercel.app`!

---

## Cómo usarlo en el Televisor

1. Enciende el Smart TV y abre la aplicación **Navegador Web** (Web Browser).
2. En la barra de direcciones, escribe la URL generada por Vercel.
3. **Recomendación:** Añade la página a **Marcadores / Favoritos** del televisor o configúrala como **Página de Inicio** del navegador. Así, quien use la TV solo tendrá que abrir el navegador para disfrutar del contenido.

---

## Prueba Local en tu PC

Puedes probar y navegar la app en tu computadora con las flechas del teclado:
```bash
node server.js
```
Abre en tu navegador: `http://localhost:3000` (LAN: `http://192.168.0.108:3000`).
