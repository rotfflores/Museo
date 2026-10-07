/* Personaliza aquí la experiencia. No necesitas cambiar las vistas. */
window.MUSEUM_CONFIG = {
  id: "daniel-sofia-2027",
  sender: "Daniel",
  recipient: "Sofía",
  initials: "D & S",
  couple: "Daniel & Sofía",
  date: "14 de febrero de 2027",
  celebration: "Nuestro primer aniversario",
  ticketNumber: "DS-140227-001",
  texts: {
    invitationTitle: "Hay una historia que merece su propio museo.\nLa nuestra.",
    invitationBody: "Hoy quiero invitarte a recorrer lo que hemos vivido, lo que amo de ti y todo lo que todavía nos espera.",
    welcomeTitle: "Bienvenida, {recipient}.",
    welcomeBody: "Este museo guarda algunos de mis recuerdos favoritos contigo. Puedes explorarlo a tu ritmo: cada sala tiene algo que quiero contarte.",
    welcomeSignature: "Con amor, {sender}.",
    ticketDescription: "Una exposición dedicada a nuestra historia",
    ticketAdmission: "Admite a la persona más especial de mi vida",
    passportMessage: "Cada sala guarda una parte de nuestra historia. Explórala para recibir su sello.",
    roomSoon: "Esta sala estará disponible pronto",
    lockedRoom: "Se abrirá cuando completes las primeras cinco salas",
    ambientUnavailable: "El ambiente estará disponible pronto. Puedes continuar tu visita."
  },
  resources: {
    /* Una ruta local, por ejemplo assets/ambiente.mp3, o null. */
    ambientAudio: null,
    /* Un ambiente instrumental suave generado en el navegador. */
    synthesizedAmbient: true,
    volume: 0.12
  },
  rooms: [
    { id: "beginning", title: "Aquí comenzó todo.", route: "beginning-room.js", pieces: ["message", "first-date", "together"] },
    { id: "moments", title: "Momentos que se quedaron.", route: "moments-room.js", piecesFrom: "momentsRoom" },
    { id: "little-things", title: "Pequeñas cosas, grandes recuerdos.", route: "little-things-room.js", piecesFrom: "littleThingsRoom" },
    { id: "you", title: "Así te veo yo.", route: null },
    { id: "future", title: "Lo que todavía nos espera.", route: null },
    { id: "artwork", title: "Una obra para ti.", route: null, requires: ["beginning", "moments", "little-things", "you", "future"] }
  ],
  /* Las pistas tienen su propio contador; no son requisitos para los sellos. */
  clueIds: ["beginning-key", "moments-camera", "little-things-flower", "you-key", "future-key"],
  beginningRoom: {
    title: "Aquí comenzó todo",
    subtitle: "Antes de tener una historia, tuvimos un primer momento.",
    introduction: "Tres pequeños comienzos. Todo lo que vino después.",
    completionMessage: "Así empezó nuestra historia. Este recuerdo ya tiene un lugar en tu pasaporte.",
    clue: {
      id: "beginning-key",
      position: [-4.65, 1.7, -4.7],
      message: "Toda historia tiene un comienzo. Has encontrado el nuestro.",
      hint: "Busca junto a la columna izquierda, al fondo de la sala. En sus detalles dorados hay algo que puede abrir nuevas historias."
    },
    symbolicObject: { type: "interlocked-rings", color: "#c9a564", secondColor: "#b48b56" },
    exhibits: [
      {
        id: "message",
        title: "El mensaje que abrió la puerta",
        date: "20 de enero de 2026",
        description: "Un saludo sencillo. Un comienzo que no sabíamos que lo era.",
        dedication: "Parecía un mensaje cualquiera. Hoy sé que ahí empezó algo que cambiaría mis días.",
        screenshot: "assets/whatsapp-demo.jpg",
        screenshotAlt: "Captura de ejemplo de WhatsApp: dos personas se saludan y acuerdan una salida",
        screenshotCredit: {author: "VincentLR", url: "https://commons.wikimedia.org/wiki/File:WhatsApp_Chatting_with_Dark_Mode.jpg", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/"},
        messages: [
          { from: "sender", text: "Hola, {recipient}. Me quedé pensando en nuestra conversación de ayer.", time: "19:42" },
          { from: "recipient", text: "Hola, {sender}. Yo también. Qué bonito leerte.", time: "19:45" },
          { from: "sender", text: "¿Seguimos la conversación con un café algún día?", time: "19:47" },
          { from: "recipient", text: "Me encantaría. Creo que tenemos mucho que contarnos.", time: "19:49" }
        ]
      },
      {
        id: "first-date",
        title: "Nuestra primera salida",
        date: "1 de febrero de 2026",
        description: "Un café, dos sonrisas y la sensación de querer quedarse.",
        dedication: "Recuerdo los nervios antes de verte, lo rápido que pasó el tiempo y las ganas de volver a encontrarnos.",
        /* Reemplaza estos archivos por los reales (mismo nombre) o cambia la ruta. */
        chat: null,
        chatAlt: "Captura de la conversación antes de nuestra primera salida",
        photo: "assets/primera-salida-cafe.jpg",
        photoAlt: "Foto de ejemplo: una pareja sonríe mientras comparte una bebida en un café",
        photoCredit: {author: "Wesley Davi", url: "https://www.pexels.com/photo/a-couple-on-a-date-in-a-cafe-looking-at-each-other-and-smiling-16122179/", license: "Pexels", licenseUrl: "https://www.pexels.com/license/"},
        placeholder: "assets/first-date.svg",
        audio: null,
        audioLabel: "Escuchar a {sender}"
      },
      {
        id: "together",
        title: "El día que elegimos estar juntos",
        date: "14 de febrero de 2026",
        description: "Dos caminos que eligieron convertirse en uno.",
        dedication: "Ese día empezamos a escribir una historia que todavía quiero seguir viviendo contigo.",
        video: null,
        videoPoster: null
      }
    ]
  },
  /* Sala 02. Cambia títulos, fechas, frases y archivos; quita una pieza y el total se recalcula solo.
     Límite del paquete completo: hasta 25 fotos y 5 videos (contando todas las salas). */
  momentsRoom: {
    title: "Momentos que se quedaron",
    subtitle: "Hay momentos que terminan, pero nunca se van.",
    completionMessage: "Hay momentos que terminan, pero nunca se van. Esta sala ya forma parte de tu pasaporte.",
    zones: ["Nuestras aventuras", "La belleza de lo cotidiano", "Días para celebrar"],
    clue: {
      id: "moments-camera",
      message: "Hay instantes que merecen quedarse con nosotros. Has encontrado otra parte de la sorpresa.",
      hint: "Al entrar a «La belleza de lo cotidiano», busca un pequeño detalle dorado en el muro derecho."
    },
    exhibits: [
      { id: "perdernos", type: "photo", zone: 0, title: "Perdernos para encontrarnos", date: "Primer viaje juntos · marzo de 2026",
        phrase: "Ningún mapa nos llevó tan lejos como las ganas de seguir.",
        anecdote: "Lo que más recuerdo de ese día no es el lugar. Es que podía voltear y encontrarte a mi lado.",
        src: "assets/sala02/aventuras-camino.jpg", alt: "Fotografía de ejemplo: carretera entre montañas junto al mar al atardecer",
        credit: { author: "Nascimento Vieira", url: "https://www.pexels.com/photo/winding-road-by-the-seashore-at-sunset-16295810/" } },
      { id: "lugar-favorito", type: "photo", zone: 0, title: "Nuestro lugar favorito", date: "Abril de 2026",
        phrase: "La mesa junto a la ventana ya sabía nuestros nombres.",
        anecdote: "Pedíamos lo mismo de siempre y aun así cada visita se sentía nueva. Creo que mi lugar favorito eras tú.",
        src: "assets/sala02/aventuras-lugar.jpg", alt: "Fotografía de ejemplo: dos tazas de café en una mesa junto a la ventana",
        credit: { author: "hubbugaye", url: "https://www.pexels.com/photo/cozy-coffee-cups-by-a-window-in-urban-setting-29392194/" } },
      { id: "sin-planes", type: "photo", zone: 1, title: "Un día sin planes", date: "Un domingo cualquiera · mayo de 2026",
        phrase: "No pasó nada extraordinario. Y fue perfecto.",
        anecdote: "Nos quedamos en la manta hasta que se fue el sol. No hacía falta ir a ningún lado.",
        src: "assets/sala02/cotidiano-sin-planes.jpg", alt: "Fotografía de ejemplo: libros, fruta y tazas sobre una manta de pícnic",
        credit: { author: "RDNE Stock project", url: "https://www.pexels.com/photo/a-stack-of-books-and-fruits-on-a-picnic-blanket-5530673/" } },
      { id: "felicidad", type: "photo", zone: 1, title: "La felicidad también era esto", date: "Cena en casa · junio de 2026",
        phrase: "Pasta, risas y la cocina hecha un desastre.",
        anecdote: "Se nos pasó un poco la salsa y nos reímos tanto que ya no importó. Esa noche entendí que la felicidad también era esto.",
        src: "assets/sala02/cotidiano-felicidad.jpg", alt: "Fotografía de ejemplo: una mesa para dos con pasta y dos copas de vino",
        credit: { author: "Kadir Avşar", url: "https://www.pexels.com/photo/a-table-with-two-plates-of-pasta-and-wine-24869084/" } },
      { id: "sonaba", type: "video", zone: 1, title: "Una canción que me lleva a ti", date: "Una dedicatoria para ti",
        mediaLabel: "CANCIÓN", frame: "portraitScreen", aspectRatio: [576, 976],
        phrase: "Hay canciones que siempre me llevan a ti.",
        dedication: "Cada vez que escucho esta canción pienso en ti: en tu sonrisa, en la calma que me das y en todo lo que quiero vivir a tu lado. La guardé aquí para que, cuando la escuches, también me sientas cerca.",
        src: "assets/sala02/cancion-para-ti.mp4", poster: "assets/sala02/cancion-para-ti-portada.jpg" },
      { id: "celebrarte", type: "photo", zone: 2, title: "Celebrarte siempre", date: "Tu cumpleaños · septiembre de 2026",
        phrase: "Cada vela fue un deseo, y todos tenían tu nombre.",
        anecdote: "Cantamos desafinados y apagaste las velas a la primera. Pedí en silencio poder celebrarte muchos años más.",
        src: "assets/sala02/celebrar-pastel.jpg", alt: "Fotografía de ejemplo: pastel decorado con cerezas y velas encendidas",
        credit: { author: "Snap Spark", url: "https://www.pexels.com/photo/delightful-birthday-cake-with-candles-lit-33930868/" } },
      { id: "otro-recuerdo", type: "photo", zone: 2, title: "Otro recuerdo para guardar", date: "Fin de año · diciembre de 2026",
        phrase: "Las luces del cielo, y tú mirándolas.",
        anecdote: "Mientras todos veían los fuegos artificiales, yo te miraba a ti. Ese fue mi momento favorito de la noche.",
        src: "assets/sala02/celebrar-luces.jpg", alt: "Fotografía de ejemplo: fuegos artificiales sobre una ciudad reflejados en el río",
        credit: { author: "Trev W. Adams", url: "https://www.pexels.com/photo/fireworks-in-city-12304696/" } },
      { id: "pedacito", type: "video", zone: 2, title: "Un pedacito de nosotros", date: "Nuestro primer aniversario",
        phrase: "Pocos segundos, muchísimo amor.",
        dedication: "Un pedacito de lo que somos, para que lo lleves contigo siempre.",
        src: "assets/sala02/video-pedacito.mp4", poster: "assets/sala02/video-pedacito-portada.jpg",
        credit: { author: "Jep Gambardella", url: "https://www.pexels.com/video/couple-hugging-each-other-during-sunset-5102615/", note: "Clip de ejemplo sin audio original." } }
    ]
  },
  /* Sala 03. Cada objeto puede usar un modelo de demostración (object: "cups", "tickets", "flower",
     "suitcase", "note", "keychain"), un modelo propio .glb en "model" o, con object: "photo",
     una fotografía enmarcada sobre el pedestal ("photo"). "position" va de 1 a 6 alrededor de la mesa.
     Las fotos complementarias ("photo") cuentan dentro del límite de 25 fotografías del museo. */
  littleThingsRoom: {
    title: "Pequeñas cosas, grandes recuerdos",
    subtitle: "Para cualquiera son objetos. Para nosotros, son parte de nuestra historia.",
    completionMessage: "Lo pequeño también puede guardar una historia enorme. Ya tienes el sello de esta sala.",
    clue: {
      id: "little-things-flower",
      message: "Los detalles también guardan secretos. Has encontrado otra parte de la sorpresa.",
      hint: "Rodea la mesa central de «Nuestra colección»: en uno de sus costados hay un detalle muy pequeño."
    },
    objects: [
      { id: "tazas", object: "cups", model: null, position: 1, title: "Un café contigo", date: "Nuestras tardes de café",
        description: "Representan las conversaciones y el tiempo compartido.",
        dedication: "Muchas veces mi parte favorita del día fue sentarme contigo y hablar de cualquier cosa.",
        message: "", photo: null, photoAlt: "", audio: null, audioLabel: "Escuchar este recuerdo" },
      { id: "entradas", object: "tickets", model: null, position: 2, title: "Nuestra función favorita", date: "Una noche de cine",
        description: "Representan una salida especial.",
        dedication: "No recuerdo cada escena de la película, pero sí lo que sentí al tenerte a mi lado.",
        message: "", ticketText: "CINE · SALA 4 · FILA F", photo: null, photoAlt: "", audio: null },
      { id: "flor", object: "flower", model: null, position: 3, title: "Un detalle que se quedó", date: "Un día cualquiera",
        description: "Representa un regalo o gesto de cariño.",
        dedication: "Era una manera pequeña de decirte algo enorme: estaba pensando en ti.",
        message: "", cardText: "Pensé en ti", photo: null, photoAlt: "", audio: null },
      { id: "maleta", object: "suitcase", model: null, position: 4, title: "Donde fuimos juntos", date: "Nuestro primer viaje",
        description: "Representa un viaje o una aventura.",
        dedication: "El destino era una parte del viaje. La otra, y mi favorita, era compartirlo contigo.",
        message: "", tags: ["Oaxaca", "Playa del Carmen", "Ciudad de México"], photo: null, photoAlt: "", audio: null },
      { id: "nota", object: "note", model: null, position: 5, title: "Algo que quería decirte", date: "Un mensaje guardado",
        description: "Representa un mensaje guardado.",
        dedication: "Hay palabras que merecen conservarse porque todavía significan lo mismo.",
        message: "", noteText: "Gracias por quedarte. Contigo todo se siente como casa.", photo: null, photoAlt: "", audio: null },
      { id: "llavero", object: "keychain", model: null, position: 6, title: "Solo nosotros sabemos", date: "Nuestra pequeña historia",
        description: "Un objeto que representa una anécdota que sólo nosotros entendemos.",
        dedication: "Tal vez nadie más entienda por qué esto es especial. Me gusta que nosotros sí.",
        message: "", photo: null, photoAlt: "", audio: null }
    ]
  }
};
