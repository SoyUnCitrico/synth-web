# Respaldo de presets en Google Sheets

`synth-web` puede sincronizar el banco de presets (de Makwil y Modulor) con una Google Sheet
mediante un **Apps Script Web App**. Leer es público; **escribir exige una clave secreta**.

## Cómo funciona

- La barra de presets muestra un input **"Clave nube…"** y un botón **"Cargar nube"** (solo si
  `VITE_PRESETS_SHEET_URL` está configurada).
- **Cargar nube** descarga el banco de la hoja y lo fusiona con el local.
- Al **Guardar** o **Borrar** un preset con la clave cargada, se sube automáticamente el banco
  completo a la hoja (queda 100% sincronizada, refleja también borrados).
- La clave se valida en el servidor (Apps Script); el frontend nunca la conoce de antemano.

> La clave es una contraseña de escritura compartida (viaja en el cuerpo de la petición y se
> guarda en `localStorage` en texto plano). Sirve para evitar escrituras anónimas; no es un
> secreto fuerte. No la commitees.

## Despliegue (una vez)

1. Crea una **Google Sheet** nueva (será la base de datos de presets).
2. `Extensiones → Apps Script`. Borra el contenido y pega el de [`Code.gs`](./Code.gs).
3. Define la clave secreta: `Configuración del proyecto` (engranaje) →
   **Propiedades del script** → añade `PRESETS_KEY` con el valor que quieras.
4. `Implementar → Nueva implementación → Tipo: Aplicación web`.
   - *Ejecutar como*: **Yo**.
   - *Quién tiene acceso*: **Cualquier usuario** (necesario para leer/escribir desde el navegador).
   - Implementar y **copiar la URL `/exec`**.
5. En la raíz del repo, copia `.env.example` a `.env.local` y pega la URL:
   ```
   VITE_PRESETS_SHEET_URL=https://script.google.com/macros/s/XXXX/exec
   ```
6. `npm run dev` (o `npm run build`). La UI de nube aparecerá en la barra de presets.

Cada vez que cambies `Code.gs` debes volver a **Implementar → Gestionar implementaciones →
Editar → Nueva versión** para que surta efecto.

## Formato en la hoja

Una fila por preset en la pestaña `Presets`:

| A (name)     | B (state JSON)         |
|--------------|------------------------|
| Mi patch     | `{"osc1Type":"sine",…}`|

El cuerpo de cable es el mismo archivo que el export/import local
(`{ format: "synth-web-presets", version: 1, presets: [...] }`).
