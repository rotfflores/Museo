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
    finalRoomSoon: "La sala final estará disponible pronto",
    finalRoomUnlocked: "La última sala ya puede abrirse",
    cluesComplete: "Has reunido las cinco pistas. En la sala final te espera una sorpresa adicional",
    ambientUnavailable: "El ambiente estará disponible pronto. Puedes continuar tu visita."
  },
  resources: {
    /* Una ruta local, por ejemplo assets/ambiente.mp3, o null. */
    ambientAudio: "assets/barbie-rapunzel-background.mp3",
    /* Un ambiente instrumental suave generado en el navegador. */
    synthesizedAmbient: false,
    volume: 0.12
  },
  rooms: [
    { id: "beginning", title: "Aquí comenzó todo.", route: "beginning-room.js", pieces: ["message", "first-date", "together"] },
    { id: "moments", title: "Momentos que se quedaron.", route: "moments-room.js", piecesFrom: "momentsRoom" },
    { id: "little-things", title: "Pequeñas cosas, grandes recuerdos.", route: "little-things-room.js", piecesFrom: "littleThingsRoom" },
    { id: "you", title: "Así te veo yo.", route: "you-room.js", piecesFrom: "youRoom" },
    { id: "future", title: "Lo que todavía nos espera.", route: "future-room.js", piecesFrom: "futureRoom" },
    { id: "artwork", title: "Una obra para ti.", route: "artwork-room.js", piecesFrom: "artworkRoom", requires: ["beginning", "moments", "little-things", "you", "future"] }
  ],
  /* Las pistas tienen su propio contador; no son requisitos para los sellos. */
  clueIds: ["beginning-key", "moments-camera", "little-things-flower", "you-star", "future-compass"],
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
        src: "assets/sala02/aventuras-camino.jpg", alt: "carretera entre montañas junto al mar al atardecer",
        credit: { author: "Nascimento Vieira", url: "https://www.pexels.com/photo/winding-road-by-the-seashore-at-sunset-16295810/" } },
      { id: "lugar-favorito", type: "photo", zone: 0, title: "Nuestro lugar favorito", date: "Abril de 2026",
        phrase: "La mesa junto a la ventana ya sabía nuestros nombres.",
        anecdote: "Pedíamos lo mismo de siempre y aun así cada visita se sentía nueva. Creo que mi lugar favorito eras tú.",
        src: "assets/sala02/aventuras-lugar.jpg", alt: "dos tazas de café en una mesa junto a la ventana",
        credit: { author: "hubbugaye", url: "https://www.pexels.com/photo/cozy-coffee-cups-by-a-window-in-urban-setting-29392194/" } },
      { id: "sin-planes", type: "photo", zone: 1, title: "Un día sin planes", date: "Un domingo cualquiera · mayo de 2026",
        phrase: "No pasó nada extraordinario. Y fue perfecto.",
        anecdote: "Nos quedamos en la manta hasta que se fue el sol. No hacía falta ir a ningún lado.",
        src: "assets/sala02/cotidiano-sin-planes.jpg", alt: "libros, fruta y tazas sobre una manta de pícnic",
        credit: { author: "RDNE Stock project", url: "https://www.pexels.com/photo/a-stack-of-books-and-fruits-on-a-picnic-blanket-5530673/" } },
      { id: "felicidad", type: "photo", zone: 1, title: "La felicidad también era esto", date: "Cena en casa · junio de 2026",
        phrase: "Pasta, risas y la cocina hecha un desastre.",
        anecdote: "Se nos pasó un poco la salsa y nos reímos tanto que ya no importó. Esa noche entendí que la felicidad también era esto.",
        src: "assets/sala02/cotidiano-felicidad.jpg", alt: "una mesa para dos con pasta y dos copas de vino",
        credit: { author: "Kadir Avşar", url: "https://www.pexels.com/photo/a-table-with-two-plates-of-pasta-and-wine-24869084/" } },
      { id: "sonaba", type: "video", zone: 1, title: "Una canción que me lleva a ti", date: "Una dedicatoria para ti",
        mediaLabel: "CANCIÓN", frame: "portraitScreen", aspectRatio: [576, 976],
        phrase: "Hay canciones que siempre me llevan a ti.",
        dedication: "Cada vez que escucho esta canción pienso en ti: en tu sonrisa, en la calma que me das y en todo lo que quiero vivir a tu lado. La guardé aquí para que, cuando la escuches, también me sientas cerca.",
        src: "assets/sala02/cancion-para-ti.mp4", poster: "assets/sala02/cancion-para-ti-portada.jpg" },
      { id: "celebrarte", type: "photo", zone: 2, title: "Celebrarte siempre", date: "Tu cumpleaños · septiembre de 2026",
        phrase: "Cada vela fue un deseo, y todos tenían tu nombre.",
        anecdote: "Cantamos desafinados y apagaste las velas a la primera. Pedí en silencio poder celebrarte muchos años más.",
        src: "assets/sala02/celebrar-pastel.jpg", alt: "pastel decorado con cerezas y velas encendidas",
        credit: { author: "Snap Spark", url: "https://www.pexels.com/photo/delightful-birthday-cake-with-candles-lit-33930868/" } },
      { id: "otro-recuerdo", type: "photo", zone: 2, title: "Otro recuerdo para guardar", date: "Fin de año · diciembre de 2026",
        phrase: "Las luces del cielo, y tú mirándolas.",
        anecdote: "Mientras todos veían los fuegos artificiales, yo te miraba a ti. Ese fue mi momento favorito de la noche.",
        src: "assets/sala02/celebrar-luces.jpg", alt: "fuegos artificiales sobre una ciudad reflejados en el río",
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
      hint: "Ve a la mesa redonda del centro y rodéala por la derecha: en el borde que mira hacia la derecha brilla una florecita dorada. Tócala."
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
  },
  /* Sala 04. Cambia fotos, textos, audios y canciones. Las fotos cuentan en el límite de 25 del museo
     (puedes reutilizar imágenes ya usadas); las canciones, en el máximo de 5. Una canción sin "audio"
     ni "link" no se muestra. "audio" es un archivo local (por ejemplo assets/sala04/cancion.mp3). */
  youRoom: {
    title: "Así te veo yo",
    subtitle: "Quería que, por un momento, pudieras verte a través de mis ojos.",
    completionMessage: "Esta sala guarda algo que quería que supieras: todo lo que admiro de ti.",
    clue: {
      id: "you-star",
      message: "Hay formas de brillar que solo descubrimos al conocer a alguien. Has encontrado otra parte de la sorpresa.",
      hint: "Acércate al caballete del centro y mira abajo, a la derecha de sus patas: ahí brilla una estrella dorada. Tócala."
    },
    portraits: [
      { id: "alegria", title: "Tu manera de alegrar mis días", phrase: "Tu risa, siempre.",
        dedication: "Hay algo en tu risa que hace que hasta un día complicado se sienta más ligero.",
        photo: "assets/sala04/retrato-alegria.jpg", alt: "una mujer sonríe con luz cálida junto a una puerta", audio: null, audioLabel: "Escuchar a {sender}",
        credit: {author: "Konstantin Mishchenko", url: "https://www.pexels.com/photo/portrait-of-a-smiling-woman-in-warm-lighting-28442312/"} },
      { id: "admiro", title: "Lo que admiro de ti", phrase: "Tu fuerza tranquila.",
        dedication: "Admiro cómo sigues adelante, cómo te esfuerzas y cómo encuentras fuerzas incluso cuando las cosas cuestan.",
        photo: "assets/sala04/retrato-admiro.jpg", alt: "retrato sereno de una mujer de perfil con luz natural", audio: null, audioLabel: "Escuchar a {sender}",
        credit: {author: "Alina Chernii", url: "https://www.pexels.com/photo/portrait-of-a-woman-from-profile-18841733/"} },
      { id: "gestos", title: "Tus pequeños gestos", phrase: "Detalles que lo cambian todo.",
        dedication: "A veces es una pregunta, un abrazo o la forma en que me escuchas. Son detalles tuyos que para mí significan muchísimo.",
        photo: "assets/sala04/retrato-gestos.jpg", alt: "dos manos se entrelazan suavemente al atardecer", audio: null, audioLabel: "Escuchar a {sender}",
        credit: {author: "Jonathan Borba", url: "https://www.pexels.com/photo/romantic-couple-holding-hands-at-sunset-28961734/"} },
      { id: "ser-yo", title: "Contigo puedo ser yo", phrase: "Sin palabras perfectas.",
        dedication: "Me gusta poder hablar contigo sin tener que encontrar las palabras perfectas. Sentir que me escuchas también es una forma de sentirme querido.",
        photo: "assets/sala04/retrato-ser-yo.jpg", alt: "una mujer mira a través de una ventana con luz suave", audio: null, audioLabel: "Escuchar a {sender}",
        credit: {author: "behrouz sasani", url: "https://www.pexels.com/photo/portrait-of-a-woman-through-a-window-5590429/"} },
      { id: "elegirte", title: "Te sigo eligiendo", phrase: "Hoy y todos los días.",
        dedication: "Por lo que hemos vivido y por todo lo que sigo descubriendo de ti. Me hace feliz continuar esta historia contigo.",
        photo: "assets/sala04/retrato-elegirte.jpg", alt: "una mujer iluminada por el sol al atardecer en un paisaje natural", audio: null, audioLabel: "Escuchar a {sender}",
        credit: {author: "rasul lotfi", url: "https://www.pexels.com/photo/woman-portrait-at-sunset-14411942/"} }
    ],
    centerpiece: {
      id: "obra-central", title: "Mi obra favorita", plaque: "Hay algo más que quiero mostrarte.",
      photo: "assets/sala04/obra-favorita.jpg", alt: "una pareja se abraza con sus frentes juntas bajo una luz cálida",
      credit: {author: "Oğuz Uğur", url: "https://www.pexels.com/photo/portrait-of-hugging-couple-20103982/"},
      dedication: "Después de todo lo que has visto, quería decirte algo sencillo: me encanta la persona que eres y me hace feliz compartir mi vida contigo."
    },
    /* "near" indica junto a qué retrato (1 a 5) va cada estación. Audios aportados por el usuario. */
    songs: [
      { id: "cancion-inicio", near: 1, title: "When I Look at You", artist: "Miley Cyrus", cover: null, audio: "assets/sala04/when-i-look-at-you.mp3", link: null,
        dedication: "Mirarte me devuelve la calma. Contigo me siento en casa." },
      { id: "cancion-ti", near: 3, title: "Just the Way You Are", artist: "Bruno Mars", cover: null, audio: "assets/sala04/just-the-way-you-are.mp3", link: null,
        dedication: "Me encantas tal como eres, incluso cuando tú misma lo olvidas." },
      { id: "cancion-juntos", near: 5, title: "Perfect", artist: "Ed Sheeran", cover: null, audio: "assets/sala04/perfect.mp3", link: null,
        dedication: "Un baile contigo y todos los días que quiero compartir a tu lado." }
    ]
  },
  /* Sala 05. Cinco planes que {sender} quiere vivir contigo, cada uno como una obra por crear.
     "scene" elige el pequeño escenario 3D del marco: dinner, journey, first-time, slow-day o dream.
     "photo" (opcional) reemplaza el escenario por una fotografía o ilustración y cuenta en el límite de 25.
     "invitation" (opcional, solo en un plan): fecha, hora, lugar y mensaje. Deja vacío lo que no quieras mostrar. */
  futureRoom: {
    title: "Lo que todavía nos espera",
    subtitle: "Este museo guarda nuestra historia. Aquí empieza lo que todavía podemos escribir.",
    completionMessage: "Todavía quedan recuerdos por crear. Esta sala ya tiene su sello.",
    clue: {
      id: "future-compass",
      message: "No sabemos cada paso que viene, pero podemos elegir hacia dónde caminar juntos.",
      hint: "Ve a la mesa del libro y rodéala por la izquierda: bajo el borde de ese costado brilla una brújula dorada. Tócala."
    },
    book: {
      title: "Nuestro próximo capítulo",
      empty: "Cuando encuentres un plan que te ilusione, puedes guardarlo aquí.",
      choose: "Me gustaría empezar por este"
    },
    plans: [
      { id: "cita", scene: "dinner", title: "Una cita solo para nosotros",
        description: "Una cena tranquila o un picnic, sin prisas y sin nadie más.",
        dedication: "Quiero seguir haciendo espacio para nosotros, incluso entre los días más ocupados.",
        photo: null, photoAlt: "",
        invitation: { date: "", time: "", place: "",
          message: "Ejemplo de invitación: me gustaría invitarte a una noche solo para nosotros. Cuando tú quieras, elegimos juntos el día." } },
      { id: "lugar", scene: "journey", title: "Un lugar por descubrir",
        description: "Visitar una ciudad, una playa o un pueblo que ninguno de los dos conozca.",
        dedication: "Todavía hay lugares que no conozco y que me gustaría descubrir contigo.",
        photo: null, photoAlt: "", invitation: null },
      { id: "primera-vez", scene: "first-time", title: "Nuestra próxima primera vez",
        description: "Una clase de baile, cocinar una receta nueva o probar algo que nunca hemos hecho.",
        dedication: "Me gusta pensar que todavía nos quedan muchas primeras veces juntos.",
        photo: null, photoAlt: "", invitation: null },
      { id: "sin-prisa", scene: "slow-day", title: "Un día sin prisa",
        description: "Una tarde de películas, un desayuno largo y tiempo para descansar.",
        dedication: "No todos nuestros planes tienen que ser grandes. A veces solo quiero tiempo contigo.",
        photo: null, photoAlt: "", invitation: null },
      { id: "sueno", scene: "dream", title: "Un sueño compartido",
        description: "Una meta significativa que elijamos juntos y que podamos construir a nuestro ritmo.",
        dedication: "Este espacio es para algo que nos ilusione a los dos y que podamos construir a nuestro ritmo.",
        photo: null, photoAlt: "", invitation: null }
    ]
  },
  /* Sala 06, el cierre. Se abre con los cinco primeros sellos; las pistas solo abren la vitrina secreta.
     La foto, el video y la foto opcional de la sorpresa cuentan en los límites de 25 fotos y 5 videos
     (una ruta ya usada en otra sala no vuelve a contar). Deja en null o "" lo que no quieras mostrar. */
  artworkRoom: {
    title: "Una obra para ti",
    subtitle: "Después de recorrer nuestra historia, hay algo más que quiero decirte.",
    completionTitle: "Has recorrido nuestro museo",
    completionMessage: "La visita termina aquí. Nuestra historia continúa.",
    centerpiece: {
      id: "obra-final", plaque: "Nuestra historia sigue",
      photo: "assets/sala06/obra-final-atardecer.jpg", alt: "Pareja abrazada de espaldas frente al mar durante un atardecer",
      credit: {author: "Roshan Fotowala", url: "https://www.pexels.com/photo/couple-embracing-on-a-beach-at-sunset-15716670/"},
      /* Cambia "celebration" en la parte superior (por ejemplo "Nuestro sexto mes juntos") y adapta la dedicatoria. */
      dedication: "Este museo tiene un poco de lo que hemos vivido, pero hay mucho que ninguna sala podría guardar. Gracias por compartir tu tiempo, tu cariño y tu historia conmigo. Feliz aniversario. Me hace ilusión todo lo que todavía nos espera."
    },
    letter: {
      id: "carta",
      greeting: "{recipient}:",
      body: [
        "Quería regalarte algo que pudieras recorrer, porque nuestra historia está hecha de muchos momentos.",
        "Mientras preparaba este museo, recordé cómo empezamos, las cosas pequeñas que compartimos y todo lo que admiro de ti. Me hizo feliz darme cuenta de cuántos recuerdos hemos construido.",
        "Gracias por las conversaciones, las risas y el tiempo juntos. Espero que al visitar estas salas hayas sentido el cariño con el que elegí cada detalle.",
        "Feliz aniversario. Todavía tengo muchas ganas de seguir creando recuerdos contigo."
      ],
      closing: "Con amor,",
      signature: "{sender}.",
      /* Narración opcional, por ejemplo assets/sala06/mi-voz.mp3. */
      audio: null, audioLabel: "Escuchar mi voz"
    },
    /* Dedicatoria audiovisual opcional: { src: "assets/sala06/dedicatoria.mp4", poster: null, title: "..." }. */
    video: null,
    vitrine: {
      title: "Una cita para seguir escribiendo nuestra historia",
      message: "Este regalo incluye una tarde para nosotros: tu comida favorita, una película que elijas y tiempo para disfrutar juntos.",
      kind: "Una invitación especial",
      date: "", place: "", instructions: "",
      photo: null, photoAlt: ""
    },
    card: {
      phrase: "Nuestra historia merece su propio museo",
      fileName: "nuestro-museo-recuerdo.png"
    }
  }
};
