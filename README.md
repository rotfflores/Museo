# El Museo de Nosotros

Experiencia en HTML, CSS y JavaScript. Conserva la invitación, el boleto y la rotonda 3D originales. La primera sala **Aquí comenzó todo** está completa; las otras cinco conservan su aviso de disponibilidad.

## Ejecutar y verificar

```sh
node preview.cjs
node --test tests/museum.test.cjs
```

Abre http://localhost:4173. Si el puerto está ocupado, usa la variable MUSEUM_PREVIEW_PORT. Los módulos de Three.js requieren HTTP. No se necesitan instalaciones ni fuentes externas. Sites sirve dist/.

## Primera sala

Desde la puerta 01 de la rotonda, el botón del vestíbulo o el mapa se entra a una galería con una vitrina de mensajes, un cuadro de la primera salida y dos piezas entrelazadas sobre un pedestal. Sus placas muestran títulos, fechas y descripciones.

- Arrastra para mirar. En escritorio, usa WASD o flechas para caminar y Q/E para girar. Los botones de dirección y giro funcionan con puntero y teclado.
- Elige una de las tres paradas para acercarte con un recorrido guiado que evita los objetos. Pulsa **Ver recuerdo** para abrirlo. Arrastrar nunca abre las piezas.
- Los recuerdos, el mapa y el pasaporte detienen la cámara y el renderizado. Al cerrar mediante el botón, Escape o el exterior del diálogo, se conserva la posición. Todo audio/video de la pieza se pausa y vuelve al inicio.
- El sello se entrega una sola vez al abrir los tres recuerdos. No requiere escuchar medios ni encontrar la llave.
- La llave se recoge con un toque sin arrastre o con **Recoger llave** al enfocarla. La ayuda sólo indica dónde buscar. Las pistas cuentan por separado.
- Con movimiento reducido, los trayectos guiados son inmediatos y el sello aparece sin animación.
- Si falta WebGL, las paradas, recuerdos y decoración de la columna siguen accesibles en una vista alternativa.

## Personalizar

Edita dist/config.js. beginningRoom contiene títulos, dedicatorias, fechas, mensajes, foto, audio/video, objeto simbólico y posición de la pista. Los datos actuales son de demostración.

| Campo | Uso |
| --- | --- |
| exhibits[0].messages | Mensajes con from, text y time. Admiten {sender} y {recipient}. |
| exhibits[0].screenshot | Ruta opcional a una captura; null usa mensajes configurables. |
| exhibits[1].photo | Foto opcional; null usa la ilustración provisional local. |
| exhibits[1].audio | Audio opcional del remitente; null oculta el botón. |
| exhibits[2].video | Video opcional, sin reproducción automática; null oculta el botón. |
| exhibits[2].videoPoster | Imagen opcional del video. |
| symbolicObject | interlocked-rings o interlocked-links y los dos colores. |
| clue.position | Coordenadas [x, y, z], limitadas a la zona accesible. |

Coloca los recursos en dist/assets/ y usa rutas relativas. Las fotos mantienen proporciones, se cargan al entrar y se limitan a 768/1024 píxeles en 3D. Los medios usan preload="none" y comienzan sólo al pulsar su botón. Los fallos de recursos configurados no impiden leer las dedicatorias.

El ambiente global se configura en resources: audio opcional o ambiente sintetizado. Requiere una acción incluso al recordar la preferencia. Cambia config.id para separar el progreso de diferentes parejas.

## Estructura reutilizable

- scene3d.js: rotonda original y puertas conectadas a Museum.openRoom(id).
- beginning-room.js: geometría y contenido de la primera sala.
- gallery-engine.js: motor local de Three.js, mirada, controles, enfoque, pausa y recorridos.
- navigation.mjs: colisiones y planificación A* de caminos seguros.
- progress.js: estado, persistencia y validación, separado del DOM y del motor.
- app.js: navegación general, diálogos, mapa, pasaporte y sonido.

Museum.registerRoom(id, handler) conecta salas futuras. Declara sus identificadores de piezas en config.rooms[].pieces y llama a Museum.discoverPiece(roomId, pieceId) al abrir cada vista. Devuelve {added, newlyCompleted}; sólo una colección completa concede el sello. Museum.findClue(id) guarda una pista válida una sola vez.

Museum.getProgress() devuelve copias del progreso. Museum.openContent({html, className, source, onClose}) abre un diálogo; debe recibir HTML que escape los datos configurables. Museum.openMap, Museum.openPassport, Museum.closeOverlay y Museum.returnToLobby completan la navegación. Los eventos museum:screen, museum:overlay y museum:progress coordinan motor y vistas.

Se conserva la clave museum-of-us:<id>:v1, extendida con discoveries y clues. Las visitas anteriores mantienen entrada y sonido. Los datos desconocidos se filtran; con almacenamiento bloqueado, la visita funciona en memoria. Tocar salas pendientes nunca da sellos.

## Comprobaciones

Las pruebas verifican progreso parcial, persistencia, sello único, independencia de pistas, bloqueo de la sexta sala, almacenamiento corrupto/bloqueado, colisiones y rutas guiadas. La revisión en navegador cubre las tres piezas, sello, llave explorada, regreso al vestíbulo, mapa, pasaporte y móvil.
