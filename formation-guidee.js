/* Formation guidée — SPA autonome (reproduction de la maquette de design).
   Thème sombre, 5 modules (notions + quiz 80 %), accès libre, attestation
   nominative imprimable + envoi au Worker Cloudflare (Airtable). Réutilise
   styles.css (.lead, .alert, .icards, .corps-3d, .evo3, …). */
(function () {
  'use strict';

  var ATTEST_ENDPOINT = 'https://attestations-tms.frankyray-21.workers.dev';
  var MODEL_SRC = 'models/corps-anatomie-mobile.glb';
  var K_PROG = 'tms_form_progress', K_ANS = 'tms_form_answers', K_NAME = 'tms_form_name';

  /* ---------------- DONNÉES ---------------- */
  var MODULES = [
    { id: 'comprendre', num: '01', title: 'Comprendre les TMS',
      notions: [
        { id: 'intro', title: "Qu'est-ce qu'un TMS ?", custom: 'cIntro' },
        { id: 'zones', title: 'Les zones du corps touchées', custom: 'cZones' },
        { id: 'types', title: 'Les types de TMS', custom: 'cTypes' },
        { id: 'facteurs', title: 'Les facteurs de risque', custom: 'cFacteurs' },
        { id: 'evolution', title: "L'évolution de la douleur", custom: 'cEvolution' }
      ],
      quiz: [
        { q: "Un TMS, dans la plupart des cas, c'est…", options: ["Un accident soudain et unique", "Une atteinte qui s'installe progressivement", "Une maladie contagieuse"], answer: 1,
          explain: "Le TMS n'est presque jamais le résultat d'un seul geste : il se développe peu à peu, quand les sollicitations dépassent la capacité du corps à récupérer.", ref: "CNESST – Les TMS (2023)" },
        { q: "Quelle zone du corps est la plus souvent touchée chez les travailleurs ?", options: ["Le bout des doigts", "Le bas du dos (lombalgie)", "Les oreilles"], answer: 1,
          explain: "La région lombaire est de loin la plus atteinte : manutention, postures contraignantes et efforts répétés s'y concentrent.", ref: "INSPQ – Portrait des TMS" },
        { q: "Parmi ces atteintes, laquelle est un TMS ?", options: ["La tendinite de l'épaule", "Une fracture par chute", "Une coupure"], answer: 0,
          explain: "Tendinite, bursite, lombalgie et syndrome du canal carpien sont des TMS. Une fracture ou une coupure est une lésion accidentelle, pas un TMS.", ref: "CNESST – Les TMS (2023)" },
        { q: "Le syndrome du canal carpien correspond à…", options: ["Une inflammation du genou", "Une compression du nerf médian au poignet", "Une douleur au cou"], answer: 1,
          explain: "Au poignet, le nerf médian passe dans un canal étroit ; gestes répétés et postures forcées le compriment, d'où fourmillements et perte de force dans la main.", ref: "INSPQ – Fiches TMS membre supérieur" },
        { q: "Pourquoi faut-il agir dès le premier inconfort ?", options: ["Pour être payé plus", "Parce qu'une atteinte précoce se règle plus facilement qu'une lésion installée", "Parce que c'est obligatoire chaque jour"], answer: 1,
          explain: "Plus la douleur dure, plus elle devient chronique et longue à récupérer. Agir tôt (signaler, ajuster le poste) évite la lésion durable.", ref: "CNESST – Prévention des TMS" }
      ] },
    { id: 'charge', num: '02', title: 'Fatigue & charge',
      notions: [
        { id: 'borg', title: "L'échelle de l'effort", extra: 'borg', intro: "Pour savoir si un effort est risqué, on écoute son corps. L'échelle de Borg note l'intensité ressentie, de « aucun effort » à « effort maximal ».",
          points: [ { title: 'Repère ta zone', text: "Entre « facile » et « un peu dur », tu tiens la durée. Au-delà de « dur », le risque grimpe vite." } ] },
        { id: 'fatigue', title: 'La fatigue musculaire', extra: 'fatigue', intro: "Un muscle fatigué protège moins l'articulation et se blesse plus facilement.",
          points: [ { title: "Ça s'accumule", text: "La fatigue monte sur le quart et sur la semaine si la récupération manque." }, { title: 'Écoute les signaux', text: "Souffle court, muscles qui brûlent, gestes moins précis : ce sont des alertes." }, { title: 'Varie les efforts', text: "Changer de tâche ou de prise répartit la charge sur le corps." }, { title: 'Alterne', text: "Des micro-pauses régulières valent mieux qu'un long effort sans relâche." }, { title: 'Récupère vraiment', text: "Pauses, eau et sommeil font partie du travail de prévention." } ] },
        { id: 'assis', title: 'Le travail statique', extra: 'statique', intro: "Rester figé, assis ou debout, fatigue aussi : le sang circule moins et les muscles posturaux se crispent en continu.",
          points: [ { title: 'Pourquoi ça fatigue', text: "Sans mouvement, les mêmes muscles restent contractés et mal irrigués : la tension s'accumule." }, { title: 'Bouge', text: "Lève-toi ou change de position toutes les 20 à 30 minutes." }, { title: 'Varie les appuis', text: "Alterne assis/debout et change de point d'appui pour répartir la charge." } ] },
        { id: 'disque', title: 'Bouger nourrit tes disques', extra: 'disque', intro: "Les disques de la colonne se nourrissent par le mouvement : varier la pression y fait entrer l'eau, les nutriments et l'oxygène, alors qu'une pression statique prolongée les prive et les fragilise." },
        { id: 'controle', title: 'Moyens de contrôle', extra: 'controle', intro: "Des gestes simples pour limiter la fatigue musculaire et récupérer au fil de la journée.",
          cards: [ { num: 1, title: 'Micro-pauses', text: "15 à 30 secondes, 3 à 4 fois par heure, pour relâcher les muscles." }, { num: 2, title: 'Rotation des tâches', text: "Alterner les tâches pour varier les muscles sollicités." }, { num: 3, title: 'Étirements', text: "S'échauffer et s'étirer avant et pendant le travail." }, { num: 4, title: 'Alterner les postures', text: "Éviter de rester trop longtemps dans la même position." } ] }
      ],
      quiz: [
        { q: "L'échelle de Borg sert à…", options: ["Mesurer le poids exact d'une charge", "Compter le nombre de pauses dans ton quart", "Estimer l'intensité de l'effort que tu ressens"], answer: 2,
          explain: "L'échelle de Borg cote la perception de l'effort, de « aucun effort » à « effort maximal ». C'est un repère simple pour situer où tu te trouves pendant une tâche.", ref: "INSPQ – Évaluation de la charge physique" },
        { q: "Sur l'échelle de l'effort, à partir de quel niveau faut-il alléger la charge ou faire une pause ?", options: ["Quand l'effort reste « dur » pendant un bon moment", "Seulement à l'effort maximal, quand tu n'en peux plus", "Dès que ça devient un peu plus que « très facile »"], answer: 0,
          explain: "Entre « facile » et « un peu dur », tu tiens la durée (zones verte/jaune). Au-delà de « dur » (zones orange/rouge), le risque grimpe vite : il faut alléger, faire une micro-pause ou alterner.", ref: "INSPQ – Charge physique de travail" },
        { q: "Un muscle fatigué…", options: ["Travaille comme d'habitude, la fatigue ne change rien", "Étant plus échauffé, il protège même mieux l'articulation", "Soutient moins bien l'articulation et se blesse plus facilement"], answer: 2,
          explain: "Un muscle fatigué soutient et amortit moins bien : il protège moins ce qui l'entoure et la blessure devient plus probable.", ref: "INSPQ – Fatigue musculaire" },
        { q: "Quelles habitudes aident à limiter la fatigue sur un quart ?", multi: true, answers: [0, 1, 3], options: ["Prendre des micro-pauses régulières", "Varier les tâches et les postures", "Tout donner en début de quart pour finir plus tôt", "Bouger et t'hydrater entre les efforts", "Garder la même position le plus longtemps possible"],
          explain: "Micro-pauses, variation des tâches et des postures, hydratation et petits mouvements répartissent la charge et retardent la fatigue. Forcer à fond ou rester figé fait l'inverse.", ref: "CNESST – Organisation du travail" },
        { q: "À quelle fréquence prendre des micro-pauses pour relâcher les muscles ?", options: ["Une seule grande pause au milieu du quart suffit", "Quelques secondes (15 à 30 s), 3 à 4 fois par heure", "Cinq minutes complètes, une fois par heure"], answer: 1,
          explain: "De courtes micro-pauses de 15 à 30 secondes, 3 à 4 fois par heure, suffisent à relâcher les muscles et à entretenir la circulation sans casser le rythme.", ref: "CNESST – Moyens de contrôle" },
        { q: "Rester assis ou debout sans bouger longtemps…", options: ["C'est reposant pour les muscles puisque tu ne bouges pas", "C'est sans risque tant que tu ne portes pas de charge", "Ça fatigue aussi : rester figé est une charge statique"], answer: 2,
          explain: "Le travail statique crispe les muscles posturaux et ralentit la circulation. Changer de position toutes les 20 à 30 minutes réduit la tension.", ref: "INSPQ – Postures statiques" },
        { q: "Comment les disques de la colonne se nourrissent-ils principalement ?", options: ["En restant bien immobile pour ne pas les user", "Par le mouvement, qui fait varier la pression et y fait circuler l'eau et les nutriments", "Surtout en buvant beaucoup d'eau pendant le quart"], answer: 1,
          explain: "Les disques n'ont pas de vaisseaux : ils se nourrissent par « pompage ». Varier la pression en bougeant y fait entrer eau, nutriments et oxygène ; une pression statique prolongée les prive et les fragilise.", ref: "INSPQ – Colonne et disques intervertébraux" }
      ] },
    { id: 'sommeil', num: '03', title: 'Sommeil & récupération',
      notions: [
        { id: 'balance', title: 'Charge de travail et récupération', extra: 'balance', intro: "Un TMS apparaît quand la charge imposée au corps dépasse, de façon répétée, sa capacité à récupérer. Tout l'enjeu : limiter ce qui pèse et soigner ce qui répare." },
        { id: 'recuperation', title: 'Récupération & sommeil', extra: 'sommeil', intro: "Le sommeil, c'est l'atelier de réparation du corps : muscles et tendons s'y régénèrent.",
          points: [ { title: 'Dormir pour réparer', text: "Une nuit écourtée, c'est un corps moins protégé le lendemain." }, { title: 'Régularité', text: "Des horaires de sommeil réguliers améliorent la récupération." }, { title: 'Qualité', text: "Pièce noire, calme et fraîche, écrans coupés avant de dormir." } ] },
        { id: 'quart', title: 'Le quart de nuit', extra: 'nuit', intro: "Travailler la nuit perturbe l'horloge biologique : il faut protéger son sommeil de jour.",
          points: [ { title: 'Sommeil de jour', text: "Obscurité totale, bruit masqué, téléphone en silencieux." }, { title: 'Sieste stratégique', text: "Une courte sieste avant le quart aide à tenir." }, { title: 'Café modéré', text: "Évite la caféine en fin de quart pour ne pas gâcher le sommeil suivant." } ] }
      ],
      quiz: [
        { q: "Tu finis un quart après être resté éveillé environ 17 h d'affilée. Ton niveau de vigilance est…", options: ["Comparable à celui du début de ton quart", "Comparable à un taux d'alcool d'environ 0,05", "Intact tant que tu restes debout et actif"], answer: 1,
          explain: "Après ~17 h d'éveil continu, la vigilance chute au point d'équivaloir à un taux d'alcoolémie d'environ 0,05 : réflexes et jugement sont émoussés, le risque de faux mouvement grimpe.", ref: "INSPQ – Fatigue et vigilance" },
        { q: "Combien d'heures de sommeil viser par tranche de 24 h pour bien récupérer ?", options: ["4 à 5 h si tu te sens en forme", "7 à 9 h", "Peu importe en semaine, on rattrape la fin de semaine"], answer: 1,
          explain: "La cible est de 7 à 9 h par 24 h. En dessous, la dette s'accumule et la réparation des tissus se fait mal.", ref: "INSPQ – Besoins de sommeil" },
        { q: "Peux-tu rattraper la fatigue accumulée d'une semaine par une grosse grasse matinée ?", options: ["Oui, une longue matinée efface la dette", "Non, la fatigue s'accumule comme une dette qui ne s'efface pas d'un coup", "Oui, à condition de prendre un café au réveil"], answer: 1,
          explain: "La fatigue ne se rattrape pas en une fois : elle se comporte comme une dette. Seul un sommeil suffisant et régulier la résorbe vraiment.", ref: "INSPQ – Dette de sommeil" },
        { q: "Après un quart de nuit, quels réflexes protègent réellement ton sommeil de jour ?", multi: true, answers: [0, 1, 3], options: ["Chambre noire, calme et fraîche", "Pas de caféine dans les 6 h avant de dormir", "Garder la télé allumée pour le bruit de fond", "Avertir l'entourage et couper les notifications", "Boire un café juste avant de te coucher"],
          explain: "Noir/calme/frais imite la nuit, couper caféine et notifications protège le sommeil. La télé allumée et le café juste avant, eux, le fragmentent.", ref: "INSPQ – Sommeil et horaires atypiques" },
        { q: "Avant un quart de nuit, la sieste stratégique dure idéalement…", options: ["2 à 3 heures", "20 à 30 minutes", "Le plus longtemps possible"], answer: 1,
          explain: "Une courte sieste de 20 à 30 min recharge la vigilance sans plonger dans un sommeil profond dont le réveil serait pénible.", ref: "INSPQ – Sieste et vigilance" },
        { q: "Au réveil, pour relancer rapidement ta vigilance, le mieux est de…", options: ["Rester dans le noir encore un moment", "T'exposer à une lumière vive", "Refaire une courte sieste"], answer: 1,
          explain: "La lumière vive signale au corps qu'il est temps d'être éveillé et relance la vigilance ; rester dans le noir entretient la somnolence.", ref: "INSPQ – Lumière et rythme circadien" }
      ] },
    { id: 'hygiene', num: '04', title: 'Hygiène de vie',
      notions: [
        { id: 'hydratation', title: 'Hydratation & alimentation', extra: 'leviers12', intro: "Bien boire et bien manger renforce les tissus et la résistance à l'effort.",
          points: [ { title: 'Bois régulièrement', text: "Des muscles hydratés fatiguent moins, surtout sous terre." }, { title: 'Mange équilibré', text: "Protéines et glucides aident la récupération." }, { title: "Limite l'excès", text: "Alcool et excès de sucre nuisent au sommeil et à la récup." } ] },
        { id: 'habitudes', title: 'Habitudes & activité', extra: 'leviers34', intro: "Quelques habitudes simples gardent le corps souple et solide.",
          points: [ { title: 'Bouge hors travail', text: "Une activité physique régulière protège les articulations." }, { title: 'Échauffe-toi', text: "Quelques mouvements avant un effort intense préparent les muscles." }, { title: 'Écoute les signaux', text: "N'ignore pas les premières douleurs." } ] }
      ],
      quiz: [
        { q: "Quand faut-il boire pour bien rester hydraté pendant le quart ?", options: ["Seulement quand tu ressens la soif", "Régulièrement, avant même d'avoir soif", "Uniquement aux pauses repas"], answer: 1,
          explain: "La soif est déjà un signe de déshydratation : à ce stade, tu as pris du retard. Boire régulièrement, avant d'avoir soif, garde les muscles performants.", ref: "CNESST – Contraintes thermiques" },
        { q: "Pourquoi limiter les sucres rapides (boissons sucrées, friandises) pendant le quart ?", options: ["Ils hydratent moins bien que l'eau mais nourrissent le muscle", "Ils ne donnent pas d'énergie durable et favorisent fringales, fatigue et baisse de concentration", "Ils remplacent un repas complet sans inconvénient"], answer: 1,
          explain: "Le sucre rapide donne un pic d'énergie suivi d'une chute : fringales, fatigue et perte de concentration — l'inverse d'une énergie stable.", ref: "INSPQ – Alimentation et travail" },
        { q: "Parmi ces habitudes, lesquelles nuisent à la récupération et à la guérison des tissus ?", multi: true, answers: [0, 2, 4], options: ["Le tabac", "L'activité physique régulière", "L'alcool avant de dormir", "Une bonne hydratation", "Le cannabis"],
          explain: "Tabac (circulation réduite), alcool (sommeil profond fragmenté) et cannabis (vigilance et réflexes altérés) nuisent à la récupération. L'activité physique et l'hydratation, elles, l'aident.", ref: "INSPQ – Saines habitudes de vie" },
        { q: "Le tabac ralentit la guérison des tissus parce qu'il…", options: ["Réduit la circulation sanguine vers les tissus", "Augmente la souplesse des muscles", "Améliore le sommeil profond"], answer: 0,
          explain: "En réduisant la circulation, le tabac prive les tissus d'oxygène et de nutriments : les blessures et les muscles guérissent plus lentement.", ref: "INSPQ – Tabac et santé" },
        { q: "Tu travailles assis plusieurs heures d'affilée. Le mieux pour ton corps est de…", options: ["Rester immobile pour économiser ton énergie", "Bouger un peu chaque heure pour rester souple", "Attendre la fin du quart pour t'étirer"], answer: 1,
          explain: "Rester assis longtemps raidit le corps. De courts mouvements chaque heure entretiennent la souplesse et la circulation — bien mieux qu'un seul étirement en fin de quart.", ref: "INSPQ – Sédentarité" }
      ] },
    { id: 'reflexes', num: '05', title: 'Bons réflexes au poste',
      notions: [
        { id: 'contraignantes', title: 'Positions contraignantes', extra: 'gallery', images: [ { src: 'images/posture_positions.jpg', alt: 'Positions contraignantes des épaules, poignets et mains : zones de confort (0-20°), à surveiller (20-45°) et contraignante (au-delà de 45°)' } ], intro: "Plus une position s'éloigne du neutre, plus la contrainte sur l'épaule, le poignet et la main augmente. Repère les angles à surveiller." },
        { id: 'principes', title: "Les 4 principes d'une bonne posture", extra: 'gallery', images: [ { src: 'images/posture_intro.jpg', alt: "Les 4 principes d'une bonne posture : réduire les contraintes sur le dos et prévenir les TMS" } ], intro: "Quatre gestes simples à adopter pour soulever et travailler en protégeant ton dos. On les voit un par un." },
        { id: 'principe1', title: '1. Charge près du corps', extra: 'gallery', images: [ { src: 'images/posture_p1.jpg', alt: '1. Charge près du corps : plus la charge est près du corps, moins le dos force' } ], intro: "Garder la charge près du corps réduit la tension sur le bas du dos." },
        { id: 'principe3', title: '3. Pivoter avec les pieds', extra: 'gallery', images: [ { src: 'images/posture_p3.jpg', alt: '3. Pivoter avec les pieds : tourner avec les pieds, pas avec le tronc' } ], intro: "Quand tu changes de direction, tourne avec les pieds, pas avec le tronc." },
        { id: 'principe4', title: '4. Hauteur de travail adaptée', extra: 'gallery', images: [ { src: 'images/posture_p4.jpg', alt: '4. Hauteur de travail adaptée : garder la charge entre la hauteur des hanches et des épaules' } ], intro: "Travailler entre la hauteur des hanches et des épaules limite les contraintes sur le dos, le cou et les épaules." }
      ],
      quiz: [
        { q: "Pour soulever une charge au sol, il faut…", options: ["Plier le dos, jambes tendues", "Plier les genoux et garder le dos droit", "Tourner le tronc en soulevant"], answer: 1,
          explain: "On plie les genoux, on garde le dos droit et la charge près du corps : ce sont les jambes, plus fortes, qui font l'effort, pas le bas du dos.", ref: "CNESST – Manutention sécuritaire" },
        { q: "Face à un inconfort qui persiste, le bon réflexe est de…", options: ["Le signaler tôt", "Attendre que ça empire", "Ne rien dire"], answer: 0,
          explain: "Signaler tôt permet d'ajuster le poste et d'intervenir avant la lésion ; cela protège aussi les collègues exposés au même risque.", ref: "CNESST – Déclaration et prévention" },
        { q: "Entre pousser et tirer une charge lourde, mieux vaut…", options: ["Tirer, c'est toujours plus sûr", "Pousser en utilisant le poids du corps", "Peu importe, c'est pareil"], answer: 1,
          explain: "Pousser permet d'engager le poids du corps et de garder le dos en position neutre, alors que tirer sollicite davantage les épaules et le bas du dos.", ref: "INSPQ – Manutention de charges" },
        { q: "Travailler les bras au-dessus des épaules longtemps…", options: ["Repose les épaules", "Augmente le risque de TMS à l'épaule", "N'a aucun effet"], answer: 1,
          explain: "Les bras levés mettent la coiffe des rotateurs sous tension et réduisent l'irrigation du tendon : c'est une cause fréquente de tendinite d'épaule.", ref: "INSPQ – TMS de l'épaule" },
        { q: "À qui signaler en premier un inconfort lié au poste ?", options: ["À personne, ça passe", "À ton superviseur", "Seulement si c'est grave"], answer: 1,
          explain: "Le superviseur peut ajuster la tâche, le poste ou l'équipement. Le signalement précoce fait partie de la prévention.", ref: "CNESST – Rôles en SST" }
      ] }
  ];

  var BORG_LEVELS = [
    { num: 0, name: 'Aucun effort', desc: "Pas d'effort.", badge: '#22c55e' },
    { num: 1, name: 'Très très facile', desc: 'À peine perceptible.', badge: '#34c759' },
    { num: 2, name: 'Très facile', desc: 'Effort très léger.', badge: '#4ec13a' },
    { num: 3, name: 'Facile', desc: 'Effort léger.', badge: '#86c531' },
    { num: 4, name: 'Effort modéré', desc: 'Effort confortable mais notable.', badge: '#eab308' },
    { num: 5, name: 'Moyen', desc: 'Effort soutenu, respiration plus marquée.', badge: '#f5a524' },
    { num: 6, name: 'Un peu dur', desc: 'Effort exigeant.', badge: '#f97316' },
    { num: 7, name: 'Dur', desc: 'Effort difficile, respiration forte.', badge: '#f76b1c' },
    { num: 8, name: 'Très dur', desc: 'Effort très difficile.', badge: '#ef4444' },
    { num: 9, name: 'Très très dur', desc: 'Effort extrêmement difficile.', badge: '#e02424' },
    { num: 10, name: 'Maximal', desc: 'Effort maximal, à la limite de mes capacités.', badge: '#c81e1e' }
  ];
  var BORG_ZONES = {
    vert: { label: 'Zone verte · effort durable', color: '#34d399',
      work: "Effort que tu peux soutenir longtemps sans t'épuiser. C'est ici que tu repères ta zone confortable de travail.",
      action: "Travaille à ton rythme. C'est le bon niveau pour les tâches qui durent ; garde quand même la charge près du corps." },
    jaune: { label: 'Zone jaune · à surveiller', color: '#eab308',
      work: "Effort notable mais encore tenable. La respiration se marque : tu approches de la limite du soutenable.",
      action: "Reste vigilant : garde la charge près du corps, hydrate-toi et prévois des micro-pauses pour ne pas glisser vers le rouge." },
    orange: { label: 'Zone orange · alerte', color: '#f97316',
      work: "Effort exigeant : le risque de TMS grimpe vite si tu restes longtemps à ce niveau. Tes gestes deviennent moins précis.",
      action: "Écoute les signaux : allège la charge, fais une micro-pause ou alterne de tâche pour répartir l'effort." },
    rouge: { label: 'Zone rouge · à éviter', color: '#ef4444',
      work: "Effort trop intense pour durer. À ce niveau, le muscle fatigué protège mal l'articulation : la blessure est proche.",
      action: "Arrête ou demande de l'aide (aide mécanique, collègue). Si l'effort revient souvent à ce niveau, signale-le pour ajuster le poste." }
  };
  function borgZone(n) { return n <= 3 ? BORG_ZONES.vert : n <= 5 ? BORG_ZONES.jaune : n <= 7 ? BORG_ZONES.orange : BORG_ZONES.rouge; }

  var FATIGUE = [
    { cause: 'Diminution de la force musculaire', color: '#fbbf24', icon: '<path d="M6.5 6.5h11M6.5 17.5h11M6.5 6.5v11M17.5 6.5v11"/><rect x="3" y="9" width="3.5" height="6" rx="1"/><rect x="17.5" y="9" width="3.5" height="6" rx="1"/>', effect: "Moins de force pour accomplir une même tâche : le corps compense en forçant ailleurs." },
    { cause: 'Changement dans la biomécanique des mouvements', color: '#f97316', icon: '<circle cx="13" cy="4.5" r="1.8"/><path d="M13 8l-2.5 4 3 2 1 5M10.5 12L6 11M16 14l3 1M10 21l1.5-4"/>', effect: "Mouvements moins efficaces et compensations qui chargent les mauvaises structures." },
    { cause: 'Diminution de la stabilité articulaire', color: '#ef5a5c', icon: '<path d="M7 4c0 2.2 1.5 3 1.5 5S7 12 7 14M17 4c0 2.2-1.5 3-1.5 5S17 12 17 14"/><circle cx="8" cy="18.5" r="1.8"/><circle cx="16" cy="18.5" r="1.8"/>', effect: "Moins de contrôle des articulations : faux mouvements et plus de risques de blessures." }
  ];
  var BALANCE = {
    load: [
      { label: 'Force, charges lourdes', icon: '<path d="M5 8h14l-1 3H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="M6 11l1 8h10l1-8"/>' },
      { label: 'Gestes répétés, longues heures', icon: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v4h-4"/>' },
      { label: 'Postures contraignantes, vibrations', icon: '<circle cx="11" cy="4.5" r="1.6"/><path d="M11 7l-1.5 5 3.5 1 1 6M9.5 12L6 13M14 13l3 1M9 20l1.5-5"/>' },
      { label: 'Froid, stress, cadence élevée', icon: '<path d="M12 2v20M4 7l16 10M20 7L4 17"/>' }
    ],
    restore: [
      { label: 'Sommeil suffisant et de qualité', icon: '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8z"/>' },
      { label: 'Hydratation et alimentation', icon: '<path d="M12 3c3 4 5 6.5 5 9a5 5 0 0 1-10 0c0-2.5 2-5 5-9z"/>' },
      { label: 'Activité physique, mobilité', icon: '<circle cx="13" cy="4.5" r="1.7"/><path d="M13 7l-2.5 4.5L14 13l1.5 6M10.5 11.5L6.5 10M14 13l4 .5M10 19l2-5"/>' },
      { label: 'Pauses, gestion du stress', icon: '<circle cx="12" cy="5" r="1.7"/><path d="M7 21l2-7h6l2 7M9 14l-3-3M15 14l3-3"/>' }
    ]
  };
  var NUIT = [
    { title: 'Chambre noire et fraîche', text: "Rideaux opaques, bouchons, masque. Le noir imite la nuit.", icon: '<path d="M20 13.4A7 7 0 1 1 10.6 4a5.5 5.5 0 0 0 9.4 9.4z"/><path d="M18 3.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L16 5.5l1.5-.5z"/>' },
    { title: 'Routine fixe', text: "Même rituel avant de dormir, même si c'est le matin.", icon: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v4h-4"/><path d="M3 12a9 9 0 0 0 3 6.7"/><path d="M3 20v-4h4"/>' },
    { title: 'Caféine maîtrisée', text: "Pas de café dans les 6 h avant le sommeil prévu.", icon: '<path d="M18 8h1a3 3 0 0 1 0 6h-1"/><path d="M3 8h15v6a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/><line x1="6" y1="3" x2="6" y2="5"/><line x1="10" y1="3" x2="10" y2="5"/><line x1="14" y1="3" x2="14" y2="5"/>' },
    { title: 'Sieste stratégique', text: "Une courte sieste de 20 à 30 min avant un quart de nuit.", icon: '<path d="M2 18v-5a2 2 0 0 1 2-2h11a4 4 0 0 1 4 4v3"/><path d="M2 14h17M2 18h20"/><circle cx="7" cy="9" r="1.6"/>' },
    { title: 'Lumière au réveil', text: "S'exposer à la lumière vive pour relancer la vigilance.", icon: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>' },
    { title: 'Protéger son sommeil', text: "Avertir l'entourage, couper les notifications.", icon: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>' }
  ];
  var IC = {
    drop: '<path d="M12 3c3.5 4.5 6 7.2 6 10.2A6 6 0 0 1 6 13.2C6 10.2 8.5 7.5 12 3z"/>',
    bottle: '<path d="M10 2h4M9.5 5h5l.5 3c.4 1 .5 1.5.5 3v9a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-9c0-1.5.1-2 .5-3z"/><path d="M9 13h6"/>',
    dropCheck: '<path d="M12 3c3.5 4.5 6 7.2 6 10.2A6 6 0 0 1 6 13.2C6 10.2 8.5 7.5 12 3z"/><path d="M9.5 13l1.8 1.8L15 11"/>',
    wheat: '<path d="M12 22V8"/><path d="M12 8c-2 0-3-1-3-3 2 0 3 1 3 3zM12 8c2 0 3-1 3-3-2 0-3 1-3 3zM12 13c-2 0-3-1-3-3 2 0 3 1 3 3zM12 13c2 0 3-1 3-3-2 0-3 1-3 3zM12 18c-2 0-3-1-3-3 2 0 3 1 3 3zM12 18c2 0 3-1 3-3-2 0-3 1-3 3z"/>',
    meat: '<path d="M14.5 4a5.5 5.5 0 0 1 0 11c-1 3-4 5-7 4.5S-.5 14 4 11s7.5-7 10.5-7z"/><circle cx="14" cy="9.5" r="1.4"/>',
    noSugar: '<rect x="4" y="9" width="7" height="6" rx="1"/><rect x="12" y="12" width="7" height="6" rx="1"/><line x1="4" y1="4" x2="20" y2="20"/>',
    torso: '<circle cx="12" cy="5" r="2.2"/><path d="M6 21c0-5 2-9 6-9s6 4 6 9"/>',
    stretch: '<circle cx="13" cy="4.5" r="1.7"/><path d="M13 7l-3 4 3 2v6M10 11L6 9M13 13l4-3"/>',
    sitting: '<circle cx="10" cy="4.5" r="1.7"/><path d="M10 7v5h5M10 12l-1 9M15 12v9M7 21h3"/>',
    noSmoke: '<rect x="3" y="13" width="14" height="4" rx="1"/><path d="M15 13c0-2-2-2-2-4s2-2 2-4"/><line x1="3" y1="5" x2="21" y2="21"/>',
    wine: '<path d="M7 3h10l-1 6a4 4 0 0 1-8 0z"/><line x1="12" y1="13" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/>',
    leaf: '<path d="M12 22V9"/><path d="M12 12c-3-1-5-4-5-8 4 0 5 3 5 5M12 12c3-1 5-4 5-8-4 0-5 3-5 5M12 16c-2-1-4-2-5-5 3 0 4 2 5 4M12 16c2-1 4-2 5-5-3 0-4 2-5 4"/>'
  };
  var LEVIERS = {
    leviers12: { kicker: 'Leviers 1 & 2', title: 'Boire et manger pour tenir le quart', cards: [
      { title: "L'hydratation", icon: IC.drop, rows: [
        { icon: IC.drop, bold: "Bois avant d'avoir soif", text: "la soif est déjà un signe de déshydratation." },
        { icon: IC.bottle, bold: 'Garde une gourde au poste', text: "à portée de main, tu bois plus souvent." },
        { icon: IC.dropCheck, bold: 'Surveille la couleur', text: "urine claire = bien hydraté, foncée = bois plus." } ] },
      { title: "L'alimentation", icon: IC.leaf, rows: [
        { icon: IC.wheat, bold: 'Énergie stable', text: "repas complets : grains entiers, légumes, protéines." },
        { icon: IC.meat, bold: 'Protéines pour réparer', text: "viande, poisson, œufs, légumineuses reconstruisent le muscle." },
        { icon: IC.noSugar, bold: 'Limiter le sucre rapide', text: "il ne donne pas d'énergie durable et favorise fringales, fatigue et baisse de concentration." } ] } ] },
    leviers34: { kicker: 'Leviers 3 & 4', title: 'Bouger plus, saines habitudes', cards: [
      { title: 'Bouger', icon: IC.stretch, rows: [
        { icon: IC.torso, bold: 'Renforcer le tronc et le dos', text: "un dos et des abdos solides protègent la colonne en manutention." },
        { icon: IC.stretch, bold: 'Garder la souplesse', text: "des muscles souples bougent sans se blesser." },
        { icon: IC.sitting, bold: 'Contrer la sédentarité', text: "rester assis longtemps raidit le corps ; bouge un peu chaque heure pour rester souple." } ] },
      { title: 'Habitudes', icon: IC.noSmoke, rows: [
        { icon: IC.noSmoke, bold: 'Tabac', text: "réduit la circulation : les tissus guérissent plus lentement." },
        { icon: IC.wine, bold: 'Alcool', text: "fragmente le sommeil profond : moins de réparation, plus de fatigue." },
        { icon: IC.leaf, bold: 'Cannabis', text: "altère vigilance et réflexes, parfois plusieurs heures après." } ] } ] }
  };

  /* ---------------- ÉTAT ---------------- */
  var state = { view: 'sommaire', idx: 0, completed: [], answers: {}, certVisible: false, certName: '', borgSel: null,
    layers: { Muscles: { on: true, op: 100 }, Os: { on: false, op: 0 }, Articulations: { on: false, op: 0 }, Nerfs: { on: false, op: 0 } } };
  var app, mvInterval = null;

  function load() {
    try { var p = JSON.parse(localStorage.getItem(K_PROG) || '[]'); if (Array.isArray(p)) state.completed = p; } catch (e) {}
    try { var a = JSON.parse(localStorage.getItem(K_ANS) || '{}'); if (a && typeof a === 'object') state.answers = a; } catch (e) {}
    try { state.certName = localStorage.getItem(K_NAME) || ''; } catch (e) {}
  }
  function saveProg() { try { localStorage.setItem(K_PROG, JSON.stringify(state.completed)); } catch (e) {} }
  function saveAns() { try { localStorage.setItem(K_ANS, JSON.stringify(state.answers)); } catch (e) {} }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function svg(p, sw, w) { sw = sw || 2; w = w || 22; return '<svg width="' + w + '" height="' + w + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; }

  /* ---------------- LOGIQUE ---------------- */
  function steps() {
    var out = [];
    MODULES.forEach(function (m, mi) {
      m.notions.forEach(function (n, ni) { out.push({ kind: 'notion', mi: mi, ni: ni, notion: n, module: m }); });
      out.push({ kind: 'quiz', mi: mi, module: m });
    });
    return out;
  }
  function passed(id) { return state.completed.indexOf(id) >= 0; }
  function qAnswered(q, a) { return q && q.multi ? !!(a && a.done) : typeof a === 'number'; }
  function qCorrect(q, a) {
    if (q && q.multi) {
      if (!a || !a.done) return false;
      var sel = a.sel || [], corr = q.answers || [];
      return sel.length === corr.length && corr.every(function (i) { return sel.indexOf(i) >= 0; });
    }
    return a === q.answer;
  }
  function moduleScore(def) {
    var cur = state.answers[def.id] || {};
    var total = def.quiz.length;
    var answered = def.quiz.filter(function (q, k) { return qAnswered(q, cur[k]); }).length;
    var score = def.quiz.filter(function (q, k) { return qCorrect(q, cur[k]); }).length;
    return { total: total, answered: answered, score: score, need: Math.ceil(0.8 * total), passed: answered === total && score >= Math.ceil(0.8 * total) };
  }
  function syncModulePass(def) {
    var s = moduleScore(def), i = state.completed.indexOf(def.id);
    if (s.passed && i < 0) { state.completed.push(def.id); saveProg(); }
    else if (!s.passed && i >= 0) { state.completed.splice(i, 1); saveProg(); }
  }

  /* ---------------- RENDU : SOMMAIRE ---------------- */
  function renderSommaire() {
    var total = MODULES.length;
    var doneCount = MODULES.filter(function (m) { return passed(m.id); }).length;
    var pct = Math.round(doneCount / total * 100);
    var C = 2 * Math.PI * 52;
    var ringDash = (pct / 100 * C).toFixed(1) + ' ' + C.toFixed(1);
    var totalNotions = MODULES.reduce(function (a, m) { return a + m.notions.length; }, 0);
    var allDone = doneCount >= total;
    var startLabel = allDone ? 'Revoir la formation' : (doneCount > 0 ? 'Reprendre' : 'Commencer la formation');
    var progressHint = allDone ? 'Bravo, formation terminée !' : (doneCount > 0 ? 'Continue, tu y es presque.' : "Tu n'as pas encore commencé.");
    var firstOpen = MODULES.findIndex(function (m) { return !passed(m.id); });
    var st = steps();

    var cards = MODULES.map(function (m, mi) {
      var isDone = passed(m.id), isCur = mi === firstOpen;
      var numGlyph = isDone ? '✓' : m.num;
      var numBg = isDone ? 'linear-gradient(135deg,#10b981,#0e9f6e)' : (isCur ? 'rgba(210,35,37,.16)' : '#1a2332');
      var numBorder = isDone ? 'transparent' : (isCur ? 'rgba(210,35,37,.5)' : '#1e293b');
      var numColor = isDone ? '#fff' : (isCur ? '#ef5a5c' : '#64748b');
      var cardBg = isDone ? 'rgba(16,185,129,.05)' : (isCur ? 'rgba(17,24,39,.8)' : 'rgba(17,24,39,.5)');
      var cardBorder = isDone ? 'rgba(16,185,129,.3)' : (isCur ? 'rgba(210,35,37,.4)' : '#1e293b');
      var statusLabel = isDone ? 'Validé' : (isCur ? 'En cours' : 'À venir');
      var pillBg = isDone ? 'rgba(16,185,129,.16)' : (isCur ? 'rgba(210,35,37,.16)' : '#1a2332');
      var pillColor = isDone ? '#34d399' : (isCur ? '#ef5a5c' : '#8694ad');
      var items = m.notions.map(function (n, ni) {
        var gi = st.findIndex(function (s) { return s.kind === 'notion' && s.mi === mi && s.ni === ni; });
        return notionRow((mi + 1) + '.' + (ni + 1), n.title, gi, isDone, '#0d1320', '#1e293b');
      }).join('');
      var giq = st.findIndex(function (s) { return s.kind === 'quiz' && s.mi === mi; });
      items += notionRow('✓', 'Quiz du module', giq, isDone, 'rgba(210,35,37,.06)', 'rgba(210,35,37,.22)');
      return '<div style="background:' + cardBg + ';border:1px solid ' + cardBorder + ';border-radius:16px;padding:18px 20px">'
        + '<div style="display:flex;gap:16px;align-items:center;margin-bottom:12px">'
        + '<div style="flex:0 0 auto;width:48px;height:48px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:1.35rem;background:' + numBg + ';border:1px solid ' + numBorder + ';color:' + numColor + '">' + numGlyph + '</div>'
        + '<div style="flex:1 1 auto;min-width:0"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
        + '<span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.02em;font-size:1.28rem;color:#fff">' + esc(m.title) + '</span>'
        + '<span style="font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:3px 9px;border-radius:999px;background:' + pillBg + ';color:' + pillColor + '">' + statusLabel + '</span></div>'
        + '<div style="color:#8694ad;font-size:.86rem">' + m.notions.length + ' notions · 1 quiz</div></div></div>'
        + '<div style="display:flex;flex-direction:column;gap:7px;padding-left:4px">' + items + '</div></div>';
    }).join('');

    var attBorder = allDone ? 'rgba(16,185,129,.4)' : '#1e293b';
    var attBg = allDone ? 'linear-gradient(120deg,rgba(16,185,129,.12),rgba(13,19,32,.6))' : '#0d1320';
    var attKick = allDone ? '#34d399' : '#8694ad';
    var attTitle = allDone ? 'Tu as débloqué ton attestation' : 'Termine les 5 modules pour débloquer';
    var attDesc = allDone ? "Inscris ton nom : ton attestation nominative est prête à imprimer ou enregistrer en PDF." : "Parcours les notions et réussis le quiz de chaque module pour générer ton attestation.";
    var attBtnBg = allDone ? 'linear-gradient(135deg,#10b981,#0e9f6e)' : '#1a2332';
    var attBtnColor = allDone ? '#fff' : '#64748b';
    var att = '<div id="attestation" style="margin-top:18px;border-radius:18px;border:1px solid ' + attBorder + ';background:' + attBg + ';padding:28px">'
      + '<div style="display:flex;flex-wrap:wrap;gap:22px;align-items:center;justify-content:space-between">'
      + '<div style="flex:1 1 360px;min-width:260px">'
      + '<div style="display:inline-flex;align-items:center;gap:9px;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.1em;font-size:.82rem;color:' + attKick + ';margin-bottom:8px"><span>' + (allDone ? '🎓' : '🔒') + '</span> Attestation de formation</div>'
      + '<h3 style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.01em;font-size:1.6rem;margin:0 0 6px;color:#fff">' + attTitle + '</h3>'
      + '<p style="color:#cbd5e1;font-size:.96rem;margin:0;max-width:520px">' + attDesc + '</p></div>'
      + '<button data-act="getCert"' + (allDone ? '' : ' disabled') + ' style="flex:0 0 auto;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.04em;font-size:1rem;color:' + attBtnColor + ';background:' + attBtnBg + ';border:none;cursor:' + (allDone ? 'pointer' : 'not-allowed') + ';padding:14px 26px;border-radius:999px">' + (allDone ? 'Obtenir mon attestation' : 'Verrouillé') + '</button></div>'
      + (state.certVisible && allDone ? certBlock() : '') + '</div>';

    return '<div><section style="position:relative;overflow:hidden;border-bottom:1px solid #1e293b;background:radial-gradient(120% 100% at 80% -10%,#16202f 0%,#0a0e17 55%)">'
      + '<svg viewBox="0 0 520 600" aria-hidden="true" style="position:absolute;right:-40px;top:50%;transform:translateY(-50%);height:150%;opacity:.5;pointer-events:none"><g fill="none" stroke-linecap="round"><path d="M40 600 V330 A220 220 0 0 1 480 330 V600" stroke="rgba(255,255,255,.06)" stroke-width="2"></path><path d="M130 600 V350 A130 130 0 0 1 390 350 V600" stroke="rgba(210,35,37,.34)" stroke-width="3"></path><path d="M175 600 V360 A85 85 0 0 1 345 360 V600" stroke="rgba(255,255,255,.09)" stroke-width="2"></path><circle cx="260" cy="330" r="5" fill="rgba(239,90,92,.85)" stroke="none" style="animation:fgPulse 3.2s ease-in-out infinite"></circle></g></svg>'
      + '<div class="fg-hero-inner" style="position:relative;max-width:1120px;margin:0 auto;padding:52px 28px 44px;display:flex;flex-wrap:wrap;gap:44px;align-items:center;justify-content:space-between">'
      + '<div style="flex:1 1 520px;min-width:300px">'
      + '<div style="display:inline-flex;align-items:center;gap:10px;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;letter-spacing:.14em;text-transform:uppercase;font-size:1rem;color:#ef5a5c;margin-bottom:14px"><span style="width:7px;height:7px;border-radius:50%;background:#d22325;box-shadow:0 0 8px rgba(210,35,37,.9)"></span>Formation guidée · Nouveaux travailleurs</div>'
      + '<h1 class="fg-h1" style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.01em;line-height:1.02;font-size:clamp(2.3rem,5vw,3.5rem);margin:0 0 16px">La prévention des TMS,<br><span style="color:#ef5a5c">pas à pas.</span></h1>'
      + '<p class="fg-hero-sub" style="max-width:540px;color:#cbd5e1;font-size:1.1rem;margin:0 0 24px">Une formation découpée en <strong style="color:#fff">notions courtes</strong> : une page par notion, dans l\'ordre. À la fin de chaque module, un mini-quiz. Ton attestation t\'attend au bout.</p>'
      + '<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center">'
      + '<button class="fg-cta" data-act="start" style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.04em;font-size:1.02rem;color:#fff;border:none;cursor:pointer;padding:14px 26px;border-radius:999px;background:linear-gradient(135deg,#e23a3c,#a81a1c);box-shadow:0 6px 20px rgba(210,35,37,.36)">' + startLabel + ' →</button>'
      + '<button class="fg-ghost" data-act="reset" style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.04em;font-size:.88rem;color:#8694ad;background:transparent;border:1px solid #1e293b;cursor:pointer;padding:13px 20px;border-radius:999px">↺ Recommencer</button></div></div>'
      + '<div class="fg-hero-card" style="flex:0 0 auto;width:264px;background:rgba(17,24,39,.66);border:1px solid #1e293b;border-radius:18px;padding:26px 24px;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.3)">'
      + '<div class="fg-ring" style="position:relative;width:148px;height:148px;margin:0 auto 16px"><svg viewBox="0 0 120 120" style="width:148px;height:148px;transform:rotate(-90deg)"><circle cx="60" cy="60" r="52" fill="none" stroke="#1e293b" stroke-width="11"></circle><circle cx="60" cy="60" r="52" fill="none" stroke="#d22325" stroke-width="11" stroke-linecap="round" stroke-dasharray="' + ringDash + '" style="transition:stroke-dasharray .6s"></circle></svg>'
      + '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><span class="fg-pct" style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:2.6rem;line-height:1;color:#fff">' + pct + '%</span><span style="font-size:.72rem;text-transform:uppercase;letter-spacing:.12em;color:#8694ad;font-weight:700">complété</span></div></div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.04em;font-size:1.05rem;color:#fff">' + doneCount + ' / ' + total + ' modules</div>'
      + '<div style="color:#8694ad;font-size:.86rem;margin-top:2px">' + progressHint + '</div></div></div></section>'
      + '<section style="max-width:1120px;margin:0 auto;padding:34px 28px 64px">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.03em;font-size:1.5rem;display:flex;align-items:center;gap:10px;margin-bottom:22px"><span style="width:5px;height:1.25rem;background:#d22325;border-radius:3px"></span>Le parcours · ' + totalNotions + ' notions</div>'
      + '<div style="display:flex;flex-direction:column;gap:14px">' + cards + '</div>'
      + att
      + '<p style="color:#8694ad;font-size:.82rem;margin:20px 2px 0;line-height:1.6">Formation guidée · Nouveaux travailleurs &nbsp;·&nbsp; Sources : CNESST (2023) · INSPQ. La progression est enregistrée sur cet appareil.</p>'
      + '</section></div>';
  }

  function notionRow(tag, title, gi, isDone, bg, border) {
    var tagBg = isDone ? 'rgba(16,185,129,.16)' : 'rgba(210,35,37,.16)';
    var tagColor = isDone ? '#34d399' : '#ef5a5c';
    return '<button class="fg-not" data-open="' + gi + '" style="display:flex;align-items:center;gap:12px;text-align:left;cursor:pointer;background:' + bg + ';border:1px solid ' + border + ';border-radius:10px;padding:10px 14px;font-family:\'Barlow\',sans-serif">'
      + '<span style="flex:0 0 auto;width:24px;height:24px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:.74rem;font-weight:800;font-family:\'Barlow Condensed\',sans-serif;background:' + tagBg + ';color:' + tagColor + '">' + tag + '</span>'
      + '<span style="flex:1 1 auto;color:#e2e8f0;font-weight:600;font-size:.97rem">' + esc(title) + '</span>'
      + '<span style="flex:0 0 auto;color:#8694ad">→</span></button>';
  }

  function certBlock() {
    var d = new Date().toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });
    return '<div style="margin-top:24px;position:relative;max-width:560px">'
      + '<div id="certDoc" style="background:#fff;color:#111;border-radius:14px;padding:32px 30px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.4)">'
      + '<img src="images/logo_roger.png" alt="Machines Roger International" style="height:50px;background:#000;border-radius:8px;padding:4px 6px;margin-bottom:14px">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;letter-spacing:.06em;font-size:1.4rem;color:#d22325">ATTESTATION DE FORMATION</div>'
      + '<div style="color:#555;font-size:.92rem;margin:4px 0 20px">Prévention des troubles musculosquelettiques · Mine souterraine</div>'
      + '<div style="font-size:.74rem;text-transform:uppercase;letter-spacing:.14em;color:#888">Décerné à</div>'
      + '<div id="certName" style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:1.6rem;color:#111;border-bottom:2px solid #d22325;display:inline-block;margin:8px auto 18px;padding:2px 18px 4px">' + (esc(state.certName) || '—') + '</div>'
      + '<div style="display:flex;gap:26px;justify-content:center;flex-wrap:wrap;color:#333;font-size:.9rem;margin-bottom:14px"><span>5 modules validés · <b>100&nbsp;%</b></span><span>' + d + '</span></div>'
      + '<div style="font-weight:700;color:#111;font-size:.86rem">Machines Roger International</div></div>'
      + '<div class="att-emp" style="position:relative;margin:18px 0 0"><label style="display:block;font-size:.78rem;text-transform:uppercase;letter-spacing:.1em;color:#8694ad;margin-bottom:6px">Ton nom complet</label>'
      + '<input id="attName" type="text" autocomplete="off" placeholder="Prénom et nom" value="' + esc(state.certName) + '" style="width:100%;background:#0d1320;border:1px solid #1e293b;border-radius:10px;padding:.7rem .9rem;color:#f1f5f9;font:inherit;font-size:1rem">'
      + '<div id="empSugg" class="emp-sugg" hidden></div>'
      + '<p id="empHint" style="color:#8694ad;font-size:.82rem;margin:.5rem 0 0">Commence à taper ton nom, puis choisis-le dans la liste.</p></div>'
      + '<div id="attActions" style="display:flex;flex-wrap:wrap;gap:12px;margin-top:16px">'
      + '<button class="fg-cta" data-act="print" style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.03em;font-size:.95rem;color:#fff;background:linear-gradient(135deg,#10b981,#0e9f6e);border:none;border-radius:999px;padding:12px 24px;cursor:pointer;box-shadow:0 6px 18px rgba(16,185,129,.35)">Imprimer / enregistrer (PDF)</button></div></div>';
  }

  /* ---------------- RENDU : LECTEUR ---------------- */
  function renderViewer() {
    var st = steps();
    var cur = st[state.idx] || st[0];
    var m = cur.module, notionCount = m.notions.length;
    var kicker, counter, barPct, title, body = '';
    if (cur.kind === 'notion') {
      kicker = 'Notion ' + (cur.ni + 1) + ' sur ' + notionCount;
      counter = (cur.ni + 1) + ' / ' + notionCount;
      barPct = Math.round((cur.ni + 1) / (notionCount + 1) * 100);
      title = cur.notion.title;
      body = cur.notion.custom ? renderCustom(cur.notion) : renderGeneric(cur.notion);
    } else {
      kicker = 'Quiz du module'; counter = 'Quiz'; barPct = 100; title = 'Quiz · ' + m.title;
      body = renderQuiz(m);
    }
    var last = state.idx >= st.length - 1;
    var nextLabel, nextBg;
    if (cur.kind === 'quiz') {
      var sc = moduleScore(m);
      nextLabel = last ? 'Terminer →' : 'Module suivant →';
      nextBg = sc.passed ? 'linear-gradient(135deg,#10b981,#0e9f6e)' : 'linear-gradient(135deg,#e23a3c,#a81a1c)';
    } else { nextLabel = 'Suivant →'; nextBg = 'linear-gradient(135deg,#e23a3c,#a81a1c)'; }
    var prevDis = state.idx <= 0;

    return '<div><div style="position:sticky;top:59px;z-index:30;background:rgba(13,19,32,.94);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid #1e293b">'
      + '<div style="max-width:880px;margin:0 auto;padding:11px 28px;display:flex;align-items:center;gap:16px;justify-content:space-between">'
      + '<button class="fg-nav" data-act="goSommaire" style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.03em;font-size:.8rem;color:#8694ad;background:none;border:1px solid #1e293b;border-radius:999px;padding:7px 15px;cursor:pointer">☰ Sommaire</button>'
      + '<div style="flex:1 1 auto;text-align:center;min-width:0"><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-size:.74rem;color:#ef5a5c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Module ' + m.num + ' · ' + esc(m.title) + '</div></div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:.82rem;color:#8694ad;white-space:nowrap">' + counter + '</div></div>'
      + '<div style="height:4px;background:#0a0e17"><div style="height:100%;width:' + barPct + '%;background:linear-gradient(90deg,#e23a3c,#ef5a5c);transition:width .4s"></div></div></div>'
      + '<main style="max-width:880px;margin:0 auto;padding:30px 28px 40px;min-height:50vh">'
      + '<div style="display:inline-flex;align-items:center;gap:9px;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;letter-spacing:.1em;text-transform:uppercase;font-size:.84rem;color:#ef5a5c;margin-bottom:10px"><span style="width:7px;height:7px;border-radius:50%;background:#d22325;box-shadow:0 0 8px rgba(210,35,37,.9)"></span>' + kicker + '</div>'
      + '<h1 style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.01em;line-height:1.05;font-size:clamp(1.9rem,4vw,2.7rem);margin:0 0 22px;color:#fff">' + esc(title) + '</h1>'
      + body
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:40px;padding-top:22px;border-top:1px solid #1e293b">'
      + '<button class="fg-nav" data-act="prev"' + (prevDis ? ' disabled' : '') + ' style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.03em;font-size:.9rem;color:' + (prevDis ? '#475569' : '#8694ad') + ';background:none;border:1px solid #1e293b;border-radius:999px;padding:11px 20px;cursor:' + (prevDis ? 'not-allowed' : 'pointer') + '">← Précédent</button>'
      + '<button class="fg-cta" data-act="next" style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.03em;font-size:.95rem;color:#fff;background:' + nextBg + ';border:none;border-radius:999px;padding:12px 24px;cursor:pointer">' + nextLabel + '</button></div></main></div>';
  }

  function renderGeneric(n) {
    // Maquette Claude Design : les notions génériques n'affichent que le visuel
    // (échelle de Borg, infographies, images…), sans intro ni cartes de points.
    return renderExtra(n);
  }

  function imgBlock(src, alt) {
    return '<div style="margin-top:24px;border-radius:16px;overflow:hidden;border:1px solid #1e293b;background:#000"><img src="' + src + '" alt="' + esc(alt) + '" loading="lazy" decoding="async" style="display:block;width:100%;height:auto"></div>';
  }

  function renderExtra(n) {
    var x = n.extra;
    if (x === 'borg') return borgWidget();
    if (x === 'fatigue') return fatigueWidget();
    if (x === 'statique') return imgBlock('images/travail_statique.jpg', 'Le travail statique prolongé : ce qui se passe dans le muscle et les effets');
    if (x === 'disque') return imgBlock('images/pression_disque.jpg', 'Variations de pression vs pression statique : effet sur la nutrition du disque intervertébral');
    if (x === 'controle') return controleWidget(n);
    if (x === 'balance') return balanceWidget();
    if (x === 'sommeil') return sommeilWidget();
    if (x === 'nuit') return nuitWidget();
    if (x === 'leviers12' || x === 'leviers34') return leviersWidget(x);
    if (x === 'gallery') return galleryWidget(n);
    return '';
  }

  function controleWidget(n) {
    // Maquette Claude Design : « moyens de contrôle » = image seule (pas de cartes).
    return imgBlock('images/moyens_controle.jpg', 'Moyens de contrôle : micro-pauses, rotation des tâches, étirements, alterner les postures');
  }

  function borgWidget() {
    var rows = BORG_LEVELS.map(function (l) {
      var on = state.borgSel === l.num;
      return '<button class="fg-opt" data-borg="' + l.num + '" style="display:flex;align-items:center;gap:16px;text-align:left;cursor:pointer;background:' + (on ? 'rgba(255,255,255,.06)' : 'rgba(17,24,39,.5)') + ';border:1px solid ' + (on ? l.badge : '#1e293b') + ';border-radius:11px;padding:9px 14px;width:100%">'
        + '<span style="flex:0 0 auto;width:38px;height:38px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:1.35rem;color:#0a0e17;background:' + l.badge + '">' + l.num + '</span>'
        + '<span style="flex:0 0 auto;min-width:128px;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.03em;font-size:.98rem;color:#fff">' + esc(l.name) + '</span>'
        + '<span style="color:#9aa7bd;font-size:.9rem">' + esc(l.desc) + '</span></button>';
    }).join('');
    return '<div style="margin-top:26px"><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.03em;font-size:1.35rem;color:#ef5a5c;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:4px">Échelle de l\'effort perçu <span style="font-size:.92rem;color:#8694ad;letter-spacing:.02em">(échelle de Borg)</span></div>'
      + '<p style="color:#9aa7bd;font-size:.96rem;margin:0 0 16px">Clique un niveau : son sens au travail et la conduite à tenir s\'affichent juste en dessous.</p>'
      + '<div style="display:flex;gap:14px;align-items:stretch"><div style="flex:0 0 auto;display:flex;flex-direction:column;align-items:center;width:78px"><span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.05em;font-size:.62rem;color:#34d399;text-align:center;line-height:1.2;margin-bottom:6px">Intensité<br>faible</span><span style="flex:1 1 auto;width:9px;border-radius:999px;background:linear-gradient(#22c55e,#86c531 22%,#eab308 45%,#f97316 68%,#ef4444 100%)"></span><span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.05em;font-size:.62rem;color:#ef4444;text-align:center;line-height:1.2;margin-top:6px">Intensité<br>élevée</span></div>'
      + '<div style="flex:1 1 auto;display:flex;flex-direction:column;gap:7px">' + rows + '</div></div>'
      + '<div id="borgDetail" style="margin-top:16px">' + borgDetail() + '</div></div>';
  }
  function borgDetail() {
    if (state.borgSel == null) return '';
    var l = BORG_LEVELS[state.borgSel], z = borgZone(state.borgSel);
    return '<div style="border-radius:14px;border:1px solid #1e293b;background:rgba(13,19,32,.6);overflow:hidden">'
      + '<div style="display:flex;align-items:center;gap:14px;padding:15px 18px;border-bottom:1px solid #1e293b"><span style="flex:0 0 auto;width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:1.6rem;color:#0a0e17;background:' + l.badge + '">' + l.num + '</span>'
      + '<div><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.04em;font-size:1.15rem;color:#fff">' + esc(l.name) + '</div><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.06em;font-size:.78rem;color:' + z.color + '">' + z.label + '</div></div></div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:1px;background:#1e293b">'
      + '<div style="background:#0a0e17;padding:14px 18px"><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.05em;font-size:.78rem;color:#8694ad;margin-bottom:5px">Au travail</div><p style="color:#dbe3ee;font-size:.95rem;margin:0">' + esc(z.work) + '</p></div>'
      + '<div style="background:#0a0e17;padding:14px 18px"><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.05em;font-size:.78rem;color:' + z.color + ';margin-bottom:5px">Conduite à tenir</div><p style="color:#dbe3ee;font-size:.95rem;margin:0">' + esc(z.action) + '</p></div></div></div>';
  }

  function fatigueWidget() {
    var rows = FATIGUE.map(function (r) {
      return '<div style="grid-column:1;display:flex;align-items:center;gap:14px;background:#0c111b;border:1px solid #1e293b;border-radius:12px;padding:14px 16px"><span style="flex:0 0 auto;width:46px;height:46px;display:flex;align-items:center;justify-content:center;color:' + r.color + ';background:rgba(255,255,255,.04);border:1px solid #283449;clip-path:polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%)">' + svg(r.icon, 2.1, 20) + '</span><span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.02em;font-size:1.02rem;color:#fff;line-height:1.2">' + esc(r.cause) + '</span></div>'
        + '<div style="grid-column:2;display:flex;align-items:center;justify-content:center;color:#ef5a5c">' + svg('<path d="M6 5l7 7-7 7"></path><path d="M13 5l7 7-7 7" opacity=".5"></path>', 2.6, 26) + '</div>'
        + '<div style="grid-column:3;display:flex;align-items:center;background:#0c111b;border:1px solid #1e293b;border-radius:12px;padding:14px 16px"><span style="color:#cbd5e1;font-size:.94rem">' + esc(r.effect) + '</span></div>';
    }).join('');
    return '<div style="margin-top:26px"><div style="display:flex;align-items:center;gap:14px;background:#0d1320;border:1px solid rgba(210,35,37,.4);border-radius:12px;padding:14px 18px;margin-bottom:20px"><span style="flex:0 0 auto;width:38px;height:38px;display:flex;align-items:center;justify-content:center;color:#ef5a5c;background:rgba(210,35,37,.12);border:1px solid rgba(210,35,37,.4);clip-path:polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%)">' + svg('<line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>', 2.3, 18) + '</span><span style="color:#dbe3ee;font-size:.98rem">La fatigue musculaire mène à une <strong style="color:#ef5a5c">augmentation du risque de blessure</strong>.</span></div>'
      + '<strong style="color:#fff;display:block;margin-bottom:12px">Trois conséquences s\'enchaînent :</strong>'
      + '<div style="display:grid;grid-template-columns:1fr 44px 1fr;gap:14px 10px;align-items:stretch">'
      + '<div style="grid-column:1;display:flex"><div style="flex:1;text-align:center;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.1em;font-size:.92rem;color:#fff;background:linear-gradient(135deg,#e23a3c,#a81a1c);padding:9px 0;clip-path:polygon(0 0,100% 0,92% 50%,100% 100%,0 100%)">Cause</div></div><div style="grid-column:2"></div><div style="grid-column:3;display:flex"><div style="flex:1;text-align:center;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.1em;font-size:.92rem;color:#fff;background:linear-gradient(135deg,#e23a3c,#a81a1c);padding:9px 0;clip-path:polygon(8% 0,100% 0,100% 100%,8% 100%,0 50%)">Effet</div></div>'
      + rows + '</div>'
      + '<div style="display:flex;align-items:center;gap:14px;background:#0d1320;border:1px solid rgba(210,35,37,.4);border-radius:12px;padding:14px 18px;margin-top:20px"><span style="flex:0 0 auto;width:38px;height:38px;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(135deg,#e23a3c,#a81a1c);clip-path:polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%)">' + svg('<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"></path>', 2.2, 18) + '</span><span style="color:#dbe3ee;font-size:.98rem"><strong style="color:#fff">Agir tôt</strong> permet de préserver tes capacités, de <strong style="color:#ef5a5c">réduire le risque de blessure</strong> et de protéger ta santé à long terme.</span></div></div>';
  }

  function balanceCol(title, items, accent, headIcon, dotBg, dotBorder) {
    var rows = items.map(function (it) {
      return '<div style="display:flex;align-items:center;gap:14px;padding:11px 2px"><span style="flex:0 0 auto;width:40px;height:40px;border-radius:50%;background:' + dotBg + ';border:1px solid ' + dotBorder + ';display:flex;align-items:center;justify-content:center;color:' + accent + '">' + svg(it.icon, 2.1, 19) + '</span><span style="color:#e6edf6;font-size:1rem">' + esc(it.label) + '</span></div>';
    }).join('');
    var border = accent === '#34d399' ? 'rgba(16,185,129,.45)' : 'rgba(210,35,37,.45)';
    var bg = accent === '#34d399' ? 'linear-gradient(180deg,rgba(16,185,129,.07),rgba(13,19,32,.4))' : 'linear-gradient(180deg,rgba(210,35,37,.07),rgba(13,19,32,.4))';
    var headBg = accent === '#34d399' ? '#0e9f6e' : '#d22325';
    var hb = accent === '#34d399' ? 'rgba(16,185,129,.3)' : 'rgba(210,35,37,.3)';
    return '<div style="border:1px solid ' + border + ';border-radius:16px;background:' + bg + ';padding:20px 20px 22px"><div style="display:flex;align-items:center;gap:14px;border-bottom:1px solid ' + hb + ';padding-bottom:14px;margin-bottom:6px"><span style="flex:0 0 auto;width:48px;height:48px;border-radius:50%;background:' + headBg + ';display:flex;align-items:center;justify-content:center;color:#fff">' + headIcon + '</span><span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.03em;font-size:1.28rem;color:' + accent + ';line-height:1.05">' + title + '</span></div>' + rows + '</div>';
  }
  function balanceWidget() {
    var load = balanceCol('Ce qui augmente la charge', BALANCE.load, '#ef5a5c', '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 3-1.5 4-1.5 6.5A4 4 0 0 0 14 12c.3-1 .2-1.8-.2-2.8 1.8.9 3.2 2.9 3.2 5.3a5 5 0 1 1-10 0c0-3.6 3.5-5 5.2-12.5z"></path></svg>', 'rgba(210,35,37,.16)', 'rgba(210,35,37,.4)');
    var rest = balanceCol('Ce qui restaure la capacité', BALANCE.restore, '#34d399', svg('<path d="M3 12h3l2 5 4-10 2 5h4"></path>', 2.3, 24), 'rgba(16,185,129,.16)', 'rgba(16,185,129,.4)');
    return '<div style="margin-top:24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px">' + load + rest + '</div>';
  }

  function sommeilWidget() {
    function card(ic, t, p) { return '<div style="border:1px solid #1e293b;border-left:4px solid #d22325;border-radius:14px;background:rgba(13,19,32,.6);padding:20px"><div style="display:flex;align-items:center;gap:14px;border-bottom:1px solid #1e293b;padding-bottom:13px;margin-bottom:13px"><span style="flex:0 0 auto;width:46px;height:46px;border-radius:50%;background:#d22325;display:flex;align-items:center;justify-content:center;color:#fff">' + svg(ic, 2.2, 22) + '</span><span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.02em;font-size:1.2rem;color:#fff;line-height:1.05">' + t + '</span></div><p style="color:#cbd5e1;font-size:1rem;margin:0">' + p + '</p></div>'; }
    return '<div style="margin-top:24px"><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.12em;font-size:.86rem;color:#ef5a5c;margin-bottom:6px">Le réparateur n°1</div><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.005em;font-size:clamp(1.6rem,3.2vw,2.2rem);color:#fff;line-height:1.02;margin-bottom:20px">Pendant que tu dors, ton corps se répare</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px">'
      + card('<path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2 2.5-2.5z"></path>', 'Le corps se répare', 'Muscles et articulations sollicités le jour récupèrent surtout pendant ton sommeil.')
      + card('<path d="M9 12h6"></path><path d="M10 8H7a4 4 0 0 0 0 8h3"></path><path d="M14 8h3a4 4 0 0 1 0 8h-3"></path>', 'Moins de blessures', "En manque de sommeil, le risque d'accident et de faux mouvement augmente nettement.")
      + card('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>', 'Vigilance', "Éveillé 17 h d'affilée, ta vigilance équivaut à un taux d'alcool de 0,05.")
      + '</div>'
      + '<div style="margin-top:16px;display:flex;flex-wrap:wrap;align-items:center;gap:16px 22px;background:linear-gradient(120deg,rgba(210,35,37,.16),rgba(210,35,37,.06));border:1px solid rgba(210,35,37,.45);border-radius:14px;padding:16px 20px"><div style="display:flex;align-items:center;gap:14px;flex:1 1 360px"><span style="flex:0 0 auto;width:42px;height:42px;border-radius:50%;background:#d22325;display:flex;align-items:center;justify-content:center;color:#fff">' + svg('<rect x="2" y="7" width="16" height="10" rx="2"></rect><line x1="22" y1="11" x2="22" y2="13"></line>', 2.2, 20) + '</span><div><span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.03em;font-size:1.18rem;color:#fff">La fatigue ne se rattrape pas</span><span style="display:block;color:#cbd5e1;font-size:.95rem">en une grasse matinée : elle s\'accumule comme une dette.</span></div></div>'
      + '<div style="display:flex;align-items:center;gap:12px;border-left:1px solid rgba(210,35,37,.4);padding-left:20px"><span style="flex:0 0 auto;width:42px;height:42px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid #283449;display:flex;align-items:center;justify-content:center;color:#ef5a5c">' + svg('<rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>', 2.2, 20) + '</span><div style="color:#fff;font-size:1rem;line-height:1.2">Vise <b style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:1.3rem;color:#ef5a5c">7 à 9 h</b><span style="display:block;color:#cbd5e1;font-size:.92rem">par 24 h.</span></div></div></div></div>';
  }

  function nuitWidget() {
    var cards = NUIT.map(function (c) {
      return '<div style="border:1px solid #1e293b;border-left:4px solid #d22325;border-radius:14px;background:rgba(13,19,32,.6);padding:18px 18px 20px"><div style="display:flex;align-items:center;gap:13px;border-bottom:1px solid #1e293b;padding-bottom:12px;margin-bottom:12px"><span style="flex:0 0 auto;width:44px;height:44px;border-radius:50%;background:#0c0f17;border:1px solid #283449;display:flex;align-items:center;justify-content:center;color:#ef5a5c">' + svg(c.icon, 2.1, 21) + '</span><span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.02em;font-size:1.12rem;color:#fff;line-height:1.05">' + esc(c.title) + '</span></div><p style="color:#cbd5e1;font-size:.97rem;margin:0">' + esc(c.text) + '</p></div>';
    }).join('');
    return '<div style="margin-top:24px"><div style="display:flex;align-items:center;gap:14px;margin-bottom:6px"><span style="flex:0 0 auto;color:#fff"><svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8z"></path></svg></span><span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.005em;font-size:clamp(1.6rem,3.2vw,2.2rem);color:#fff;line-height:1.02">Dormir le jour, travailler la nuit</span></div>'
      + '<p style="color:#9aa7bd;font-size:1.02rem;margin:0 0 20px;max-width:680px">Le corps n\'aime pas naturellement dormir le jour. Ces réflexes aident à mieux récupérer entre les quarts.</p>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">' + cards + '</div></div>';
  }

  function leviersWidget(which) {
    var g = LEVIERS[which];
    var cards = g.cards.map(function (card) {
      var rows = card.rows.map(function (row) {
        return '<div style="display:flex;align-items:center;gap:15px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.05)"><span style="flex:0 0 auto;width:46px;height:46px;border-radius:50%;border:1.5px solid rgba(210,35,37,.55);display:flex;align-items:center;justify-content:center;color:#fff">' + svg(row.icon, 2, 22) + '</span><span style="flex:0 0 auto;width:2px;height:38px;background:#d22325;border-radius:2px"></span><span style="color:#9aa7bd;font-size:.97rem"><b style="color:#fff;font-weight:700">' + esc(row.bold) + '</b> ' + esc(row.text) + '</span></div>';
      }).join('');
      return '<div style="border:1px solid rgba(210,35,37,.4);border-radius:16px;overflow:hidden;background:rgba(13,19,32,.5)"><div style="display:flex;align-items:center;gap:14px;background:linear-gradient(90deg,#d22325,#a81a1c);padding:14px 18px"><span style="flex:0 0 auto;width:44px;height:44px;border-radius:50%;background:#0a0e17;display:flex;align-items:center;justify-content:center;color:#fff">' + svg(card.icon, 2, 22) + '</span><span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.02em;font-size:1.4rem;color:#fff;line-height:1">' + esc(card.title) + '</span></div><div style="padding:8px 18px 14px">' + rows + '</div></div>';
    }).join('');
    return '<div style="margin-top:24px"><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.12em;font-size:.86rem;color:#ef5a5c;margin-bottom:4px">' + esc(g.kicker) + '</div><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.005em;font-size:clamp(1.6rem,3.2vw,2.2rem);color:#fff;line-height:1.02;margin-bottom:20px">' + esc(g.title) + '</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px">' + cards + '</div></div>';
  }

  function galleryWidget(n) {
    return '<div style="margin-top:24px;display:flex;flex-direction:column;gap:18px">' + (n.images || []).map(function (g) {
      return '<div style="border-radius:16px;overflow:hidden;border:1px solid #1e293b;background:#000"><img src="' + g.src + '" alt="' + esc(g.alt) + '" loading="lazy" decoding="async" style="display:block;width:100%;height:auto"></div>';
    }).join('') + '</div>';
  }

  /* ---------- Module 1 : notions « base de connaissances » ---------- */
  function renderCustom(n) {
    if (n.custom === 'cIntro') return '<div class="fg-kb"><p class="lead">Un trouble musculosquelettique (TMS), c\'est une atteinte des <strong>muscles</strong>, des <strong>tendons</strong>, des <strong>nerfs</strong>, des <strong>ligaments</strong> ou des <strong>articulations</strong>, causée ou aggravée par le travail. Rarement le résultat d\'un seul accident : il <strong style="color:var(--accent-l)">s\'installe progressivement</strong>, quand les gestes répétés, les efforts et les postures dépassent la <strong>capacité du corps à récupérer</strong>. Ça commence par un simple <strong style="color:var(--accent-l)">inconfort</strong> et ça peut finir en <strong style="color:var(--accent-l)">lésion durable</strong>.</p><div class="alert"><div class="i">' + svg('<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>', 2, 22) + '</div><div>Un TMS n\'a pas une seule cause : effort, posture, répétition, fatigue et environnement se cumulent. Agir dès le premier inconfort évite que le problème s\'installe.</div></div></div>';
    if (n.custom === 'cTypes') return '<div class="fg-kb"><p class="lead">Les formes de TMS les plus fréquentes chez les travailleurs. <strong style="color:var(--accent-l)">Le bas du dos est de loin la zone la plus touchée.</strong></p><div class="icards tms-c">'
      + '<article class="imgcard" style="border:2px solid #d22325;box-shadow:0 0 0 4px rgba(210,35,37,.16),0 14px 38px rgba(0,0,0,.45)"><div style="position:absolute;top:.65rem;left:.65rem;z-index:3;background:linear-gradient(135deg,#e23a3c,#a81a1c);color:#fff;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.06em;font-size:.68rem;padding:.28rem .6rem;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.4)">★ Le plus fréquent</div><div class="media" style="height:220px;background:#0a0e17"><img src="images/tms_lombalgie.jpeg" alt="Lombalgie" loading="lazy" decoding="async" style="object-fit:contain;display:block"></div><div class="body"><h4 style="color:#ef5a5c">Lombalgie</h4><p>Douleur du bas du dos — <strong style="color:#e2e8f0">la zone la plus atteinte</strong> chez les travailleurs.</p></div></article>'
      + '<article class="imgcard"><div class="media" style="height:220px;background:#0a0e17"><img src="images/tms_tendinite.jpeg" alt="Tendinite" loading="lazy" decoding="async" style="object-fit:contain;display:block"></div><div class="body"><h4>Tendinite</h4><p>Inflammation d\'un tendon : épaule, coude, poignet.</p></div></article>'
      + '<article class="imgcard"><div class="media" style="height:220px;background:#0a0e17"><img src="images/tms_bursite.jpeg" alt="Bursite" loading="lazy" decoding="async" style="object-fit:contain;display:block"></div><div class="body"><h4>Bursite</h4><p>Inflammation des bourses séreuses : genoux, épaules.</p></div></article>'
      + '<article class="imgcard"><div class="media" style="height:220px;background:#0a0e17"><img src="images/tms_carpien.jpeg" alt="Canal carpien" loading="lazy" decoding="async" style="object-fit:contain;display:block"></div><div class="body"><h4>Canal carpien</h4><p>Compression du nerf médian au poignet.</p></div></article></div></div>';
    if (n.custom === 'cZones') return renderZones();
    if (n.custom === 'cFacteurs') return renderFacteurs();
    if (n.custom === 'cEvolution') return renderEvolution();
    return '';
  }

  function renderZones() {
    var hot = [
      ['h3-t', 'cou', '0 1.45 0.08', '0 0 1', 'Cou / nuque', 'Cervicalgie · Tensions de la nuque'],
      ['h3-l', 'ep', '-0.18 1.37 0.05', '0 0 1', 'Épaules', 'Tendinite de la coiffe · Bursite'],
      ['h3-r', 'hd', '0 1.20 -0.10', '0 0 -1', 'Haut du dos', 'Dorsalgie · Tensions entre les omoplates'],
      ['h3-r', 'bd', '0 0.97 -0.12', '0 0 -1', 'Bas du dos', 'Lombalgie · Hernie discale'],
      ['h3-l', 'co', '-0.21 1.02 0', '0 0 1', 'Coudes', 'Épicondylite · Épitrochléite'],
      ['h3-l', 'po', '-0.22 0.80 0.02', '0 0 1', 'Poignets / mains', 'Canal carpien · De Quervain'],
      ['h3-r', 'ge', '0.10 0.46 0.10', '0 0 1', 'Genoux', 'Bursite du genou · Ménisque'],
      ['h3-r', 'ch', '0.10 0.08 0.08', '0 0 1', 'Chevilles / pieds', "Tendinite d'Achille · Fasciite plantaire"]
    ].map(function (h, i) {
      return '<button class="hotspot3d ' + h[0] + '" slot="hotspot-' + i + '" data-position="' + h[2] + '" data-normal="' + h[3] + '"><span class="h3-card"><b>' + esc(h[4]) + '</b><i>' + esc(h[5]) + '</i></span></button>';
    }).join('');
    var layers = ['Muscles', 'Os', 'Articulations', 'Nerfs'].map(function (mat) {
      var l = state.layers[mat];
      return '<div class="cl-row ' + (l.on ? 'on' : '') + '" data-mat="' + mat + '"><button class="cl-tog" type="button" aria-pressed="' + (l.on ? 'true' : 'false') + '" data-layer-toggle="' + mat + '" aria-label="Afficher ou masquer"></button><span class="cl-name">' + mat + '</span><input class="cl-op" type="range" min="0" max="100" value="' + l.op + '" data-layer-op="' + mat + '" aria-label="Opacité"></div>';
    }).join('');
    return '<div class="fg-kb"><p class="lead">Sous terre, les zones les plus exposées vont de la nuque aux chevilles. <strong style="color:#e2e8f0">Tourne le modèle 3D</strong> et affiche les structures (muscles, os, articulations, nerfs) :</p>'
      + '<div class="corps-3d"><model-viewer id="corps3d" src="' + MODEL_SRC + '" loading="eager" reveal="auto" alt="Modèle anatomique 3D : tourne-le pour explorer les zones à risque" camera-controls touch-action="pan-y" interaction-prompt="none" auto-rotate environment-image="neutral" tone-mapping="aces" shadow-intensity="0.85" shadow-softness="0.75" exposure="1.05" min-camera-orbit="auto 20deg auto" max-camera-orbit="auto 160deg auto" style="width:100%;max-width:560px;height:min(64vh,560px)">' + hot + '</model-viewer>'
      + '<div class="corps-layers" role="group" aria-label="Structures du corps à afficher"><p class="cl-title">Structures</p>' + layers + '</div>'
      + '<p class="corps-3d-note">Modèle anatomique · tourne le corps, affiche les structures et clique ou survole un repère. <span>Modèle : Z-Anatomy (CC BY-SA).</span></p></div></div>';
  }

  function renderFacteurs() {
    function fam(num, t, li) { return '<div style="border:2px solid rgba(210,35,37,.5);border-radius:14px;padding:18px 18px 16px;background:rgba(20,28,42,.5)"><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:1.8rem;color:#ef5a5c;text-align:center;line-height:1">' + num + '</div><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.05em;font-size:1.05rem;color:#fff;text-align:center;margin:.35rem 0 .9rem">' + t + '</div><ul style="margin:0;padding-left:1.1rem;color:#cbd5e1;font-size:.92rem;line-height:1.7">' + li + '</ul></div>'; }
    return '<div class="fg-kb"><p class="lead">Chez les travailleurs, le risque vient surtout de la <strong style="color:#e2e8f0">tâche</strong>, du <strong style="color:#e2e8f0">corps</strong> et de l\'<strong style="color:#e2e8f0">environnement immédiat</strong>. On distingue trois familles, qui se cumulent :</p>'
      + '<div class="fg-facteurs">'
      + '<div style="border:2px solid rgba(210,35,37,.55);border-radius:14px;padding:18px 18px 16px;background:rgba(210,35,37,.06)"><div style="display:flex;align-items:center;gap:9px;margin-bottom:12px"><span style="flex:0 0 auto;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#d22325;color:#fff">' + svg('<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"></path>', 2.2, 14) + '</span><span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.08em;font-size:.92rem;color:#ef5a5c">À retenir</span></div><p style="color:#cbd5e1;font-size:.92rem;margin:0 0 .7rem">Un TMS n\'a pas une seule cause.</p><p style="color:#9aa7bd;font-size:.9rem;margin:0 0 .7rem">Souvent, c\'est un mélange d\'effort, de posture, de répétition, de fatigue et d\'environnement.</p><p style="color:#9aa7bd;font-size:.9rem;margin:0">Agir tôt aide à éviter que le problème s\'installe.</p></div>'
      + fam('1', 'La tâche', '<li>Efforts et postures</li><li>Répétition, cadence</li><li>Manutention de charges</li>')
      + fam('2', "L'individu", '<li>Condition physique</li><li>Fatigue, récupération</li><li>Hygiène de vie</li>')
      + fam('3', "L'environnement", '<li>Poste et outils</li><li>Espace de travail</li><li>Froid, vibrations</li>') + '</div>'
      + '<div style="display:flex;align-items:center;gap:12px;justify-content:center;background:linear-gradient(135deg,#e23a3c,#a81a1c);border-radius:12px;padding:14px 18px;box-shadow:0 6px 18px rgba(210,35,37,.3)">' + svg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>', 2.2, 24) + '<span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:1.08rem;color:#fff;text-align:center">Ce n\'est pas un seul facteur. C\'est souvent la combinaison qui augmente le risque.</span></div></div>';
  }

  function renderEvolution() {
    return '<div class="fg-kb"><p class="lead">Un TMS s\'installe par étapes. La même atteinte passe d\'un simple <strong style="color:var(--accent-l)">inconfort</strong> à une <strong style="color:var(--accent-l)">douleur</strong> tenace, puis à une <strong style="color:var(--accent-l)">lésion</strong> durable. Plus la douleur dure, plus la récupération est longue — d\'où l\'importance d\'agir tôt.</p>'
      + '<div class="evo3"><div class="evo-banner">'
      + '<div class="eb-stage eb1"><span class="eb-num" aria-hidden="true">1</span><div><span class="eb-name">Inconfort</span><span class="eb-phase">Phase aiguë · 0 à 6 semaines</span></div></div>' + svg('<path d="M5 12h14M13 6l6 6-6 6"></path>', 2, 24)
      + '<div class="eb-stage eb2"><span class="eb-num" aria-hidden="true">2</span><div><span class="eb-name">Douleur</span><span class="eb-phase">Phase subaiguë · 6 à 12 semaines</span></div></div>' + svg('<path d="M5 12h14M13 6l6 6-6 6"></path>', 2, 24)
      + '<div class="eb-stage eb3"><span class="eb-num" aria-hidden="true">3</span><div><span class="eb-name">Lésion</span><span class="eb-phase">Phase chronique · 12+ semaines</span></div></div></div>'
      + '<div class="evo-cols"><div class="evo-col ev1"><h4>Le bon moment pour agir</h4><p>Ça tire ou ça brûle <b>à l\'effort</b>, puis ça passe au repos. <span class="ec-act">C\'est ici qu\'il faut agir.</span></p></div>'
      + '<div class="evo-col ev2"><h4>La douleur s\'installe</h4><p>Elle revient plus vite et persiste <b>même hors effort</b>. Le sommeil en souffre.</p></div>'
      + '<div class="evo-col ev3"><h4>Risque de chronicité</h4><p>La douleur reste <b>même au repos</b> : récupération longue et incertaine.</p></div></div></div></div>';
  }

  /* ---------- QUIZ ---------- */
  function renderQuiz(m) {
    var cur = state.answers[m.id] || {};
    var sc = moduleScore(m);
    var barPct = Math.round(sc.answered / sc.total * 100);
    var barColor = sc.passed ? '#10b981' : '#d22325';
    var statText = sc.passed ? 'Réussi · ' + sc.score + ' / ' + sc.total : sc.score + ' / ' + sc.total + ' bonnes';
    var statColor = sc.passed ? '#34d399' : '#8694ad';
    var qs = m.quiz.map(function (q, qi) {
      var a = cur[qi], isMulti = !!q.multi, answered = qAnswered(q, a), correct = qCorrect(q, a);
      var corrSet = isMulti ? (q.answers || []) : [q.answer];
      var selArr = isMulti ? ((a && a.sel) || []) : (typeof a === 'number' ? [a] : []);
      var opts = q.options.map(function (label, oi) {
        var selected = selArr.indexOf(oi) >= 0, isAns = corrSet.indexOf(oi) >= 0;
        var bg = '#111827', border = '#283449', color = '#cbd5e1', dot = '#475569', mark = '', cursor = 'pointer';
        if (answered) { cursor = 'default';
          if (isAns) { bg = 'rgba(16,185,129,.14)'; border = 'rgba(16,185,129,.55)'; color = '#d1fae5'; dot = '#34d399'; mark = '✓'; }
          else if (selected) { bg = 'rgba(239,68,68,.13)'; border = 'rgba(239,68,68,.55)'; color = '#fecaca'; dot = '#f87171'; mark = '✗'; }
          else { color = '#64748b'; border = '#1e293b'; }
        } else if (selected) { bg = 'rgba(210,35,37,.14)'; border = 'rgba(210,35,37,.6)'; color = '#fff'; dot = '#ef5a5c'; mark = isMulti ? '✓' : '●'; }
        return '<button class="fg-opt" data-q="' + qi + '" data-opt="' + oi + '" data-multi="' + (isMulti ? 1 : 0) + '"' + (answered ? ' disabled' : '') + ' style="display:flex;align-items:center;gap:11px;text-align:left;cursor:' + cursor + ';font-family:\'Barlow\',sans-serif;font-size:.97rem;color:' + color + ';background:' + bg + ';border:1px solid ' + border + ';border-radius:10px;padding:12px 15px"><span style="flex:0 0 auto;width:20px;height:20px;border-radius:' + (isMulti ? '5px' : '50%') + ';border:2px solid ' + dot + ';display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:800;color:' + dot + '">' + mark + '</span><span>' + esc(label) + '</span></button>';
      }).join('');
      var validate = (isMulti && !answered && selArr.length > 0) ? '<button class="fg-cta" data-validate="' + qi + '" style="margin-top:12px;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.03em;font-size:.86rem;color:#fff;background:linear-gradient(135deg,#e23a3c,#a81a1c);border:none;border-radius:999px;padding:10px 20px;cursor:pointer">Valider ma réponse</button>' : '';
      var fb = '';
      if (answered) {
        var fbColor = correct ? '#34d399' : '#f87171';
        var fbBg = correct ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.08)';
        var fbBorder = correct ? 'rgba(16,185,129,.35)' : 'rgba(239,68,68,.35)';
        fb = '<div style="margin-top:12px;border-radius:10px;border:1px solid ' + fbBorder + ';background:' + fbBg + ';padding:12px 14px"><div style="display:flex;align-items:center;gap:8px;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.05em;font-size:.84rem;color:' + fbColor + ';margin-bottom:5px">' + (correct ? '✓ Bonne réponse' : '✗ Pas tout à fait') + '</div><p style="color:#dbe3ee;font-size:.93rem;margin:0 0 7px">' + esc(q.explain) + '</p><div style="display:flex;align-items:center;gap:6px;font-size:.78rem;color:#8694ad">' + svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>', 2, 13) + '<span>Référence : ' + esc(q.ref || 'CNESST') + '</span></div></div>';
      }
      var multiHint = isMulti ? '<div style="display:inline-flex;align-items:center;gap:6px;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.06em;font-size:.74rem;color:#ef5a5c;background:rgba(210,35,37,.1);border:1px solid rgba(210,35,37,.3);border-radius:6px;padding:3px 9px;margin:-4px 0 12px 26px">☑ Plusieurs réponses possibles</div>' : '';
      var cardBorder = answered ? (correct ? 'rgba(16,185,129,.4)' : 'rgba(239,68,68,.35)') : '#1e293b';
      return '<div style="background:rgba(13,19,32,.5);border:1px solid ' + cardBorder + ';border-radius:14px;padding:18px 18px 16px"><p style="font-weight:600;color:#f1f5f9;font-size:1.05rem;margin:0 0 12px;display:flex;gap:9px;align-items:baseline"><span style="flex:0 0 auto;color:#ef5a5c;font-family:\'Barlow Condensed\',sans-serif;font-weight:800">Q' + (qi + 1) + '</span><span>' + esc(q.q) + '</span></p>' + multiHint + '<div style="display:flex;flex-direction:column;gap:8px">' + opts + '</div>' + validate + fb + '</div>';
    }).join('');

    var resultText, resultColor;
    if (sc.passed) { resultText = '✓ Module réussi (' + sc.score + ' / ' + sc.total + ') — tu peux débloquer la suite.'; resultColor = '#34d399'; }
    else if (sc.answered === sc.total) { resultText = sc.score + ' / ' + sc.total + ' — il faut au moins ' + sc.need + ' bonnes réponses (80 %). Corrige les réponses en rouge.'; resultColor = '#f87171'; }
    else { resultText = 'Réponds à toutes les questions (' + sc.answered + ' / ' + sc.total + ').'; resultColor = '#8694ad'; }

    return '<p class="lead">Réponds aux ' + sc.total + ' questions du module <b style="color:#fff">' + esc(m.title) + '</b>. <span style="color:#9aa7bd">La correction et l\'explication s\'affichent dès que tu choisis une réponse</span> ; obtiens au moins 80 % de bonnes réponses pour débloquer la suite.</p>'
      + '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 22px"><div style="flex:1 1 200px;max-width:340px;height:9px;border-radius:999px;background:#1a2332;overflow:hidden"><div style="height:100%;width:' + barPct + '%;border-radius:999px;background:' + barColor + ';transition:width .4s"></div></div><span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:.92rem;color:' + statColor + '">' + statText + '</span></div>'
      + '<div style="display:flex;flex-direction:column;gap:22px">' + qs + '</div>'
      + '<div style="margin-top:22px"><span style="font-weight:700;font-size:1rem;color:' + resultColor + '">' + resultText + '</span></div>';
  }

  /* ---------------- ACTIONS ---------------- */
  function render() {
    if (mvInterval) { clearInterval(mvInterval); mvInterval = null; }
    app.innerHTML = state.view === 'viewer' ? renderViewer() : renderSommaire();
    bind();
    if (state.view === 'viewer') {
      var st = steps(), cur = st[state.idx];
      if (cur && cur.kind === 'notion' && cur.notion.custom === 'cZones') initModel();
    }
    if (state.view === 'sommaire' && state.certVisible) initCert();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
  }

  function go(view, idx) { state.view = view; if (idx != null) state.idx = idx; state.certVisible = state.certVisible && view === 'sommaire'; render(); }

  function start() {
    var st = steps();
    var fi = MODULES.findIndex(function (m) { return !passed(m.id); });
    var idx = fi >= 0 ? st.findIndex(function (s) { return s.mi === fi; }) : 0;
    go('viewer', idx < 0 ? 0 : idx);
  }
  function reset() {
    if (!window.confirm('Recommencer à zéro ? Ta progression et tes réponses seront effacées sur cet appareil.')) return;
    state.completed = []; state.answers = {}; state.borgSel = null; state.certVisible = false;
    saveProg(); saveAns();
    go('sommaire', 0);
  }
  function next() {
    var st = steps();
    if (state.idx >= st.length - 1) { go('sommaire'); return; }
    go('viewer', state.idx + 1);
  }
  function prev() { if (state.idx <= 0) { go('sommaire'); return; } go('viewer', state.idx - 1); }

  function pickSingle(qid, qi, oi) {
    var m = MODULES.find(function (x) { return x.id === qid; });
    if (qAnswered(m.quiz[qi], (state.answers[qid] || {})[qi])) return;
    state.answers[qid] = state.answers[qid] || {};
    state.answers[qid][qi] = oi;
    saveAns(); syncModulePass(m); render();
  }
  function toggleMulti(qid, qi, oi) {
    var a = state.answers[qid] = state.answers[qid] || {};
    var cell = a[qi]; if (cell && cell.done) return;
    var sel = (cell && cell.sel) ? cell.sel.slice() : [];
    var k = sel.indexOf(oi); if (k >= 0) sel.splice(k, 1); else sel.push(oi);
    a[qi] = { sel: sel, done: false };
    saveAns(); render();
  }
  function validateMulti(qid, qi) {
    var a = state.answers[qid] = state.answers[qid] || {};
    var cell = a[qi]; if (!cell || !cell.sel || !cell.sel.length) return;
    cell.done = true;
    saveAns(); syncModulePass(MODULES.find(function (x) { return x.id === qid; })); render();
  }
  function pickBorg(n) {
    state.borgSel = state.borgSel === n ? null : n;
    // mise à jour ciblée (évite de recharger le modèle/widgets)
    var det = document.getElementById('borgDetail');
    if (det) det.innerHTML = borgDetail();
    document.querySelectorAll('[data-borg]').forEach(function (b) {
      var on = +b.getAttribute('data-borg') === state.borgSel;
      var badge = BORG_LEVELS[+b.getAttribute('data-borg')].badge;
      b.style.background = on ? 'rgba(255,255,255,.06)' : 'rgba(17,24,39,.5)';
      b.style.borderColor = on ? badge : '#1e293b';
    });
  }

  /* ---------- 3D ---------- */
  function applyLayers() {
    var mv = document.getElementById('corps3d');
    if (!mv || !mv.model) return;
    mv.model.materials.forEach(function (mt) {
      var name = (mt.name || '').toLowerCase();
      var key = Object.keys(state.layers).find(function (k) { return name.indexOf(k.toLowerCase()) >= 0; });
      if (!key) return;
      var l = state.layers[key], op = l.on ? l.op / 100 : 0;
      try {
        mt.setAlphaMode(op >= 0.999 ? 'OPAQUE' : 'BLEND');
        var c = mt.pbrMetallicRoughness.baseColorFactor;
        mt.pbrMetallicRoughness.setBaseColorFactor([c[0], c[1], c[2], op]);
      } catch (e) {}
    });
  }
  function initModel() {
    if (mvInterval) clearInterval(mvInterval);
    mvInterval = setInterval(function () {
      var mv = document.getElementById('corps3d');
      if (mv && mv.model) applyLayers();
    }, 700);
  }
  function toggleLayer(mat) {
    var l = state.layers[mat], on = !l.on;
    var op = (on && l.op === 0) ? 100 : l.op;
    state.layers[mat] = { on: on, op: op };
    var row = document.querySelector('.cl-row[data-mat="' + mat + '"]');
    if (row) { row.classList.toggle('on', on); var t = row.querySelector('.cl-tog'); if (t) t.setAttribute('aria-pressed', on ? 'true' : 'false'); var r = row.querySelector('.cl-op'); if (r) r.value = op; }
    applyLayers();
  }
  function setLayerOp(mat, val) {
    var op = parseInt(val, 10) || 0;
    state.layers[mat] = { on: op > 0 ? true : state.layers[mat].on, op: op };
    var row = document.querySelector('.cl-row[data-mat="' + mat + '"]');
    if (row) row.classList.toggle('on', state.layers[mat].on);
    applyLayers();
  }

  /* ---------- ATTESTATION ---------- */
  function getCert() { state.certVisible = true; render(); }
  function setCertName(v) {
    state.certName = v;
    try { localStorage.setItem(K_NAME, v); } catch (e) {}
    var cn = document.getElementById('certName'); if (cn) cn.textContent = v || '—';
  }
  function printCert() {
    sendAttestation();
    setTimeout(function () { try { window.print(); } catch (e) {} }, 120);
  }
  function loadShot(cb) {
    if (window.modernScreenshot && window.modernScreenshot.domToPng) { cb(); return; }
    var s = document.createElement('script'); s.src = 'vendor/modern-screenshot.umd.js';
    s.onload = function () { cb(); }; s.onerror = function () { cb(); };
    document.head.appendChild(s);
  }
  function postAttest(image) {
    if (!ATTEST_ENDPOINT) return;
    var nm = (state.certName || '').trim(); if (!nm) return;
    var input = document.getElementById('attName');
    var empId = input ? (input.dataset.empId || '') : '';
    var sig = nm + '|' + new Date().toISOString().slice(0, 10);
    try { if (localStorage.getItem('tms_form_sent') === sig) return; } catch (e) {}
    var payload = { name: nm, lang: 'FR', date: new Date().toISOString().slice(0, 10), score: '5/5 modules', employeeId: empId, image: image || '' };
    try {
      fetch(ATTEST_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function (r) { if (r && r.ok) { try { localStorage.setItem('tms_form_sent', sig); } catch (e) {} } })
        .catch(function () {});
    } catch (e) {}
  }
  function sendAttestation() {
    if (!(state.certName || '').trim()) return;
    var cert = document.getElementById('certDoc');
    if (!cert || !ATTEST_ENDPOINT) { postAttest(''); return; }
    loadShot(function () {
      var ms = window.modernScreenshot;
      if (!ms || !ms.domToPng) { postAttest(''); return; }
      ms.domToPng(cert, { scale: 2, backgroundColor: '#ffffff' })
        .then(function (u) { postAttest(u || ''); })
        .catch(function () { postAttest(''); });
    });
  }
  function initCert() {
    var input = document.getElementById('attName');
    if (!input) return;
    var sugg = document.getElementById('empSugg'), hint = document.getElementById('empHint');
    var pickedId = '', pickedName = '', tmr = null, lastReq = 0;
    function db(s) { try { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { return s; } }
    function hideSugg() { if (sugg) { sugg.hidden = true; sugg.innerHTML = ''; } }
    function setHint(t) { if (hint) hint.textContent = t; }
    function upd() {
      setCertName((input.value || '').trim());
      if (pickedId && input.value.trim().toLowerCase() !== pickedName.toLowerCase()) { pickedId = ''; input.dataset.empId = ''; setHint('Commence à taper ton nom, puis choisis-le dans la liste.'); }
    }
    function hl(name, term) { var t = db(name.toLowerCase()), q = db((term || '').toLowerCase()), i = q ? t.indexOf(q) : -1; if (i < 0) return esc(name); return esc(name.slice(0, i)) + '<b>' + esc(name.slice(i, i + q.length)) + '</b>' + esc(name.slice(i + q.length)); }
    function renderSugg(list, term) {
      if (!sugg) return;
      if (!list.length) { hideSugg(); setHint('Aucune correspondance — ton nom sera enregistré tel quel.'); return; }
      sugg.innerHTML = '';
      list.forEach(function (it) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'emp-item'; b.innerHTML = hl(it.name, term);
        b.addEventListener('mousedown', function (e) { e.preventDefault(); pickedId = it.id; pickedName = it.name; input.value = it.name; input.dataset.empId = it.id; upd(); setHint('Relié à ton dossier employé ✓'); hideSugg(); });
        sugg.appendChild(b);
      });
      sugg.hidden = false;
    }
    function search() {
      var v = (input.value || '').trim();
      if (!ATTEST_ENDPOINT || v.length < 2) { hideSugg(); return; }
      var my = ++lastReq;
      fetch(ATTEST_ENDPOINT + '?q=' + encodeURIComponent(v), { method: 'GET' })
        .then(function (r) { return r && r.ok ? r.json() : null; })
        .then(function (d) { if (my === lastReq && document.activeElement === input) renderSugg((d && d.results) || [], v); })
        .catch(function () {});
    }
    input.addEventListener('input', function () { upd(); if (tmr) clearTimeout(tmr); tmr = setTimeout(search, 220); });
    input.addEventListener('blur', function () { setTimeout(hideSugg, 150); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideSugg(); });
  }

  /* ---------------- LIAISON D'ÉVÉNEMENTS ---------------- */
  function bind() {
    app.querySelectorAll('[data-act]').forEach(function (el) {
      el.addEventListener('click', function () {
        var a = el.getAttribute('data-act');
        if (a === 'start') start();
        else if (a === 'reset') reset();
        else if (a === 'next') next();
        else if (a === 'prev') prev();
        else if (a === 'goSommaire') go('sommaire');
        else if (a === 'getCert') getCert();
        else if (a === 'print') printCert();
      });
    });
    app.querySelectorAll('[data-open]').forEach(function (el) {
      el.addEventListener('click', function () { var i = +el.getAttribute('data-open'); if (i >= 0) go('viewer', i); });
    });
    app.querySelectorAll('[data-borg]').forEach(function (el) {
      el.addEventListener('click', function () { pickBorg(+el.getAttribute('data-borg')); });
    });
    app.querySelectorAll('[data-q]').forEach(function (el) {
      el.addEventListener('click', function () {
        if (el.disabled) return;
        var qid = currentQuizId(); if (!qid) return;
        var qi = +el.getAttribute('data-q'), oi = +el.getAttribute('data-opt'), multi = el.getAttribute('data-multi') === '1';
        if (multi) toggleMulti(qid, qi, oi); else pickSingle(qid, qi, oi);
      });
    });
    app.querySelectorAll('[data-validate]').forEach(function (el) {
      el.addEventListener('click', function () { var qid = currentQuizId(); if (qid) validateMulti(qid, +el.getAttribute('data-validate')); });
    });
    app.querySelectorAll('[data-layer-toggle]').forEach(function (el) {
      el.addEventListener('click', function () { toggleLayer(el.getAttribute('data-layer-toggle')); });
    });
    app.querySelectorAll('[data-layer-op]').forEach(function (el) {
      el.addEventListener('input', function () { setLayerOp(el.getAttribute('data-layer-op'), el.value); });
    });
  }
  function currentQuizId() { var st = steps(), cur = st[state.idx]; return cur && cur.kind === 'quiz' ? cur.module.id : null; }

  /* ---------------- INIT ---------------- */
  function init() {
    app = document.getElementById('app');
    if (!app) return;
    load();
    // recalcule les modules réussis à partir des réponses enregistrées
    MODULES.forEach(syncModulePass);
    render();
  }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
