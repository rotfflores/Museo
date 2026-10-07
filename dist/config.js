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
    { id: "moments", title: "Momentos que se quedaron.", route: null },
    { id: "little-things", title: "Pequeñas cosas, grandes recuerdos.", route: null },
    { id: "you", title: "Así te veo yo.", route: null },
    { id: "future", title: "Lo que todavía nos espera.", route: null },
    { id: "artwork", title: "Una obra para ti.", route: null, requires: ["beginning", "moments", "little-things", "you", "future"] }
  ],
  /* Las pistas tienen su propio contador; no son requisitos para los sellos. */
  clueIds: ["beginning-key", "moments-key", "little-things-key", "you-key", "future-key"],
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
  }
};
