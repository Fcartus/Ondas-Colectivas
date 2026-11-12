# Cómo subir esta carpeta a GitHub

Esta carpeta tiene **exactamente** lo que va en el repositorio (sin `node_modules` ni certificados).

## Opción A · Desde la página de GitHub (sin instalar nada)

1. En github.com: **New repository** → ponle nombre (por ejemplo `ondas-colectivas`) → **Public** → **Create repository**.
2. En el repositorio vacío: **uploading an existing file**.
3. Abre esta carpeta en el Explorador, selecciona **todo su contenido** (Ctrl+A), incluidas las carpetas `.github` y `public`, y arrástralo a la página.
   - Si la carpeta `.github` no aparece en el Explorador: **Vista → Mostrar → Elementos ocultos**.
   - Revisa en la lista de la página que esté `.github/workflows/pages.yml`: sin ese archivo no se publica solo.
4. Abajo: **Commit changes**.
5. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
6. Pestaña **Actions**: espera a que "Publicar en GitHub Pages" termine en verde (1–2 minutos). Si se ejecutó antes del paso 5 y falló, ábrelo y pulsa **Re-run all jobs**.
7. Listo:
   - **Pantalla (proyector):** `https://<tu-usuario>.github.io/<repositorio>/pantalla.html`
   - **Teléfonos:** escanean el QR que muestra la pantalla.

## Opción B · Con git

```bash
git init -b main
git add .
git commit -m "Ondas colectivas"
git remote add origin https://github.com/<tu-usuario>/<repositorio>.git
git push -u origin main
```

Después, los pasos 5 a 7 de la opción A.

## Antes de publicar

- **`public/config.js` queda público**, con el usuario y la contraseña de EMQX. Hoy EMQX los rechaza ("Not authorized") y la experiencia usa sola el broker público de respaldo. Revisa el usuario en la consola de EMQX Cloud (Access Control → Authentication), idealmente uno nuevo con permiso solo para `tacto/#`, y cambia `username` y `password` en `config.js`.
- **Licencias de los sonidos:** los loops de `public/sonidos/` vienen de Freesound (el número del nombre es el id del sonido: `freesound.org/s/<número>`). Si alguno es **CC BY**, agrega su crédito (autor y enlace) en el README.

## Para cambiar algo después

Sube el archivo modificado al repositorio (en la página: entra a la carpeta → **Add file → Upload files**) y la publicación se actualiza sola en 1–2 minutos. Para agregar loops, súbelos a `public/sonidos/`.
