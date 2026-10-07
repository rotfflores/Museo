# El Museo de Nosotros

Primer módulo en HTML, CSS y JavaScript sin dependencias: invitación, boleto, puertas de entrada y vestíbulo. Las seis salas no contienen experiencias aún y no entregan sellos al tocarlas.

## Vista local

Desde esta carpeta, ejecuta `node preview.cjs` y abre `http://localhost:4173`. También puedes abrir `dist/index.html` directamente; un servidor mantiene un origen estable para guardar preferencias y progreso.

## Personalizar

Edita `dist/config.js`: nombres, iniciales, celebración, fecha, mensajes, número de boleto y recursos. Cambia `id` cuando prepares un regalo para otra pareja; cada identificador tiene su propio progreso local.

El ambiente se genera mediante Web Audio únicamente cuando la persona toca “Activar ambiente”. Para usar una grabación, añade el archivo a `dist/assets/` y coloca su ruta en `resources.ambientAudio`. Con `synthesizedAmbient: false` y sin grabación, la visita sigue funcionando y muestra un aviso discreto. La preferencia se guarda; al regresar se requiere otro toque para reproducir sonido.

## Conectar las salas después

La API `window.Museum.registerRoom(id, handler)` registra una sala. El handler recibe `{ config, returnToLobby }` y debe resolver `{ completed: true }` sólo al completar realmente su contenido. Entonces se guarda su sello. Ejemplo conceptual:

```js
Museum.registerRoom('beginning', async ({ returnToLobby }) => {
  // Abrir la experiencia y esperar su finalización real.
  // returnToLobby();
  // return { completed: true };
});
```

`Museum.openRoom(id)` respeta el bloqueo de la sexta sala. `Museum.getProgress()` devuelve una copia del progreso. No existe un botón de demostración que conceda sellos ficticios. Las rutas de configuración quedan preparadas en `null`, y el contenido futuro debe registrarse explícitamente.

## Vestíbulo en 3D

`dist/scene3d.js` dibuja el vestíbulo como una rotonda en 3D con Three.js (incluido en `dist/vendor/`, sin descargas): seis puertas-portal, un corazón de oro que abre el pasaporte, suelo de espejo y polvo dorado bajo el óculo. Al tocar una puerta, la cámara vuela hacia ella, la cruza y llama a `Museum.openRoom(id)`; después regresa al vestíbulo.

El 3D necesita servirse con `node preview.cjs` (o desde Sites): al abrir `dist/index.html` directamente, o en un navegador sin WebGL, se muestra el vestíbulo ilustrado.

## Accesibilidad y almacenamiento

Botones nativos, diálogo modal con cierre mediante Escape, foco devuelto al control de origen, foco visible y movimiento reducido. El estado guarda únicamente entrada al museo, salas completadas y preferencia sonora. El almacenamiento inaccesible o corrupto no impide navegar.

La publicación de Sites usa `dist/` como directorio estático. No requiere compilación, servicios externos ni fuentes remotas.
