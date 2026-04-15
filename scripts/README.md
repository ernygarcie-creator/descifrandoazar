# Scripts Base

Estos scripts usan `Node.js`, no el navegador.

`Node.js` es el entorno que permite ejecutar JavaScript desde consola para tareas como:

- leer y escribir archivos,
- validar entradas,
- preparar actualizaciones,
- y más adelante recalcular los JSON productivos.

Ejemplos:

```powershell
node scripts/calcular_tris.js --input entrada-tris.json --write
node scripts/calcular_chispazo.js --input entrada-chispazo.json --write
node scripts/calcular_melate.js --input entrada-melate.json --write
```

## Qué hace esta base hoy

- valida el payload generado desde `admin.html`,
- lo normaliza,
- lo guarda en `data/admin_updates/`,
- y deja una bitácora en `data/admin_updates/history/`.

## Qué falta después

- recalcular estadísticas derivadas,
- regenerar los JSON que consume el frontend,
- y conectarlo a un backend seguro o GitHub Actions.
