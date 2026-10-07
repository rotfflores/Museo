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
    { id: "beginning", title: "Aquí comenzó todo.", route: null },
    { id: "moments", title: "Momentos que se quedaron.", route: null },
    { id: "little-things", title: "Pequeñas cosas, grandes recuerdos.", route: null },
    { id: "you", title: "Así te veo yo.", route: null },
    { id: "future", title: "Lo que todavía nos espera.", route: null },
    { id: "artwork", title: "Una obra para ti.", route: null, requires: ["beginning", "moments", "little-things", "you", "future"] }
  ]
};
