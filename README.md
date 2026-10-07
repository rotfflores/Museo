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

## Nuestra primera salida: captura y foto

El recuerdo "Nuestra primera salida" muestra dos imágenes que se amplían al tocarlas. Para usar las reales, reemplaza estos archivos con el mismo nombre (o cambia la ruta en dist/config.js, campos chat y photo de la pieza first-date):

- dist/assets/primera-salida-chat.svg: captura de ejemplo hecha con los mensajes de la sala. Puedes poner, por ejemplo, primera-salida-chat.jpg y actualizar la ruta.
- dist/assets/primera-salida.jpg: marcador "Aquí va la foto de nuestra primera salida". Guarda tu foto con ese mismo nombre. También aparece en el cuadro de la sala 3D.

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

## Imágenes de demostración descargadas

- Primera pieza: assets/whatsapp-demo.jpg, captura sin modificaciones de VincentLR, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:WhatsApp_Chatting_with_Dark_Mode.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Aparece en la vitrina y en el recuerdo ampliable. Es una conversación de ejemplo con una invitación a salir.
- Segunda pieza: assets/primera-salida-cafe.jpg, fotografía de Wesley Davi, [Pexels](https://www.pexels.com/photo/a-couple-on-a-date-in-a-cafe-looking-at-each-other-and-smiling-16122179/), [licencia Pexels](https://www.pexels.com/license/). Descarga a 1600 píxeles de ancho. Aparece en el cuadro y en el recuerdo ampliable.

Los créditos se muestran debajo de cada imagen. Para sustituirlas por recuerdos personales, edita exhibits[0].screenshot y exhibits[1].photo en dist/config.js, y retira sus respectivos screenshotCredit/photoCredit. El campo chat de la segunda pieza sigue disponible para añadir otra captura. Los antiguos marcadores se conservan.

La transición de carga utiliza ahora vidrio esmerilado, perfiles finos de bronce, título de sala y apertura lateral. Respeta la preferencia de movimiento reducido.

## Controles y notas de sala

La escena sigue el arrastre del dedo o del mouse en el vestíbulo y en la sala. Los arrastres del mouse nunca cambian de pieza; en pantalla táctil, un deslizamiento rápido hacia la izquierda avanza y hacia la derecha vuelve, mientras se contempla un recuerdo. WASD y las flechas conservan el movimiento normal.

La captura de WhatsApp, la foto, los anillos y la llave abren una nota lateral dentro de la sala. No hay cambio de página ni fondo modal. Las notas admiten cierre con X o Escape, cierran sus medios al salir y conservan los sellos y las pistas. El primer mensaje ofrece un botón «Ver captura en grande»: abre una vista de lectura ampliada solo al solicitarla y vuelve a la nota al cerrarse.

El vestíbulo utiliza puertas de vidrio con apertura lateral; la sala 01 utiliza nogal y bronce con apertura de bisagras. La cámara del vestíbulo comienza y permanece en el mismo encuadre: no vuelve a ejecutar un vuelo al terminar la carga ni oscila sin interacción. Los retornos de cámara pendientes se cancelan al cambiar de pantalla.

## Sala 02: Momentos que se quedaron

La galería conserva sus tres zonas y ocho recuerdos. Se retiraron las tres bancas, sus superficies interactivas y sus colisiones. «Contemplar» ofrece una vista desde el pasillo despejado. La cámara secreta está en el muro derecho al entrar a «La belleza de lo cotidiano»; la ayuda indica su nueva ubicación.

Las seis fotografías y el video del aniversario son ejemplos descargados de Pexels, con créditos en las notas de las fotos y en la ayuda del recorrido para el video. Las dedicatorias de los videos también se conservan en esa ayuda. Las fotografías se sirven localmente a 1600 píxeles de ancho; el video del aniversario está optimizado a 1280 × 720 y no tiene sonido audible original, como indican sus créditos. No se presentan como recuerdos personales de Daniel y Sofía.

«Una canción que me lleva a ti» sustituye el clip de risas con el video de WhatsApp aportado por el usuario: se conserva completo, sin modificar el audio ni el archivo original, a 576 × 976 y 56,83 segundos. Su cuadro es vertical y mantiene toda la imagen; el video se reproduce dentro del propio marco 3D, sin abrir una ventana. Conserva el identificador `sonaba` para respetar el progreso existente. Se retiraron los círculos decorativos y los aros persistentes del suelo de la sala; la señal breve de un toque para caminar sigue disponible.

Al elegir cualquiera de los videos, la cámara encuadra el cuadro según el tamaño de pantalla. El botón queda centrado en la portada y aparecen controles discretos para reproducir/pausar, buscar un momento, silenciar y volver. La reproducción usa una VideoTexture con proporciones originales; salir, caminar a otra obra o abrir el mapa/pasaporte detiene el video, restaura la portada y libera sus recursos. El ambiente se pausa al reproducir y se restaura al terminar la visita al cuadro. Sin WebGL se ofrece el video en la misma sala, nunca en un diálogo. Los haces decorativos del techo se dibujan en la vista directa y se excluyen del espejo mediante una capa de cámara separada, para evitar las líneas discontinuas en el reflejo sin quitar la reflexión de las obras y los muros.

| Recuerdo | Archivo en dist/assets/sala02 | Fuente y autor |
| --- | --- | --- |
| Perdernos para encontrarnos | aventuras-camino.jpg | [Nascimento Vieira: carretera al atardecer](https://www.pexels.com/photo/winding-road-by-the-seashore-at-sunset-16295810/) |
| Nuestro lugar favorito | aventuras-lugar.jpg | [hubbugaye: dos cafés junto a la ventana](https://www.pexels.com/photo/cozy-coffee-cups-by-a-window-in-urban-setting-29392194/) |
| Un día sin planes | cotidiano-sin-planes.jpg | [RDNE Stock project: libros y fruta en un pícnic](https://www.pexels.com/photo/a-stack-of-books-and-fruits-on-a-picnic-blanket-5530673/) |
| La felicidad también era esto | cotidiano-felicidad.jpg | [Kadir Avşar: mesa para dos con pasta y vino](https://www.pexels.com/photo/a-table-with-two-plates-of-pasta-and-wine-24869084/) |
| Una canción que me lleva a ti | cancion-para-ti.mp4 y cancion-para-ti-portada.jpg | Video de WhatsApp aportado por el usuario, con audio original. Portada extraída del propio clip. |
| Celebrarte siempre | celebrar-pastel.jpg | [Snap Spark: pastel con velas encendidas](https://www.pexels.com/photo/delightful-birthday-cake-with-candles-lit-33930868/) |
| Otro recuerdo para guardar | celebrar-luces.jpg | [Trev W. Adams: fuegos artificiales sobre la ciudad](https://www.pexels.com/photo/fireworks-in-city-12304696/) |
| Un pedacito de nosotros | video-pedacito.mp4 y video-pedacito-portada.jpg | [Jep Gambardella: abrazo al atardecer](https://www.pexels.com/video/couple-hugging-each-other-during-sunset-5102615/) |

Los recursos de Pexels se distribuyen bajo su [licencia](https://www.pexels.com/license/); el video aportado por el usuario conserva su contenido original y no se atribuye a Pexels. Para sustituir recursos, reemplaza los archivos o edita `momentsRoom.exhibits[].src`, `poster`, `alt`, `aspectRatio`, `frame`, `mediaLabel` y `credit` en dist/config.js. Elimina `credit` al usar contenido personal. Los videos sólo se descargan al pulsar reproducir.

## Sala 03: Pequeñas cosas, grandes recuerdos

Sala circular e íntima: seis vitrinas de madera oscura y cristal alrededor de la mesa «Nuestra colección». Se entra por la puerta 03 del vestíbulo o desde el mapa; la puerta de regreso está detrás de la cámara, como en las salas 01 y 02.

- Al enfocar un objeto aparece «Examinar recuerdo». Al examinarlo se abre la nota lateral con el objeto en 3D: se gira arrastrando (o con las flechas y los botones), se acerca con la rueda o pellizcando dentro de límites, y «Restablecer vista» lo devuelve a su encuadre. Mientras tanto la sala no se mueve; al cerrar, el visitante vuelve a donde estaba.
- Cada objeto examinado deja su miniatura en la mesa; tocar la mesa o una miniatura vuelve a abrir el recuerdo. «Objetos descubiertos: n de 6» se calcula con los objetos configurados; al examinarlos todos se entrega el sello.
- La pista secreta es una pequeña flor dorada en el costado derecho de la mesa central (id `little-things-flower`).
- Personaliza en dist/config.js, `littleThingsRoom.objects[]`: `object` (cups, tickets, flower, suitcase, note, keychain o photo), `model` (ruta .glb/.gltf opcional), `position` (1 a 6), `title`, `date`, `description`, `dedication`, `message`, `photo` y `photoAlt` (opcionales; cuentan en el límite de 25 fotos), `audio` y `audioLabel` (opcionales; pausan el ambiente mientras suenan), `tags` (destinos de la maleta), `ticketText`, `noteText` y `cardText`. Con `object: "photo"` y una `photo`, el recuerdo se muestra como fotografía enmarcada sobre el pedestal con las mismas funciones.
