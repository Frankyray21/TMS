/* Formation guidée — SPA autonome (reproduction de la maquette de design).
   Thème sombre, 5 modules (notions + quiz 80 %), accès libre, attestation
   nominative imprimable + envoi au Worker Cloudflare (Airtable). Réutilise
   styles.css (.lead, .alert, .icards, .corps-3d, .evo3, …). */
(function () {
  'use strict';

  var ATTEST_ENDPOINT = 'https://attestations-tms.frankyray-21.workers.dev';
  var MODEL_SRC = 'models/corps-anatomie-mobile.glb';
  var K_PROG = 'tms_form_progress', K_ANS = 'tms_form_answers', K_NAME = 'tms_form_name', K_ZONES = 'tms_form_zones', K_TIMES = 'tms_form_times';

  /* ---------------- DONNÉES ---------------- */
  var MODULES = [
    { id: 'comprendre', num: '01', title: 'Understanding MSDs',
      notions: [
        { id: 'intro', title: "What is an MSD?", custom: 'cIntro' },
        { id: 'zones', title: 'The body areas affected', custom: 'cZones' },
        { id: 'types', title: 'The types of MSDs', custom: 'cTypes' },
        { id: 'facteurs', title: 'The risk factors', custom: 'cFacteurs' },
        { id: 'evolution', title: "How the pain develops", custom: 'cEvolution' }
      ],
      quiz: [
        { q: "In most cases, an MSD is…", options: ["A sudden, one-time accident", "An injury that sets in gradually", "A contagious disease"], answer: 1,
          explain: "An MSD is almost never the result of a single movement: it develops little by little, when the demands exceed the body's ability to recover.", ref: "CNESST – MSDs (2023)" },
        { q: "Which body area is most often affected in workers?", options: ["The fingertips", "The lower back (low-back pain)", "The ears"], answer: 1,
          explain: "The lower back is by far the most affected area: material handling, awkward postures and repeated efforts all concentrate there.", ref: "INSPQ – Overview of MSDs" },
        { q: "Among these injuries, which one is an MSD?", options: ["Shoulder tendinitis", "A fracture from a fall", "A cut"], answer: 0,
          explain: "Tendinitis, bursitis, low-back pain and carpal tunnel syndrome are MSDs. A fracture or a cut is an accidental injury, not an MSD.", ref: "CNESST – MSDs (2023)" },
        { q: "Carpal tunnel syndrome is…", options: ["An inflammation of the knee", "A compression of the median nerve at the wrist", "A pain in the neck"], answer: 1,
          explain: "At the wrist, the median nerve passes through a narrow tunnel; repeated movements and forced postures compress it, which causes tingling and loss of grip strength in the hand.", ref: "INSPQ – Upper-limb MSD fact sheets" },
        { q: "Why should you act at the very first sign of discomfort?", options: ["To get paid more", "Because an early injury is easier to deal with than an established one", "Because it's mandatory every day"], answer: 1,
          explain: "The longer the pain lasts, the more it becomes chronic and slow to recover from. Acting early (reporting it, adjusting the workstation) prevents lasting injury.", ref: "CNESST – MSD prevention" }
      ] },
    { id: 'charge', num: '02', title: 'Fatigue & load',
      notions: [
        { id: 'borg', title: "The effort scale", extra: 'borg', intro: "To know whether an effort is risky, you listen to your body. The Borg scale rates the intensity you feel, from “no effort” to “maximal effort”.",
          points: [ { title: 'Find your zone', text: "Between “easy” and “somewhat hard”, you can keep going. Past “hard”, the risk climbs fast." } ] },
        { id: 'fatigue', title: 'Muscle fatigue', extra: 'fatigue', intro: "A tired muscle protects the joint less and gets injured more easily.",
          points: [ { title: "It builds up", text: "Fatigue rises over the shift and over the week if recovery is lacking." }, { title: 'Listen to the signals', text: "Short of breath, burning muscles, less precise movements: these are warning signs." }, { title: 'Vary your efforts', text: "Switching task or grip spreads the load across the body." }, { title: 'Alternate', text: "Regular micro-breaks beat one long effort without letup." }, { title: 'Recover for real', text: "Breaks, water and sleep are part of the prevention work." } ] },
        { id: 'assis', title: 'Static work', extra: 'statique', intro: "Staying frozen, sitting or standing, is tiring too: blood circulates less and the postural muscles stay tensed nonstop.",
          points: [ { title: 'Why it tires you out', text: "Without movement, the same muscles stay contracted and poorly supplied with blood: tension builds up." }, { title: 'Move', text: "Stand up or change position every 20 to 30 minutes." }, { title: 'Vary your support', text: "Alternate sitting/standing and change your point of support to spread the load." } ] },
        { id: 'disque', title: 'Moving feeds your discs', extra: 'disque', intro: "The discs in your spine are fed through movement: varying the pressure draws in water, nutrients and oxygen, whereas prolonged static pressure starves them and weakens them." },
        { id: 'controle', title: 'Control measures', extra: 'controle', intro: "Simple actions to limit muscle fatigue and recover as the day goes on.",
          cards: [ { num: 1, title: 'Micro-breaks', text: "15 to 30 seconds, 3 to 4 times an hour, to relax the muscles." }, { num: 2, title: 'Task rotation', text: "Alternate tasks to vary the muscles being used." }, { num: 3, title: 'Stretching', text: "Warm up and stretch before and during work." }, { num: 4, title: 'Alternate postures', text: "Avoid staying too long in the same position." } ] }
      ],
      quiz: [
        { q: "The Borg scale is used to…", options: ["Measure the exact weight of a load", "Count the number of breaks in your shift", "Estimate the intensity of the effort you feel"], answer: 2,
          explain: "The Borg scale rates the perceived effort, from “no effort” to “maximal effort”. It's a simple way to gauge where you stand during a task.", ref: "INSPQ – Assessing physical load" },
        { q: "On the effort scale, at what level should you lighten the load or take a break?", options: ["When the effort stays “hard” for a good while", "Only at maximal effort, when you can't take any more", "As soon as it gets a bit more than “very easy”"], answer: 0,
          explain: "Between “easy” and “somewhat hard”, you can keep going (green/yellow zones). Past “hard” (orange/red zones), the risk climbs fast: you need to lighten up, take a micro-break or alternate.", ref: "INSPQ – Physical work load" },
        { q: "A tired muscle…", options: ["Works as usual, fatigue changes nothing", "Being warmer, it protects the joint even better", "Supports the joint less well and gets injured more easily"], answer: 2,
          explain: "A tired muscle supports and cushions less well: it protects what surrounds it less, and injury becomes more likely.", ref: "INSPQ – Muscle fatigue" },
        { q: "Which habits help limit fatigue over a shift?", multi: true, answers: [0, 1, 3], options: ["Taking regular micro-breaks", "Varying tasks and postures", "Giving it everything at the start of the shift to finish sooner", "Moving and hydrating between efforts", "Holding the same position as long as possible"],
          explain: "Micro-breaks, varying tasks and postures, hydration and small movements spread the load and delay fatigue. Going all out or staying frozen does the opposite.", ref: "CNESST – Work organization" },
        { q: "How often should you take micro-breaks to relax the muscles?", options: ["A single long break in the middle of the shift is enough", "A few seconds (15 to 30 s), 3 to 4 times an hour", "A full five minutes, once an hour"], answer: 1,
          explain: "Short micro-breaks of 15 to 30 seconds, 3 to 4 times an hour, are enough to relax the muscles and keep the circulation going without breaking your rhythm.", ref: "CNESST – Control measures" },
        { q: "Sitting or standing without moving for a long time…", options: ["Is restful for the muscles since you're not moving", "Carries no risk as long as you don't carry a load", "Is tiring too: staying frozen is a static load"], answer: 2,
          explain: "Static work tenses the postural muscles and slows circulation. Changing position every 20 to 30 minutes reduces the tension.", ref: "INSPQ – Static postures" },
        { q: "How do the discs in your spine get nourished, mainly?", options: ["By staying very still so as not to wear them out", "Through movement, which varies the pressure and circulates water and nutrients through them", "Mainly by drinking a lot of water during the shift"], answer: 1,
          explain: "The discs have no blood vessels: they feed by “pumping”. Varying the pressure by moving draws in water, nutrients and oxygen; prolonged static pressure starves them and weakens them.", ref: "INSPQ – The spine and intervertebral discs" }
      ] },
    { id: 'sommeil', num: '03', title: 'Sleep & recovery',
      notions: [
        { id: 'balance', title: 'Workload and recovery', extra: 'balance', intro: "An MSD appears when the load placed on the body repeatedly exceeds its ability to recover. The whole point: limit what weighs you down and take care of what repairs you." },
        { id: 'recuperation', title: 'Recovery & sleep', extra: 'sommeil', intro: "Sleep is the body's repair shop: muscles and tendons regenerate while you sleep.",
          points: [ { title: 'Sleep to repair', text: "A shortened night means a less protected body the next day." }, { title: 'Consistency', text: "Regular sleep schedules improve recovery." }, { title: 'Quality', text: "A dark, quiet, cool room, screens off before sleep." } ] },
        { id: 'quart', title: 'The night shift', extra: 'nuit', intro: "Working nights disrupts the body clock: you have to protect your daytime sleep.",
          points: [ { title: 'Daytime sleep', text: "Total darkness, masked noise, phone on silent." }, { title: 'Strategic nap', text: "A short nap before the shift helps you make it through." }, { title: 'Moderate coffee', text: "Avoid caffeine late in the shift so you don't spoil the sleep that follows." } ] }
      ],
      quiz: [
        { q: "You finish a shift after staying awake for about 17 hours straight. Your alertness level is…", options: ["About the same as at the start of your shift", "Comparable to a blood alcohol level of about 0.05", "Intact as long as you stay on your feet and active"], answer: 1,
          explain: "After ~17 h awake without a break, alertness drops to the point of matching a blood alcohol level of about 0.05: reflexes and judgment are dulled, and the risk of a wrong move climbs.", ref: "INSPQ – Fatigue and alertness" },
        { q: "How many hours of sleep should you aim for per 24-hour period to recover well?", options: ["4 to 5 h if you feel fine", "7 to 9 h", "Doesn't matter on weekdays, you catch up on the weekend"], answer: 1,
          explain: "The target is 7 to 9 h per 24 h. Below that, the debt builds up and tissue repair happens poorly.", ref: "INSPQ – Sleep needs" },
        { q: "Can you make up a week's accumulated fatigue with one big sleep-in?", options: ["Yes, a long morning wipes out the debt", "No, fatigue builds up like a debt that can't be cleared all at once", "Yes, as long as you have a coffee when you wake up"], answer: 1,
          explain: "Fatigue can't be made up all at once: it behaves like a debt. Only enough regular sleep truly clears it.", ref: "INSPQ – Sleep debt" },
        { q: "After a night shift, which habits really protect your daytime sleep?", multi: true, answers: [0, 1, 3], options: ["A dark, quiet, cool room", "No caffeine in the 6 h before sleep", "Keeping the TV on for background noise", "Letting those around you know and turning off notifications", "Having a coffee right before going to bed"],
          explain: "Dark/quiet/cool mimics night, and cutting caffeine and notifications protects sleep. The TV on and a coffee right before, on the other hand, break it up.", ref: "INSPQ – Sleep and atypical schedules" },
        { q: "Before a night shift, a strategic nap ideally lasts…", options: ["2 to 3 hours", "20 to 30 minutes", "As long as possible"], answer: 1,
          explain: "A short nap of 20 to 30 min recharges alertness without dropping into deep sleep, which would be unpleasant to wake from.", ref: "INSPQ – Napping and alertness" },
        { q: "When you wake up, to quickly boost your alertness, it's best to…", options: ["Stay in the dark for a while longer", "Expose yourself to bright light", "Take another short nap"], answer: 1,
          explain: "Bright light signals to the body that it's time to be awake and boosts alertness; staying in the dark keeps the drowsiness going.", ref: "INSPQ – Light and the circadian rhythm" }
      ] },
    { id: 'hygiene', num: '04', title: 'Healthy lifestyle',
      notions: [
        { id: 'hydratation', title: 'Hydration & nutrition', extra: 'leviers12', intro: "Drinking and eating well strengthens the tissues and your resistance to effort.",
          points: [ { title: 'Drink regularly', text: "Hydrated muscles tire less, especially underground." }, { title: 'Eat balanced meals', text: "Protein and carbohydrates help recovery." }, { title: "Limit excess", text: "Alcohol and too much sugar harm sleep and recovery." } ] },
        { id: 'habitudes', title: 'Habits & activity', extra: 'leviers34', intro: "A few simple habits keep the body supple and strong.",
          points: [ { title: 'Move outside work', text: "Regular physical activity protects the joints." }, { title: 'Warm up', text: "A few movements before an intense effort prepare the muscles." }, { title: 'Listen to the signals', text: "Don't ignore the first aches." } ] }
      ],
      quiz: [
        { q: "When should you drink to stay well hydrated during the shift?", options: ["Only when you feel thirsty", "Regularly, before you even feel thirsty", "Only at meal breaks"], answer: 1,
          explain: "Thirst is already a sign of dehydration: by then, you've already fallen behind. Drinking regularly, before you're thirsty, keeps the muscles performing.", ref: "CNESST – Thermal stress" },
        { q: "Why limit fast sugars (sugary drinks, candy) during the shift?", options: ["They hydrate less well than water but feed the muscle", "They don't provide lasting energy and they trigger cravings, fatigue and a drop in focus", "They replace a full meal with no downside"], answer: 1,
          explain: "Fast sugar gives an energy spike followed by a crash: cravings, fatigue and loss of focus — the opposite of stable energy.", ref: "INSPQ – Nutrition and work" },
        { q: "Among these habits, which ones harm recovery and tissue healing?", multi: true, answers: [0, 2, 4], options: ["Smoking", "Regular physical activity", "Alcohol before sleep", "Good hydration", "Cannabis"],
          explain: "Smoking (reduced circulation), alcohol (fragmented deep sleep) and cannabis (impaired alertness and reflexes) harm recovery. Physical activity and hydration, on the other hand, help it.", ref: "INSPQ – Healthy lifestyle habits" },
        { q: "Smoking slows tissue healing because it…", options: ["Reduces blood flow to the tissues", "Increases muscle flexibility", "Improves deep sleep"], answer: 0,
          explain: "By reducing circulation, smoking starves the tissues of oxygen and nutrients: injuries and muscles heal more slowly.", ref: "INSPQ – Tobacco and health" },
        { q: "You work sitting for several hours straight. The best thing for your body is to…", options: ["Stay still to save your energy", "Move a little each hour to stay supple", "Wait until the end of the shift to stretch"], answer: 1,
          explain: "Sitting for a long time stiffens the body. Short movements each hour keep you supple and the blood flowing — far better than a single stretch at the end of the shift.", ref: "INSPQ – Sedentary behaviour" }
      ] },
    { id: 'reflexes', num: '05', title: 'Good habits on the job',
      notions: [
        { id: 'contraignantes', title: 'Awkward positions', extra: 'gallery', images: [ { src: 'images/posture_positions.jpg', alt: 'Awkward positions of the shoulders, wrists and hands: comfort zones (0-20°), to watch (20-45°) and awkward (beyond 45°)' } ], intro: "The further a position moves from neutral, the more strain on the shoulder, wrist and hand. Spot the angles to watch." },
        { id: 'principes', title: "The 4 principles of good posture", extra: 'gallery', images: [ { src: 'images/posture_intro.jpg', alt: "The 4 principles of good posture: reduce the strain on your back and prevent MSDs" } ], intro: "Four simple habits to adopt so you lift and work while protecting your back. We'll go through them one by one." },
        { id: 'principe1', title: '1. Load close to the body', extra: 'gallery', images: [ { src: 'images/posture_p1.jpg', alt: '1. Load close to the body: the closer the load is to the body, the less the back has to work' } ], intro: "Keeping the load close to the body reduces the strain on your lower back." },
        { id: 'principe3', title: '3. Pivot with your feet', extra: 'gallery', images: [ { src: 'images/posture_p3.jpg', alt: '3. Pivot with your feet: turn with your feet, not with your trunk' } ], intro: "When you change direction, turn with your feet, not with your trunk." },
        { id: 'principe4', title: '4. Suitable working height', extra: 'gallery', images: [ { src: 'images/posture_p4.jpg', alt: '4. Suitable working height: keep the load between hip and shoulder height' } ], intro: "Working between hip and shoulder height limits the strain on your back, neck and shoulders." }
      ],
      quiz: [
        { q: "To lift a load off the ground, you should…", options: ["Bend your back, legs straight", "Bend your knees and keep your back straight", "Twist your trunk as you lift"], answer: 1,
          explain: "You bend your knees, keep your back straight and the load close to the body: it's the legs, which are stronger, that do the work, not the lower back.", ref: "CNESST – Safe material handling" },
        { q: "When discomfort persists, the right thing to do is to…", options: ["Report it early", "Wait for it to get worse", "Say nothing"], answer: 0,
          explain: "Reporting early lets you adjust the workstation and act before injury; it also protects co-workers exposed to the same risk.", ref: "CNESST – Reporting and prevention" },
        { q: "Between pushing and pulling a heavy load, it's better to…", options: ["Pull, it's always safer", "Push using your body weight", "It doesn't matter, it's the same"], answer: 1,
          explain: "Pushing lets you engage your body weight and keep your back in a neutral position, whereas pulling puts more strain on the shoulders and lower back.", ref: "INSPQ – Handling loads" },
        { q: "Working with your arms above your shoulders for a long time…", options: ["Rests the shoulders", "Increases the risk of a shoulder MSD", "Has no effect"], answer: 1,
          explain: "Raised arms put the rotator cuff under tension and reduce blood supply to the tendon: it's a common cause of shoulder tendinitis.", ref: "INSPQ – Shoulder MSDs" },
        { q: "Who should you report a workstation-related discomfort to first?", options: ["No one, it'll pass", "Your supervisor", "Only if it's serious"], answer: 1,
          explain: "The supervisor can adjust the task, the workstation or the equipment. Early reporting is part of prevention.", ref: "CNESST – OHS roles" }
      ] }
  ];

  var BORG_LEVELS = [
    { num: 0, name: 'No effort', desc: "No effort at all.", badge: '#22c55e' },
    { num: 1, name: 'Extremely easy', desc: 'Barely noticeable.', badge: '#34c759' },
    { num: 2, name: 'Very easy', desc: 'Very light effort.', badge: '#4ec13a' },
    { num: 3, name: 'Easy', desc: 'Light effort.', badge: '#86c531' },
    { num: 4, name: 'Moderate effort', desc: 'Comfortable but noticeable effort.', badge: '#eab308' },
    { num: 5, name: 'Medium', desc: 'Sustained effort, breathing more noticeable.', badge: '#f5a524' },
    { num: 6, name: 'Somewhat hard', desc: 'Demanding effort.', badge: '#f97316' },
    { num: 7, name: 'Hard', desc: 'Difficult effort, heavy breathing.', badge: '#f76b1c' },
    { num: 8, name: 'Very hard', desc: 'Very difficult effort.', badge: '#ef4444' },
    { num: 9, name: 'Extremely hard', desc: 'Extremely difficult effort.', badge: '#e02424' },
    { num: 10, name: 'Maximal', desc: 'Maximal effort, at the limit of my capacity.', badge: '#c81e1e' }
  ];
  var BORG_ZONES = {
    vert: { label: 'Green zone · sustainable effort', color: '#34d399',
      work: "An effort you can sustain for a long time without wearing yourself out. This is where you find your comfortable working zone.",
      action: "Work at your own pace. This is the right level for tasks that last; still keep the load close to the body." },
    jaune: { label: 'Yellow zone · to watch', color: '#eab308',
      work: "A noticeable but still manageable effort. Your breathing picks up: you're nearing the limit of what's sustainable.",
      action: "Stay alert: keep the load close to the body, hydrate and plan micro-breaks so you don't slip into the red." },
    orange: { label: 'Orange zone · warning', color: '#f97316',
      work: "A demanding effort: the risk of an MSD climbs fast if you stay at this level for long. Your movements become less precise.",
      action: "Listen to the signals: lighten the load, take a micro-break or switch tasks to spread the effort." },
    rouge: { label: 'Red zone · to avoid', color: '#ef4444',
      work: "An effort too intense to keep up. At this level, the tired muscle protects the joint poorly: injury is close.",
      action: "Stop or ask for help (a mechanical aid, a co-worker). If the effort often returns to this level, report it so the workstation can be adjusted." }
  };
  function borgZone(n) { return n <= 3 ? BORG_ZONES.vert : n <= 5 ? BORG_ZONES.jaune : n <= 7 ? BORG_ZONES.orange : BORG_ZONES.rouge; }

  var FATIGUE = [
    { cause: 'Decrease in muscle strength', color: '#fbbf24', icon: '<path d="M6.5 6.5h11M6.5 17.5h11M6.5 6.5v11M17.5 6.5v11"/><rect x="3" y="9" width="3.5" height="6" rx="1"/><rect x="17.5" y="9" width="3.5" height="6" rx="1"/>', effect: "Less strength to do the same task: the body compensates by straining elsewhere." },
    { cause: 'Change in movement biomechanics', color: '#f97316', icon: '<circle cx="13" cy="4.5" r="1.8"/><path d="M13 8l-2.5 4 3 2 1 5M10.5 12L6 11M16 14l3 1M10 21l1.5-4"/>', effect: "Less efficient movements and compensations that load the wrong structures." },
    { cause: 'Decrease in joint stability', color: '#ef5a5c', icon: '<path d="M7 4c0 2.2 1.5 3 1.5 5S7 12 7 14M17 4c0 2.2-1.5 3-1.5 5S17 12 17 14"/><circle cx="8" cy="18.5" r="1.8"/><circle cx="16" cy="18.5" r="1.8"/>', effect: "Less control of the joints: wrong moves and a higher risk of injury." }
  ];
  var BALANCE = {
    load: [
      { label: 'Force, heavy loads', icon: '<path d="M5 8h14l-1 3H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="M6 11l1 8h10l1-8"/>' },
      { label: 'Repeated movements, long hours', icon: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v4h-4"/>' },
      { label: 'Awkward postures, vibration', icon: '<circle cx="11" cy="4.5" r="1.6"/><path d="M11 7l-1.5 5 3.5 1 1 6M9.5 12L6 13M14 13l3 1M9 20l1.5-5"/>' },
      { label: 'Cold, stress, high pace', icon: '<path d="M12 2v20M4 7l16 10M20 7L4 17"/>' }
    ],
    restore: [
      { label: 'Enough quality sleep', icon: '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8z"/>' },
      { label: 'Hydration and nutrition', icon: '<path d="M12 3c3 4 5 6.5 5 9a5 5 0 0 1-10 0c0-2.5 2-5 5-9z"/>' },
      { label: 'Physical activity, mobility', icon: '<circle cx="13" cy="4.5" r="1.7"/><path d="M13 7l-2.5 4.5L14 13l1.5 6M10.5 11.5L6.5 10M14 13l4 .5M10 19l2-5"/>' },
      { label: 'Breaks, stress management', icon: '<circle cx="12" cy="5" r="1.7"/><path d="M7 21l2-7h6l2 7M9 14l-3-3M15 14l3-3"/>' }
    ]
  };
  var NUIT = [
    { title: 'Dark, cool room', text: "Blackout curtains, earplugs, a mask. Darkness mimics night.", icon: '<path d="M20 13.4A7 7 0 1 1 10.6 4a5.5 5.5 0 0 0 9.4 9.4z"/><path d="M18 3.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L16 5.5l1.5-.5z"/>' },
    { title: 'Fixed routine', text: "Same ritual before sleep, even if it's the morning.", icon: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v4h-4"/><path d="M3 12a9 9 0 0 0 3 6.7"/><path d="M3 20v-4h4"/>' },
    { title: 'Caffeine under control', text: "No coffee in the 6 h before your planned sleep.", icon: '<path d="M18 8h1a3 3 0 0 1 0 6h-1"/><path d="M3 8h15v6a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/><line x1="6" y1="3" x2="6" y2="5"/><line x1="10" y1="3" x2="10" y2="5"/><line x1="14" y1="3" x2="14" y2="5"/>' },
    { title: 'Strategic nap', text: "A short nap of 20 to 30 min before a night shift.", icon: '<path d="M2 18v-5a2 2 0 0 1 2-2h11a4 4 0 0 1 4 4v3"/><path d="M2 14h17M2 18h20"/><circle cx="7" cy="9" r="1.6"/>' },
    { title: 'Light on waking', text: "Get bright light to boost your alertness.", icon: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>' },
    { title: 'Protect your sleep', text: "Let those around you know, turn off notifications.", icon: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>' }
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
    leviers12: { kicker: 'Levers 1 & 2', title: 'Drinking and eating to get through the shift', cards: [
      { title: "Hydration", icon: IC.drop, rows: [
        { icon: IC.drop, bold: "Drink before you're thirsty", text: "thirst is already a sign of dehydration." },
        { icon: IC.bottle, bold: 'Keep a water bottle at your station', text: "within reach, you drink more often." },
        { icon: IC.dropCheck, bold: 'Watch the colour', text: "clear urine = well hydrated, dark = drink more." } ] },
      { title: "Nutrition", icon: IC.leaf, rows: [
        { icon: IC.wheat, bold: 'Stable energy', text: "full meals: whole grains, vegetables, protein." },
        { icon: IC.meat, bold: 'Protein to repair', text: "meat, fish, eggs and legumes rebuild muscle." },
        { icon: IC.noSugar, bold: 'Limit fast sugar', text: "it doesn't provide lasting energy and triggers cravings, fatigue and a drop in focus." } ] } ] },
    leviers34: { kicker: 'Levers 3 & 4', title: 'Move more, healthy habits', cards: [
      { title: 'Move', icon: IC.stretch, rows: [
        { icon: IC.torso, bold: 'Strengthen your core and back', text: "a strong back and abs protect the spine during material handling." },
        { icon: IC.stretch, bold: 'Stay flexible', text: "supple muscles move without getting injured." },
        { icon: IC.sitting, bold: 'Counter sedentary behaviour', text: "sitting for a long time stiffens the body; move a little each hour to stay supple." } ] },
      { title: 'Habits', icon: IC.noSmoke, rows: [
        { icon: IC.noSmoke, bold: 'Smoking', text: "reduces circulation: the tissues heal more slowly." },
        { icon: IC.wine, bold: 'Alcohol', text: "fragments deep sleep: less repair, more fatigue." },
        { icon: IC.leaf, bold: 'Cannabis', text: "impairs alertness and reflexes, sometimes several hours later." } ] } ] }
  };

  /* ---------------- ÉTAT ---------------- */
  var state = { view: 'sommaire', idx: 0, completed: [], answers: {}, certVisible: false, certName: '', borgSel: null, zonesVues: [], times: {},
    layers: { Muscles: { on: true, op: 100 }, Os: { on: false, op: 0 }, Articulations: { on: false, op: 0 }, Nerfs: { on: false, op: 0 } } };
  var app, mvInterval = null;

  function load() {
    try { var p = JSON.parse(localStorage.getItem(K_PROG) || '[]'); if (Array.isArray(p)) state.completed = p; } catch (e) {}
    try { var a = JSON.parse(localStorage.getItem(K_ANS) || '{}'); if (a && typeof a === 'object') state.answers = a; } catch (e) {}
    try { state.certName = localStorage.getItem(K_NAME) || ''; } catch (e) {}
    try { var zv = JSON.parse(localStorage.getItem(K_ZONES) || '[]'); if (Array.isArray(zv)) state.zonesVues = zv; } catch (e) {}
    try { var tt = JSON.parse(localStorage.getItem(K_TIMES) || '{}'); if (tt && typeof tt === 'object') state.times = tt; } catch (e) {}
  }
  function saveProg() { try { localStorage.setItem(K_PROG, JSON.stringify(state.completed)); } catch (e) {} }
  function saveAns() { try { localStorage.setItem(K_ANS, JSON.stringify(state.answers)); } catch (e) {} }
  function saveZones() { try { localStorage.setItem(K_ZONES, JSON.stringify(state.zonesVues)); } catch (e) {} }
  function saveTimes() { try { localStorage.setItem(K_TIMES, JSON.stringify(state.times)); } catch (e) {} }

  /* ---------- suivi du temps par section ----------
     Mesure le temps réellement passé sur chaque étape (notion ou quiz). Le
     chrono se met en pause quand l'onglet est masqué et reprend au retour ; il
     est vidé (« flush ») à chaque changement d'étape, de vue, ou fermeture de
     page. Borne de sécurité de 6 h par étape (onglet « oublié »). */
  var _tKey = null, _tT0 = 0;
  function _tNow() { return Date.now(); }
  function _tFlush() {
    if (_tKey && _tT0) {
      var dt = _tNow() - _tT0;
      if (dt > 0 && dt < 21600000) { state.times[_tKey] = (state.times[_tKey] || 0) + dt; saveTimes(); }
    }
  }
  function timeEnter(key) { _tFlush(); _tKey = key || null; _tT0 = _tKey ? _tNow() : 0; }
  function timeLeave() { _tFlush(); _tKey = null; _tT0 = 0; }
  function timePause() { _tFlush(); _tT0 = 0; }
  function timeResume() { if (_tKey) _tT0 = _tNow(); }
  function stepKey(s) { return (s && s.module) ? (s.module.id + '/' + (s.kind === 'quiz' ? 'quiz' : (s.notion ? s.notion.id : 'n'))) : null; }
  function moduleTimeMs(m) { var t = 0, p = m.id + '/'; for (var k in state.times) { if (state.times.hasOwnProperty(k) && k.indexOf(p) === 0) t += state.times[k] || 0; } return t; }
  function totalTimeMs() { var t = 0; for (var k in state.times) { if (state.times.hasOwnProperty(k)) t += state.times[k] || 0; } return t; }
  function fmtDur(ms) {
    var s = Math.round((ms || 0) / 1000);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    if (h > 0) return h + ' h ' + (m < 10 ? '0' : '') + m + ' min';
    if (m > 0) return m + ' min ' + (ss < 10 ? '0' : '') + ss + ' s';
    return ss + ' s';
  }

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
    var startLabel = allDone ? 'Review the training' : (doneCount > 0 ? 'Resume' : 'Start the training');
    var progressHint = allDone ? 'Well done, training complete!' : (doneCount > 0 ? "Keep going, you're almost there." : "You haven't started yet.");
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
      var statusLabel = isDone ? 'Passed' : (isCur ? 'In progress' : 'Up next');
      var pillBg = isDone ? 'rgba(16,185,129,.16)' : (isCur ? 'rgba(210,35,37,.16)' : '#1a2332');
      var pillColor = isDone ? '#34d399' : (isCur ? '#ef5a5c' : '#8694ad');
      var items = m.notions.map(function (n, ni) {
        var gi = st.findIndex(function (s) { return s.kind === 'notion' && s.mi === mi && s.ni === ni; });
        return notionRow((mi + 1) + '.' + (ni + 1), n.title, gi, isDone, '#0d1320', '#1e293b');
      }).join('');
      var giq = st.findIndex(function (s) { return s.kind === 'quiz' && s.mi === mi; });
      items += notionRow('✓', 'Module quiz', giq, isDone, 'rgba(210,35,37,.06)', 'rgba(210,35,37,.22)');
      return '<div style="background:' + cardBg + ';border:1px solid ' + cardBorder + ';border-radius:16px;padding:18px 20px">'
        + '<div style="display:flex;gap:16px;align-items:center;margin-bottom:12px">'
        + '<div style="flex:0 0 auto;width:48px;height:48px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:1.35rem;background:' + numBg + ';border:1px solid ' + numBorder + ';color:' + numColor + '">' + numGlyph + '</div>'
        + '<div style="flex:1 1 auto;min-width:0"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
        + '<span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.02em;font-size:1.28rem;color:#fff">' + esc(m.title) + '</span>'
        + '<span style="font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:3px 9px;border-radius:999px;background:' + pillBg + ';color:' + pillColor + '">' + statusLabel + '</span></div>'
        + '<div style="color:#8694ad;font-size:.86rem">' + m.notions.length + ' topics · 1 quiz</div></div></div>'
        + '<div style="display:flex;flex-direction:column;gap:7px;padding-left:4px">' + items + '</div></div>';
    }).join('');

    var attBorder = allDone ? 'rgba(16,185,129,.4)' : '#1e293b';
    var attBg = allDone ? 'linear-gradient(120deg,rgba(16,185,129,.12),rgba(13,19,32,.6))' : '#0d1320';
    var attKick = allDone ? '#34d399' : '#8694ad';
    var attTitle = allDone ? 'You have unlocked your certificate' : 'Finish all 5 modules to unlock';
    var attDesc = allDone ? "Enter your name: your personalized certificate is ready to print or save as a PDF." : "Go through the topics and pass the quiz in each module to generate your certificate.";
    var attBtnBg = allDone ? 'linear-gradient(135deg,#10b981,#0e9f6e)' : '#1a2332';
    var attBtnColor = allDone ? '#fff' : '#64748b';
    var att = '<div id="attestation" style="margin-top:18px;border-radius:18px;border:1px solid ' + attBorder + ';background:' + attBg + ';padding:28px">'
      + '<div style="display:flex;flex-wrap:wrap;gap:22px;align-items:center;justify-content:space-between">'
      + '<div style="flex:1 1 360px;min-width:260px">'
      + '<div style="display:inline-flex;align-items:center;gap:9px;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.1em;font-size:.82rem;color:' + attKick + ';margin-bottom:8px"><span>' + (allDone ? '🎓' : '🔒') + '</span> Training certificate</div>'
      + '<h3 style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.01em;font-size:1.6rem;margin:0 0 6px;color:#fff">' + attTitle + '</h3>'
      + '<p style="color:#cbd5e1;font-size:.96rem;margin:0;max-width:520px">' + attDesc + '</p></div>'
      + '<button data-act="getCert"' + (allDone ? '' : ' disabled') + ' style="flex:0 0 auto;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.04em;font-size:1rem;color:' + attBtnColor + ';background:' + attBtnBg + ';border:none;cursor:' + (allDone ? 'pointer' : 'not-allowed') + ';padding:14px 26px;border-radius:999px">' + (allDone ? 'Get my certificate' : 'Locked') + '</button></div>'
      + (state.certVisible && allDone ? certBlock() : '') + '</div>';

    return '<div><section style="position:relative;overflow:hidden;border-bottom:1px solid #1e293b;background:radial-gradient(120% 100% at 80% -10%,#16202f 0%,#0a0e17 55%)">'
      + '<svg viewBox="0 0 520 600" aria-hidden="true" style="position:absolute;right:-40px;top:50%;transform:translateY(-50%);height:150%;opacity:.5;pointer-events:none"><g fill="none" stroke-linecap="round"><path d="M40 600 V330 A220 220 0 0 1 480 330 V600" stroke="rgba(255,255,255,.06)" stroke-width="2"></path><path d="M130 600 V350 A130 130 0 0 1 390 350 V600" stroke="rgba(210,35,37,.34)" stroke-width="3"></path><path d="M175 600 V360 A85 85 0 0 1 345 360 V600" stroke="rgba(255,255,255,.09)" stroke-width="2"></path><circle cx="260" cy="330" r="5" fill="rgba(239,90,92,.85)" stroke="none" style="animation:fgPulse 3.2s ease-in-out infinite"></circle></g></svg>'
      + '<div class="fg-hero-inner" style="position:relative;max-width:1120px;margin:0 auto;padding:52px 28px 44px;display:flex;flex-wrap:wrap;gap:44px;align-items:center;justify-content:space-between">'
      + '<div style="flex:1 1 520px;min-width:300px">'
      + '<div style="display:inline-flex;align-items:center;gap:10px;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;letter-spacing:.14em;text-transform:uppercase;font-size:1rem;color:#ef5a5c;margin-bottom:14px"><span style="width:7px;height:7px;border-radius:50%;background:#d22325;box-shadow:0 0 8px rgba(210,35,37,.9)"></span>Guided training · New workers</div>'
      + '<h1 class="fg-h1" style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.01em;line-height:1.02;font-size:clamp(2.3rem,5vw,3.5rem);margin:0 0 16px">MSD prevention,<br><span style="color:#ef5a5c">step by step.</span></h1>'
      + '<p class="fg-hero-sub" style="max-width:540px;color:#cbd5e1;font-size:1.1rem;margin:0 0 24px">A training course broken into <strong style="color:#fff">short topics</strong>: one page per topic, in order. At the end of each module, a mini-quiz. Your certificate is waiting at the finish.</p>'
      + '<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center">'
      + '<button class="fg-cta" data-act="start" style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.04em;font-size:1.02rem;color:#fff;border:none;cursor:pointer;padding:14px 26px;border-radius:999px;background:linear-gradient(135deg,#e23a3c,#a81a1c);box-shadow:0 6px 20px rgba(210,35,37,.36)">' + startLabel + ' →</button>'
      + '<button class="fg-ghost" data-act="reset" style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.04em;font-size:.88rem;color:#8694ad;background:transparent;border:1px solid #1e293b;cursor:pointer;padding:13px 20px;border-radius:999px">↺ Start over</button></div></div>'
      + '<div class="fg-hero-card" style="flex:0 0 auto;width:264px;background:rgba(17,24,39,.66);border:1px solid #1e293b;border-radius:18px;padding:26px 24px;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.3)">'
      + '<div class="fg-ring" style="position:relative;width:148px;height:148px;margin:0 auto 16px"><svg viewBox="0 0 120 120" style="width:148px;height:148px;transform:rotate(-90deg)"><circle cx="60" cy="60" r="52" fill="none" stroke="#1e293b" stroke-width="11"></circle><circle cx="60" cy="60" r="52" fill="none" stroke="#d22325" stroke-width="11" stroke-linecap="round" stroke-dasharray="' + ringDash + '" style="transition:stroke-dasharray .6s"></circle></svg>'
      + '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><span class="fg-pct" style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:2.6rem;line-height:1;color:#fff">' + pct + '%</span><span style="font-size:.72rem;text-transform:uppercase;letter-spacing:.12em;color:#8694ad;font-weight:700">complete</span></div></div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.04em;font-size:1.05rem;color:#fff">' + doneCount + ' / ' + total + ' modules</div>'
      + '<div style="color:#8694ad;font-size:.86rem;margin-top:2px">' + progressHint + '</div></div></div></section>'
      + '<section style="max-width:1120px;margin:0 auto;padding:34px 28px 64px">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.03em;font-size:1.5rem;display:flex;align-items:center;gap:10px;margin-bottom:22px"><span style="width:5px;height:1.25rem;background:#d22325;border-radius:3px"></span>The path · ' + totalNotions + ' topics</div>'
      + '<div style="display:flex;flex-direction:column;gap:14px">' + cards + '</div>'
      + att
      + '<p style="color:#8694ad;font-size:.82rem;margin:20px 2px 0;line-height:1.6">Guided training · New workers &nbsp;·&nbsp; Sources: CNESST (2023) · INSPQ. Your progress is saved on this device.</p>'
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
    var d = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
    return '<div style="margin-top:24px;position:relative;max-width:560px">'
      + '<div id="certDoc" style="background:#fff;color:#111;border-radius:14px;padding:32px 30px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.4)">'
      + '<img src="images/logo_roger.png" alt="Machines Roger International" style="height:50px;background:#000;border-radius:8px;padding:4px 6px;margin-bottom:14px">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;letter-spacing:.06em;font-size:1.4rem;color:#d22325">TRAINING CERTIFICATE</div>'
      + '<div style="color:#555;font-size:.92rem;margin:4px 0 20px">Prevention of musculoskeletal disorders · Underground mine</div>'
      + '<div style="font-size:.74rem;text-transform:uppercase;letter-spacing:.14em;color:#888">Awarded to</div>'
      + '<div id="certName" style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:1.6rem;color:#111;border-bottom:2px solid #d22325;display:inline-block;margin:8px auto 18px;padding:2px 18px 4px">' + (esc(state.certName) || '—') + '</div>'
      + '<div style="display:flex;gap:26px;justify-content:center;flex-wrap:wrap;color:#333;font-size:.9rem;margin-bottom:14px"><span>5 modules passed · <b>100&nbsp;%</b></span><span>' + d + '</span></div>'
      + '<div style="font-weight:700;color:#111;font-size:.86rem">Machines Roger International</div></div>'
      + '<div class="att-emp" style="position:relative;margin:18px 0 0"><label style="display:block;font-size:.78rem;text-transform:uppercase;letter-spacing:.1em;color:#8694ad;margin-bottom:6px">Your full name</label>'
      + '<input id="attName" type="text" autocomplete="off" placeholder="First and last name" value="' + esc(state.certName) + '" style="width:100%;background:#0d1320;border:1px solid #1e293b;border-radius:10px;padding:.7rem .9rem;color:#f1f5f9;font:inherit;font-size:1rem">'
      + '<div id="empSugg" class="emp-sugg" hidden></div>'
      + '<p id="empHint" style="color:#8694ad;font-size:.82rem;margin:.5rem 0 0">Start typing your name, then pick it from the list.</p></div>'
      + '<div id="attActions" style="display:flex;flex-wrap:wrap;gap:12px;margin-top:16px">'
      + '<button class="fg-cta" data-act="print" style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.03em;font-size:.95rem;color:#fff;background:linear-gradient(135deg,#10b981,#0e9f6e);border:none;border-radius:999px;padding:12px 24px;cursor:pointer;box-shadow:0 6px 18px rgba(16,185,129,.35)">Print / save (PDF)</button></div></div>';
  }

  /* ---------------- RENDU : LECTEUR ---------------- */
  function renderViewer() {
    var st = steps();
    var cur = st[state.idx] || st[0];
    var m = cur.module, notionCount = m.notions.length;
    var kicker, counter, barPct, title, body = '';
    if (cur.kind === 'notion') {
      kicker = 'Topic ' + (cur.ni + 1) + ' of ' + notionCount;
      counter = (cur.ni + 1) + ' / ' + notionCount;
      barPct = Math.round((cur.ni + 1) / (notionCount + 1) * 100);
      title = cur.notion.title;
      body = cur.notion.custom ? renderCustom(cur.notion) : renderGeneric(cur.notion);
    } else {
      kicker = 'Module quiz'; counter = 'Quiz'; barPct = 100; title = 'Quiz · ' + m.title;
      body = renderQuiz(m);
    }
    var last = state.idx >= st.length - 1;
    var nextLabel, nextBg;
    if (cur.kind === 'quiz') {
      var sc = moduleScore(m);
      nextLabel = last ? 'Finish →' : 'Next module →';
      nextBg = sc.passed ? 'linear-gradient(135deg,#10b981,#0e9f6e)' : 'linear-gradient(135deg,#e23a3c,#a81a1c)';
    } else { nextLabel = 'Next →'; nextBg = 'linear-gradient(135deg,#e23a3c,#a81a1c)'; }
    var prevDis = state.idx <= 0;

    return '<div><div style="position:sticky;top:59px;z-index:30;background:rgba(13,19,32,.94);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid #1e293b">'
      + '<div style="max-width:880px;margin:0 auto;padding:11px 28px;display:flex;align-items:center;gap:16px;justify-content:space-between">'
      + '<button class="fg-nav" data-act="goSommaire" style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.03em;font-size:.8rem;color:#8694ad;background:none;border:1px solid #1e293b;border-radius:999px;padding:7px 15px;cursor:pointer">☰ Contents</button>'
      + '<div style="flex:1 1 auto;text-align:center;min-width:0"><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-size:.74rem;color:#ef5a5c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Module ' + m.num + ' · ' + esc(m.title) + '</div></div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:.82rem;color:#8694ad;white-space:nowrap">' + counter + '</div></div>'
      + '<div style="height:4px;background:#0a0e17"><div style="height:100%;width:' + barPct + '%;background:linear-gradient(90deg,#e23a3c,#ef5a5c);transition:width .4s"></div></div></div>'
      + '<main style="max-width:880px;margin:0 auto;padding:30px 28px 40px;min-height:50vh">'
      + '<div style="display:inline-flex;align-items:center;gap:9px;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;letter-spacing:.1em;text-transform:uppercase;font-size:.84rem;color:#ef5a5c;margin-bottom:10px"><span style="width:7px;height:7px;border-radius:50%;background:#d22325;box-shadow:0 0 8px rgba(210,35,37,.9)"></span>' + kicker + '</div>'
      + '<h1 style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.01em;line-height:1.05;font-size:clamp(1.9rem,4vw,2.7rem);margin:0 0 22px;color:#fff">' + esc(title) + '</h1>'
      + body
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:40px;padding-top:22px;border-top:1px solid #1e293b">'
      + '<button class="fg-nav" data-act="prev"' + (prevDis ? ' disabled' : '') + ' style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.03em;font-size:.9rem;color:' + (prevDis ? '#475569' : '#8694ad') + ';background:none;border:1px solid #1e293b;border-radius:999px;padding:11px 20px;cursor:' + (prevDis ? 'not-allowed' : 'pointer') + '">← Previous</button>'
      + '<button class="fg-cta" data-act="next" style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.03em;font-size:.95rem;color:#fff;background:' + nextBg + ';border:none;border-radius:999px;padding:12px 24px;cursor:pointer">' + nextLabel + '</button></div></main></div>';
  }

  function renderGeneric(n) {
    // Claude Design mockup: generic topics show only the visual
    // (Borg scale, infographics, images…), without intro text or point cards.
    return renderExtra(n);
  }

  function imgBlock(src, alt) {
    return '<div style="margin-top:24px;border-radius:16px;overflow:hidden;border:1px solid #1e293b;background:#000"><img src="' + src + '" alt="' + esc(alt) + '" loading="lazy" decoding="async" style="display:block;width:100%;height:auto"></div>';
  }

  function renderExtra(n) {
    var x = n.extra;
    if (x === 'borg') return borgWidget();
    if (x === 'fatigue') return fatigueWidget();
    if (x === 'statique') return imgBlock('images/travail_statique.jpg', 'Prolonged static work: what happens in the muscle and the effects');
    if (x === 'disque') return imgBlock('images/pression_disque.jpg', 'Pressure variations vs static pressure: effect on the nutrition of the intervertebral disc');
    if (x === 'controle') return controleWidget(n);
    if (x === 'balance') return balanceWidget();
    if (x === 'sommeil') return sommeilWidget();
    if (x === 'nuit') return nuitWidget();
    if (x === 'leviers12' || x === 'leviers34') return leviersWidget(x);
    if (x === 'gallery') return galleryWidget(n);
    return '';
  }

  function controleWidget(n) {
    // Claude Design mockup: "control measures" = image only (no cards).
    return imgBlock('images/moyens_controle.jpg', 'Control measures: micro-breaks, task rotation, stretching, alternating postures');
  }

  function borgWidget() {
    var rows = BORG_LEVELS.map(function (l) {
      var on = state.borgSel === l.num;
      return '<button class="fg-opt" data-borg="' + l.num + '" style="display:flex;align-items:center;gap:16px;text-align:left;cursor:pointer;background:' + (on ? 'rgba(255,255,255,.06)' : 'rgba(17,24,39,.5)') + ';border:1px solid ' + (on ? l.badge : '#1e293b') + ';border-radius:11px;padding:9px 14px;width:100%">'
        + '<span style="flex:0 0 auto;width:38px;height:38px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:1.35rem;color:#0a0e17;background:' + l.badge + '">' + l.num + '</span>'
        + '<span style="flex:0 0 auto;min-width:128px;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.03em;font-size:.98rem;color:#fff">' + esc(l.name) + '</span>'
        + '<span style="color:#9aa7bd;font-size:.9rem">' + esc(l.desc) + '</span></button>';
    }).join('');
    return '<div style="margin-top:26px"><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.03em;font-size:1.35rem;color:#ef5a5c;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:4px">Perceived exertion scale <span style="font-size:.92rem;color:#8694ad;letter-spacing:.02em">(Borg scale)</span></div>'
      + '<p style="color:#9aa7bd;font-size:.96rem;margin:0 0 16px">Click a level: what it means at work and what to do appear just below.</p>'
      + '<div style="display:flex;gap:14px;align-items:stretch"><div style="flex:0 0 auto;display:flex;flex-direction:column;align-items:center;width:78px"><span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.05em;font-size:.62rem;color:#34d399;text-align:center;line-height:1.2;margin-bottom:6px">Low<br>intensity</span><span style="flex:1 1 auto;width:9px;border-radius:999px;background:linear-gradient(#22c55e,#86c531 22%,#eab308 45%,#f97316 68%,#ef4444 100%)"></span><span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.05em;font-size:.62rem;color:#ef4444;text-align:center;line-height:1.2;margin-top:6px">High<br>intensity</span></div>'
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
      + '<div style="background:#0a0e17;padding:14px 18px"><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.05em;font-size:.78rem;color:#8694ad;margin-bottom:5px">At work</div><p style="color:#dbe3ee;font-size:.95rem;margin:0">' + esc(z.work) + '</p></div>'
      + '<div style="background:#0a0e17;padding:14px 18px"><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.05em;font-size:.78rem;color:' + z.color + ';margin-bottom:5px">What to do</div><p style="color:#dbe3ee;font-size:.95rem;margin:0">' + esc(z.action) + '</p></div></div></div>';
  }

  function fatigueWidget() {
    var rows = FATIGUE.map(function (r) {
      return '<div style="grid-column:1;display:flex;align-items:center;gap:14px;background:#0c111b;border:1px solid #1e293b;border-radius:12px;padding:14px 16px"><span style="flex:0 0 auto;width:46px;height:46px;display:flex;align-items:center;justify-content:center;color:' + r.color + ';background:rgba(255,255,255,.04);border:1px solid #283449;clip-path:polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%)">' + svg(r.icon, 2.1, 20) + '</span><span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.02em;font-size:1.02rem;color:#fff;line-height:1.2">' + esc(r.cause) + '</span></div>'
        + '<div style="grid-column:2;display:flex;align-items:center;justify-content:center;color:#ef5a5c">' + svg('<path d="M6 5l7 7-7 7"></path><path d="M13 5l7 7-7 7" opacity=".5"></path>', 2.6, 26) + '</div>'
        + '<div style="grid-column:3;display:flex;align-items:center;background:#0c111b;border:1px solid #1e293b;border-radius:12px;padding:14px 16px"><span style="color:#cbd5e1;font-size:.94rem">' + esc(r.effect) + '</span></div>';
    }).join('');
    return '<div style="margin-top:26px"><div style="display:flex;align-items:center;gap:14px;background:#0d1320;border:1px solid rgba(210,35,37,.4);border-radius:12px;padding:14px 18px;margin-bottom:20px"><span style="flex:0 0 auto;width:38px;height:38px;display:flex;align-items:center;justify-content:center;color:#ef5a5c;background:rgba(210,35,37,.12);border:1px solid rgba(210,35,37,.4);clip-path:polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%)">' + svg('<line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>', 2.3, 18) + '</span><span style="color:#dbe3ee;font-size:.98rem">Muscle fatigue leads to an <strong style="color:#ef5a5c">increased risk of injury</strong>.</span></div>'
      + '<strong style="color:#fff;display:block;margin-bottom:12px">Three consequences follow one another:</strong>'
      + '<div style="display:grid;grid-template-columns:1fr 44px 1fr;gap:14px 10px;align-items:stretch">'
      + '<div style="grid-column:1;display:flex"><div style="flex:1;text-align:center;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.1em;font-size:.92rem;color:#fff;background:linear-gradient(135deg,#e23a3c,#a81a1c);padding:9px 0;clip-path:polygon(0 0,100% 0,92% 50%,100% 100%,0 100%)">Cause</div></div><div style="grid-column:2"></div><div style="grid-column:3;display:flex"><div style="flex:1;text-align:center;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.1em;font-size:.92rem;color:#fff;background:linear-gradient(135deg,#e23a3c,#a81a1c);padding:9px 0;clip-path:polygon(8% 0,100% 0,100% 100%,8% 100%,0 50%)">Effect</div></div>'
      + rows + '</div>'
      + '<div style="display:flex;align-items:center;gap:14px;background:#0d1320;border:1px solid rgba(210,35,37,.4);border-radius:12px;padding:14px 18px;margin-top:20px"><span style="flex:0 0 auto;width:38px;height:38px;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(135deg,#e23a3c,#a81a1c);clip-path:polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%)">' + svg('<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"></path>', 2.2, 18) + '</span><span style="color:#dbe3ee;font-size:.98rem"><strong style="color:#fff">Acting early</strong> lets you preserve your abilities, <strong style="color:#ef5a5c">reduce the risk of injury</strong> and protect your long-term health.</span></div></div>';
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
    var load = balanceCol('What increases the load', BALANCE.load, '#ef5a5c', '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 3-1.5 4-1.5 6.5A4 4 0 0 0 14 12c.3-1 .2-1.8-.2-2.8 1.8.9 3.2 2.9 3.2 5.3a5 5 0 1 1-10 0c0-3.6 3.5-5 5.2-12.5z"></path></svg>', 'rgba(210,35,37,.16)', 'rgba(210,35,37,.4)');
    var rest = balanceCol('What restores capacity', BALANCE.restore, '#34d399', svg('<path d="M3 12h3l2 5 4-10 2 5h4"></path>', 2.3, 24), 'rgba(16,185,129,.16)', 'rgba(16,185,129,.4)');
    return '<div style="margin-top:24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px">' + load + rest + '</div>';
  }

  function sommeilWidget() {
    function card(ic, t, p) { return '<div style="border:1px solid #1e293b;border-left:4px solid #d22325;border-radius:14px;background:rgba(13,19,32,.6);padding:20px"><div style="display:flex;align-items:center;gap:14px;border-bottom:1px solid #1e293b;padding-bottom:13px;margin-bottom:13px"><span style="flex:0 0 auto;width:46px;height:46px;border-radius:50%;background:#d22325;display:flex;align-items:center;justify-content:center;color:#fff">' + svg(ic, 2.2, 22) + '</span><span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.02em;font-size:1.2rem;color:#fff;line-height:1.05">' + t + '</span></div><p style="color:#cbd5e1;font-size:1rem;margin:0">' + p + '</p></div>'; }
    return '<div style="margin-top:24px"><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.12em;font-size:.86rem;color:#ef5a5c;margin-bottom:6px">The #1 repairer</div><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.005em;font-size:clamp(1.6rem,3.2vw,2.2rem);color:#fff;line-height:1.02;margin-bottom:20px">While you sleep, your body repairs itself</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px">'
      + card('<path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2 2.5-2.5z"></path>', 'The body repairs itself', 'Muscles and joints used during the day recover mainly while you sleep.')
      + card('<path d="M9 12h6"></path><path d="M10 8H7a4 4 0 0 0 0 8h3"></path><path d="M14 8h3a4 4 0 0 1 0 8h-3"></path>', 'Fewer injuries', "When you're short on sleep, the risk of an accident and a wrong move rises sharply.")
      + card('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>', 'Alertness', "Awake for 17 h straight, your alertness is equivalent to a blood alcohol level of 0.05.")
      + '</div>'
      + '<div style="margin-top:16px;display:flex;flex-wrap:wrap;align-items:center;gap:16px 22px;background:linear-gradient(120deg,rgba(210,35,37,.16),rgba(210,35,37,.06));border:1px solid rgba(210,35,37,.45);border-radius:14px;padding:16px 20px"><div style="display:flex;align-items:center;gap:14px;flex:1 1 360px"><span style="flex:0 0 auto;width:42px;height:42px;border-radius:50%;background:#d22325;display:flex;align-items:center;justify-content:center;color:#fff">' + svg('<rect x="2" y="7" width="16" height="10" rx="2"></rect><line x1="22" y1="11" x2="22" y2="13"></line>', 2.2, 20) + '</span><div><span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.03em;font-size:1.18rem;color:#fff">Fatigue can\'t be made up</span><span style="display:block;color:#cbd5e1;font-size:.95rem">with a sleep-in: it builds up like a debt.</span></div></div>'
      + '<div style="display:flex;align-items:center;gap:12px;border-left:1px solid rgba(210,35,37,.4);padding-left:20px"><span style="flex:0 0 auto;width:42px;height:42px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid #283449;display:flex;align-items:center;justify-content:center;color:#ef5a5c">' + svg('<rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>', 2.2, 20) + '</span><div style="color:#fff;font-size:1rem;line-height:1.2">Aim for <b style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:1.3rem;color:#ef5a5c">7 to 9 h</b><span style="display:block;color:#cbd5e1;font-size:.92rem">per 24 h.</span></div></div></div></div>';
  }

  function nuitWidget() {
    var cards = NUIT.map(function (c) {
      return '<div style="border:1px solid #1e293b;border-left:4px solid #d22325;border-radius:14px;background:rgba(13,19,32,.6);padding:18px 18px 20px"><div style="display:flex;align-items:center;gap:13px;border-bottom:1px solid #1e293b;padding-bottom:12px;margin-bottom:12px"><span style="flex:0 0 auto;width:44px;height:44px;border-radius:50%;background:#0c0f17;border:1px solid #283449;display:flex;align-items:center;justify-content:center;color:#ef5a5c">' + svg(c.icon, 2.1, 21) + '</span><span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.02em;font-size:1.12rem;color:#fff;line-height:1.05">' + esc(c.title) + '</span></div><p style="color:#cbd5e1;font-size:.97rem;margin:0">' + esc(c.text) + '</p></div>';
    }).join('');
    return '<div style="margin-top:24px"><div style="display:flex;align-items:center;gap:14px;margin-bottom:6px"><span style="flex:0 0 auto;color:#fff"><svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8z"></path></svg></span><span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.005em;font-size:clamp(1.6rem,3.2vw,2.2rem);color:#fff;line-height:1.02">Sleeping by day, working by night</span></div>'
      + '<p style="color:#9aa7bd;font-size:1.02rem;margin:0 0 20px;max-width:680px">The body doesn\'t naturally like sleeping during the day. These habits help you recover better between shifts.</p>'
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
    if (n.custom === 'cIntro') return '<div class="fg-kb"><p class="lead">A musculoskeletal disorder (MSD) is an injury to the <strong>muscles</strong>, <strong>tendons</strong>, <strong>nerves</strong>, <strong>ligaments</strong> or <strong>joints</strong>, caused or made worse by work. It is rarely the result of a single accident: it <strong style="color:var(--accent-l)">sets in gradually</strong>, when repeated movements, efforts and postures exceed the <strong>body\'s ability to recover</strong>. It starts with simple <strong style="color:var(--accent-l)">discomfort</strong> and can end in <strong style="color:var(--accent-l)">lasting injury</strong>.</p><div class="alert"><div class="i">' + svg('<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>', 2, 22) + '</div><div>An MSD has no single cause: effort, posture, repetition, fatigue and environment add up. Acting at the very first discomfort keeps the problem from setting in.</div></div></div>';
    if (n.custom === 'cTypes') return '<div class="fg-kb"><p class="lead">The most common forms of MSD in workers. <strong style="color:var(--accent-l)">The lower back is by far the most affected area.</strong></p><div class="icards tms-c">'
      + '<article class="imgcard" style="border:2px solid #d22325;box-shadow:0 0 0 4px rgba(210,35,37,.16),0 14px 38px rgba(0,0,0,.45)"><div style="position:absolute;top:.65rem;left:.65rem;z-index:3;background:linear-gradient(135deg,#e23a3c,#a81a1c);color:#fff;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.06em;font-size:.68rem;padding:.28rem .6rem;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.4)">★ Most common</div><div class="media" style="height:220px;background:#0a0e17"><img src="images/tms_lombalgie.jpeg" alt="Low-back pain" loading="lazy" decoding="async" style="object-fit:contain;display:block"></div><div class="body"><h4 style="color:#ef5a5c">Low-back pain</h4><p>Pain in the lower back — <strong style="color:#e2e8f0">the most affected area</strong> in workers.</p></div></article>'
      + '<article class="imgcard"><div class="media" style="height:220px;background:#0a0e17"><img src="images/tms_tendinite.jpeg" alt="Tendinitis" loading="lazy" decoding="async" style="object-fit:contain;display:block"></div><div class="body"><h4>Tendinitis</h4><p>Inflammation of a tendon: shoulder, elbow, wrist.</p></div></article>'
      + '<article class="imgcard"><div class="media" style="height:220px;background:#0a0e17"><img src="images/tms_bursite.jpeg" alt="Bursitis" loading="lazy" decoding="async" style="object-fit:contain;display:block"></div><div class="body"><h4>Bursitis</h4><p>Inflammation of the bursae: knees, shoulders.</p></div></article>'
      + '<article class="imgcard"><div class="media" style="height:220px;background:#0a0e17"><img src="images/tms_carpien.jpeg" alt="Carpal tunnel syndrome" loading="lazy" decoding="async" style="object-fit:contain;display:block"></div><div class="body"><h4>Carpal tunnel syndrome</h4><p>Compression of the median nerve at the wrist.</p></div></article></div></div>';
    if (n.custom === 'cZones') return renderZones();
    if (n.custom === 'cFacteurs') return renderFacteurs();
    if (n.custom === 'cEvolution') return renderEvolution();
    return '';
  }

  var ZONE_FICHES = [
    { z: 'cou', nom: 'Neck', icone: '🧣', img: 'images/zone_cou.jpeg',
      tms: ['Neck pain (cervicalgia)', 'Neck tension', 'Cervicogenic headaches'],
      desc: "Your neck carries the weight of your head all day, and every time you tilt it forward the load on your neck muscles shoots up.",
      conseils: ["Keep the task at eye level to avoid tilting your head.", "Release your neck with short, regular movements.", "Keep your head in line rather than twisted to the side."] },
    { z: 'epaules', nom: 'Shoulders', icone: '💪', img: 'images/zone_epaules.jpeg',
      tms: ['Rotator cuff tendinitis', 'Bursitis', 'Frozen shoulder (capsulitis)'],
      desc: "Your shoulder is very mobile but not very stable, and working with your arms raised or away from your body quickly wears its tendons.",
      conseils: ["Work with your elbows close to your body.", "Keep the work surface below shoulder level.", "Alternate tasks that require working with raised arms."] },
    { z: 'haut-dos', nom: 'Upper back', icone: '🦴', img: 'images/zone_dos.jpeg',
      tms: ['Mid-back pain', 'Tension between the shoulder blades'],
      desc: "Your upper back absorbs bent postures and working with your arms forward, and tension between the shoulder blades is the first warning sign.",
      conseils: ["Adjust the height of the work surface.", "Open your shoulders and vary your posture regularly.", "Bring the task closer so you don't work with outstretched arms."] },
    { z: 'bas-dos', nom: 'Lower back', icone: '🦴', img: 'images/zone_dos.jpeg',
      tms: ['Low-back pain', 'Herniated disc', 'Sciatica'],
      desc: "Your lower back is the area most affected by MSDs, because your discs take enormous pressure as soon as you bend or twist under load.",
      conseils: ["Bend your knees and keep the load close to your body.", "Pivot with your feet rather than your trunk.", "Use the mechanical aids available."] },
    { z: 'coudes', nom: 'Elbows', icone: '🦾', img: 'images/zone_coudes.jpeg',
      tms: ['Lateral epicondylitis (tennis elbow)', 'Medial epicondylitis'],
      desc: "Your elbows flare up when you grip, screw and twist repeatedly — the well-known tennis elbow.",
      conseils: ["Reduce your gripping force with better tools.", "Avoid repeated wrist rotations under effort.", "Take breaks before the burning sensation sets in."] },
    { z: 'poignets-mains', nom: 'Wrists / hands', icone: '✋', img: 'images/zone_poignets.jpeg',
      tms: ['Carpal tunnel syndrome', "De Quervain's tendinitis", 'Hand-arm vibration (white fingers)'],
      desc: "Your wrists route tendons and a nerve through a narrow tunnel, where repeated movements, pinch grips, vibration and cold quickly add up.",
      conseils: ["Keep your wrist aligned with your forearm.", "Alternate hands and types of grip.", "Report tingling and night numbness early."] },
    { z: 'genoux', nom: 'Knees', icone: '🦵', img: 'images/zone_genoux.jpeg',
      tms: ['Knee bursitis', 'Meniscus injury', 'Patellofemoral syndrome'],
      desc: "Your knees aren't made to be used as a support, and repeated kneeling or squatting wears down their structures.",
      conseils: ["Wear knee pads suited to your job.", "Use a mat, a low bench or a workshop roller seat.", "Stand up and stretch your legs often."] },
    { z: 'chevilles-pieds', nom: 'Ankles / feet', icone: '🦶', img: '',
      tms: ['Achilles tendinitis', 'Plantar fasciitis', 'Recurring sprains'],
      desc: "Your feet and Achilles tendon tire from standing on hard floors, and an uneven or slippery floor adds missteps.",
      conseils: ["Wear cushioned work shoes suited to the job.", "Use an anti-fatigue mat at fixed standing stations.", "Keep walkways flat and clear."] }
  ];
  function zoneByKey(k) { for (var i = 0; i < ZONE_FICHES.length; i++) { if (ZONE_FICHES[i].z === k) return ZONE_FICHES[i]; } return null; }
  function clearZoneActive() { app.querySelectorAll('.fg-zone-chip.active, .hotspot3d.h3-open').forEach(function (o) { o.classList.remove('active'); o.classList.remove('h3-open'); }); }
  function updateZonesProgress() {
    var el = document.getElementById('fgZoneProg'); if (!el) return;
    var n = 0; ZONE_FICHES.forEach(function (z) { if (state.zonesVues.indexOf(z.z) >= 0) n++; });
    var all = n >= ZONE_FICHES.length;
    el.textContent = all ? ('✓ All areas viewed (' + n + '/' + ZONE_FICHES.length + ')') : (n + ' / ' + ZONE_FICHES.length + ' areas viewed');
    el.className = 'fg-zone-prog' + (all ? ' done' : '');
  }
  function zoneEscHandler(e) { if (e.key === 'Escape' || e.key === 'Esc') closeZoneFiche(); }
  function closeZoneFiche() {
    var box = document.getElementById('zoneFiche');
    if (box) { box.hidden = true; box.innerHTML = ''; }
    clearZoneActive();
    document.removeEventListener('keydown', zoneEscHandler);
    try { document.documentElement.style.overflow = ''; } catch (e) {}
  }
  function openZoneFiche(k) {
    var z = zoneByKey(k), box = document.getElementById('zoneFiche');
    if (!z || !box) return;
    box.innerHTML = '<div class="zfm-dialog" role="dialog" aria-modal="true" aria-label="' + esc(z.nom) + '">'
      + '<button type="button" class="zf-close" aria-label="Close the card">✕</button>'
      + (z.img ? '<img src="' + z.img + '" alt="' + esc(z.nom) + '" class="zf-img" loading="lazy" decoding="async">' : '')
      + '<div class="zf-body"><h4 class="zf-title">' + z.icone + ' ' + esc(z.nom) + '</h4>'
      + '<div class="zf-tms">' + z.tms.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>'
      + '<p class="zf-desc">' + esc(z.desc) + '</p>'
      + '<p class="zf-h">Good reflexes</p><ul class="zf-list">' + z.conseils.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div></div>';
    box.hidden = false;
    clearZoneActive();
    app.querySelectorAll('.fg-zone-chip[data-zone="' + k + '"]').forEach(function (e) { e.classList.add('active'); });
    app.querySelectorAll('.hotspot3d[data-zone="' + k + '"]').forEach(function (e) { e.classList.add('h3-open'); });
    if (state.zonesVues.indexOf(k) < 0) { state.zonesVues.push(k); saveZones(); }
    app.querySelectorAll('.fg-zone-chip[data-zone="' + k + '"]').forEach(function (e) { e.classList.add('vu'); });
    updateZonesProgress();
    var cl = box.querySelector('.zf-close');
    if (cl) cl.addEventListener('click', closeZoneFiche);
    document.removeEventListener('keydown', zoneEscHandler);
    document.addEventListener('keydown', zoneEscHandler);
    try { document.documentElement.style.overflow = 'hidden'; } catch (e) {}
    if (cl) { try { cl.focus(); } catch (e) {} }
  }

  function renderZones() {
    var hot = [
      ['h3-t', 'cou', '0 1.45 0.08', '0 0 1', 'Neck', 'Neck pain · Neck tension', 'cou'],
      ['h3-l', 'ep', '-0.18 1.37 0.05', '0 0 1', 'Shoulders', 'Rotator cuff tendinitis · Bursitis', 'epaules'],
      ['h3-r', 'hd', '0 1.20 -0.10', '0 0 -1', 'Upper back', 'Mid-back pain · Tension between the shoulder blades', 'haut-dos'],
      ['h3-r', 'bd', '0 0.97 -0.12', '0 0 -1', 'Lower back', 'Low-back pain · Herniated disc', 'bas-dos'],
      ['h3-l', 'co', '-0.21 1.02 0', '0 0 1', 'Elbows', 'Lateral epicondylitis · Medial epicondylitis', 'coudes'],
      ['h3-l', 'po', '-0.22 0.80 0.02', '0 0 1', 'Wrists / hands', 'Carpal tunnel syndrome · De Quervain', 'poignets-mains'],
      ['h3-r', 'ge', '0.10 0.46 0.10', '0 0 1', 'Knees', 'Knee bursitis · Meniscus', 'genoux'],
      ['h3-r', 'ch', '0.10 0.08 0.08', '0 0 1', 'Ankles / feet', "Achilles tendinitis · Plantar fasciitis", 'chevilles-pieds']
    ].map(function (h, i) {
      return '<button class="hotspot3d ' + h[0] + '" slot="hotspot-' + i + '" data-position="' + h[2] + '" data-normal="' + h[3] + '" data-zone="' + h[6] + '"><span class="h3-card"><b>' + esc(h[4]) + '</b><i>' + esc(h[5]) + '</i></span></button>';
    }).join('');
    var LAYER_LABELS = { Muscles: 'Muscles', Os: 'Bones', Articulations: 'Joints', Nerfs: 'Nerves' };
    var layers = ['Muscles', 'Os', 'Articulations', 'Nerfs'].map(function (mat) {
      var l = state.layers[mat];
      return '<div class="cl-row ' + (l.on ? 'on' : '') + '" data-mat="' + mat + '"><button class="cl-tog" type="button" aria-pressed="' + (l.on ? 'true' : 'false') + '" data-layer-toggle="' + mat + '" aria-label="Show or hide"></button><span class="cl-name">' + LAYER_LABELS[mat] + '</span><input class="cl-op" type="range" min="0" max="100" value="' + l.op + '" data-layer-op="' + mat + '" aria-label="Opacity"></div>';
    }).join('');
    var chips = ZONE_FICHES.map(function (z) {
      var vu = state.zonesVues.indexOf(z.z) >= 0;
      return '<button type="button" class="fg-zone-chip' + (vu ? ' vu' : '') + '" data-zone="' + z.z + '"><span class="zc-ico">' + z.icone + '</span>' + esc(z.nom) + '<span class="zc-check" aria-hidden="true">✓</span></button>';
    }).join('');
    return '<div class="fg-kb"><p class="lead">Underground, the most exposed areas range from the neck to the ankles. <strong style="color:#e2e8f0">Rotate the 3D model</strong> and display the structures (muscles, bones, joints, nerves):</p>'
      + '<div class="corps-3d"><model-viewer id="corps3d" src="' + MODEL_SRC + '" loading="eager" reveal="auto" alt="3D anatomical model: rotate it to explore the at-risk areas" camera-controls touch-action="pan-y" interaction-prompt="none" auto-rotate environment-image="neutral" tone-mapping="aces" shadow-intensity="0.85" shadow-softness="0.75" exposure="1.05" min-camera-orbit="auto 20deg auto" max-camera-orbit="auto 160deg auto" style="width:100%;max-width:560px;height:min(64vh,560px)">' + hot + '</model-viewer>'
      + '<div class="corps-layers" role="group" aria-label="Body structures to display"><p class="cl-title">Structures</p>' + layers + '</div>'
      + '<p class="corps-3d-note corps-3d-note-lg">Rotate the body, display the structures, then <strong>click an area</strong> to open its card.</p></div>'
      + '<div class="fg-zone-pick"><p class="fg-zone-pick-t">The most affected body areas — click an area to see the frequent MSDs and the good reflexes. <span class="fg-zone-prog" id="fgZoneProg"></span></p><div class="fg-zone-chips">' + chips + '</div></div>'
      + '<div id="zoneFiche" class="zfm-overlay" hidden></div>'
      + '</div>';
  }

  function renderFacteurs() {
    function fam(num, t, li) { return '<div style="border:2px solid rgba(210,35,37,.5);border-radius:14px;padding:18px 18px 16px;background:rgba(20,28,42,.5)"><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:1.8rem;color:#ef5a5c;text-align:center;line-height:1">' + num + '</div><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.05em;font-size:1.05rem;color:#fff;text-align:center;margin:.35rem 0 .9rem">' + t + '</div><ul style="margin:0;padding-left:1.1rem;color:#cbd5e1;font-size:.92rem;line-height:1.7">' + li + '</ul></div>'; }
    return '<div class="fg-kb"><p class="lead">In workers, the risk comes mainly from the <strong style="color:#e2e8f0">task</strong>, the <strong style="color:#e2e8f0">body</strong> and the <strong style="color:#e2e8f0">immediate environment</strong>. We distinguish three groups, which add up:</p>'
      + '<div class="fg-facteurs">'
      + '<div style="border:2px solid rgba(210,35,37,.55);border-radius:14px;padding:18px 18px 16px;background:rgba(210,35,37,.06)"><div style="display:flex;align-items:center;gap:9px;margin-bottom:12px"><span style="flex:0 0 auto;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#d22325;color:#fff">' + svg('<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"></path>', 2.2, 14) + '</span><span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.08em;font-size:.92rem;color:#ef5a5c">Key takeaway</span></div><p style="color:#cbd5e1;font-size:.92rem;margin:0 0 .7rem">An MSD has no single cause.</p><p style="color:#9aa7bd;font-size:.9rem;margin:0 0 .7rem">Often it\'s a mix of effort, posture, repetition, fatigue and environment.</p><p style="color:#9aa7bd;font-size:.9rem;margin:0">Acting early helps keep the problem from setting in.</p></div>'
      + fam('1', 'The task', '<li>Efforts and postures</li><li>Repetition, pace</li><li>Handling loads</li>')
      + fam('2', "The individual", '<li>Physical condition</li><li>Fatigue, recovery</li><li>Lifestyle</li>')
      + fam('3', "The environment", '<li>Workstation and tools</li><li>Work space</li><li>Cold, vibration</li>') + '</div>'
      + '<div style="display:flex;align-items:center;gap:12px;justify-content:center;background:linear-gradient(135deg,#e23a3c,#a81a1c);border-radius:12px;padding:14px 18px;box-shadow:0 6px 18px rgba(210,35,37,.3)">' + svg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>', 2.2, 24) + '<span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:1.08rem;color:#fff;text-align:center">It\'s not a single factor. It\'s often the combination that increases the risk.</span></div></div>';
  }

  function renderEvolution() {
    return '<div class="fg-kb"><p class="lead">An MSD sets in by stages. The same injury goes from simple <strong style="color:var(--accent-l)">discomfort</strong> to nagging <strong style="color:var(--accent-l)">pain</strong>, then to lasting <strong style="color:var(--accent-l)">injury</strong>. The longer the pain lasts, the longer the recovery — which is why acting early matters.</p>'
      + '<div class="evo3"><div class="evo-banner">'
      + '<div class="eb-stage eb1"><span class="eb-num" aria-hidden="true">1</span><div><span class="eb-name">Discomfort</span><span class="eb-phase">Acute phase · 0 to 6 weeks</span></div></div>' + svg('<path d="M5 12h14M13 6l6 6-6 6"></path>', 2, 24)
      + '<div class="eb-stage eb2"><span class="eb-num" aria-hidden="true">2</span><div><span class="eb-name">Pain</span><span class="eb-phase">Subacute phase · 6 to 12 weeks</span></div></div>' + svg('<path d="M5 12h14M13 6l6 6-6 6"></path>', 2, 24)
      + '<div class="eb-stage eb3"><span class="eb-num" aria-hidden="true">3</span><div><span class="eb-name">Injury</span><span class="eb-phase">Chronic phase · 12+ weeks</span></div></div></div>'
      + '<div class="evo-cols"><div class="evo-col ev1"><h4>The right time to act</h4><p>It pulls or burns <b>under effort</b>, then eases off at rest. <span class="ec-act">This is when to act.</span></p></div>'
      + '<div class="evo-col ev2"><h4>The pain sets in</h4><p>It comes back faster and persists <b>even when you\'re not working</b>. Sleep suffers.</p></div>'
      + '<div class="evo-col ev3"><h4>Risk of chronicity</h4><p>The pain stays <b>even at rest</b>: long and uncertain recovery.</p></div></div></div></div>';
  }

  /* ---------- QUIZ ---------- */
  function renderQuiz(m) {
    var cur = state.answers[m.id] || {};
    var sc = moduleScore(m);
    var barPct = Math.round(sc.answered / sc.total * 100);
    var barColor = sc.passed ? '#10b981' : '#d22325';
    var statText = sc.passed ? 'Passed · ' + sc.score + ' / ' + sc.total : sc.score + ' / ' + sc.total + ' correct';
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
      var validate = (isMulti && !answered && selArr.length > 0) ? '<button class="fg-cta" data-validate="' + qi + '" style="margin-top:12px;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.03em;font-size:.86rem;color:#fff;background:linear-gradient(135deg,#e23a3c,#a81a1c);border:none;border-radius:999px;padding:10px 20px;cursor:pointer">Submit my answer</button>' : '';
      var fb = '';
      if (answered) {
        var fbColor = correct ? '#34d399' : '#f87171';
        var fbBg = correct ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.08)';
        var fbBorder = correct ? 'rgba(16,185,129,.35)' : 'rgba(239,68,68,.35)';
        fb = '<div style="margin-top:12px;border-radius:10px;border:1px solid ' + fbBorder + ';background:' + fbBg + ';padding:12px 14px"><div style="display:flex;align-items:center;gap:8px;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.05em;font-size:.84rem;color:' + fbColor + ';margin-bottom:5px">' + (correct ? '✓ Correct answer' : '✗ Not quite') + '</div><p style="color:#dbe3ee;font-size:.93rem;margin:0 0 7px">' + esc(q.explain) + '</p><div style="display:flex;align-items:center;gap:6px;font-size:.78rem;color:#8694ad">' + svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>', 2, 13) + '<span>Reference: ' + esc(q.ref || 'CNESST') + '</span></div></div>';
      }
      var multiHint = isMulti ? '<div style="display:inline-flex;align-items:center;gap:6px;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.06em;font-size:.74rem;color:#ef5a5c;background:rgba(210,35,37,.1);border:1px solid rgba(210,35,37,.3);border-radius:6px;padding:3px 9px;margin:-4px 0 12px 26px">☑ Multiple answers possible</div>' : '';
      var cardBorder = answered ? (correct ? 'rgba(16,185,129,.4)' : 'rgba(239,68,68,.35)') : '#1e293b';
      return '<div style="background:rgba(13,19,32,.5);border:1px solid ' + cardBorder + ';border-radius:14px;padding:18px 18px 16px"><p style="font-weight:600;color:#f1f5f9;font-size:1.05rem;margin:0 0 12px;display:flex;gap:9px;align-items:baseline"><span style="flex:0 0 auto;color:#ef5a5c;font-family:\'Barlow Condensed\',sans-serif;font-weight:800">Q' + (qi + 1) + '</span><span>' + esc(q.q) + '</span></p>' + multiHint + '<div style="display:flex;flex-direction:column;gap:8px">' + opts + '</div>' + validate + fb + '</div>';
    }).join('');

    var resultText, resultColor;
    if (sc.passed) { resultText = '✓ Module passed (' + sc.score + ' / ' + sc.total + ') — you can unlock the next module.'; resultColor = '#34d399'; }
    else if (sc.answered === sc.total) { resultText = sc.score + ' / ' + sc.total + ' — you need at least ' + sc.need + ' correct answers (80 %). Fix the answers shown in red.'; resultColor = '#f87171'; }
    else { resultText = 'Answer all the questions (' + sc.answered + ' / ' + sc.total + ').'; resultColor = '#8694ad'; }

    return '<p class="lead">Answer the ' + sc.total + ' questions in the <b style="color:#fff">' + esc(m.title) + '</b> module. <span style="color:#9aa7bd">The correction and explanation appear as soon as you choose an answer</span>; score at least 80 % correct to unlock the next module.</p>'
      + '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 22px"><div style="flex:1 1 200px;max-width:340px;height:9px;border-radius:999px;background:#1a2332;overflow:hidden"><div style="height:100%;width:' + barPct + '%;border-radius:999px;background:' + barColor + ';transition:width .4s"></div></div><span style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:.92rem;color:' + statColor + '">' + statText + '</span></div>'
      + '<div style="display:flex;flex-direction:column;gap:22px">' + qs + '</div>'
      + '<div style="margin-top:22px"><span style="font-weight:700;font-size:1rem;color:' + resultColor + '">' + resultText + '</span></div>';
  }

  /* ---------------- ACTIONS ---------------- */
  function render(keepScroll) {
    var prevY = keepScroll ? (window.pageYOffset || document.documentElement.scrollTop || 0) : 0;
    if (mvInterval) { clearInterval(mvInterval); mvInterval = null; }
    app.innerHTML = state.view === 'viewer' ? renderViewer() : renderSommaire();
    bind();
    if (state.view === 'viewer') {
      var st = steps(), cur = st[state.idx];
      timeEnter(stepKey(cur));
      if (cur && cur.kind === 'notion' && cur.notion.custom === 'cZones') initModel();
    } else { timeLeave(); }
    if (state.view === 'sommaire' && state.certVisible) initCert();
    if (keepScroll) { try { window.scrollTo(0, prevY); } catch (e) {} }
    else { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); } }
  }

  function go(view, idx) { state.view = view; if (idx != null) state.idx = idx; state.certVisible = state.certVisible && view === 'sommaire'; render(); }

  function start() {
    var st = steps();
    var fi = MODULES.findIndex(function (m) { return !passed(m.id); });
    var idx = fi >= 0 ? st.findIndex(function (s) { return s.mi === fi; }) : 0;
    go('viewer', idx < 0 ? 0 : idx);
  }
  function reset() {
    if (!window.confirm('Start over from scratch? Your progress and answers will be erased on this device.')) return;
    state.completed = []; state.answers = {}; state.borgSel = null; state.certVisible = false; state.zonesVues = []; state.times = {};
    _tKey = null; _tT0 = 0;
    saveProg(); saveAns(); saveZones(); saveTimes();
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
    saveAns(); syncModulePass(m); render(true);
  }
  function toggleMulti(qid, qi, oi) {
    var a = state.answers[qid] = state.answers[qid] || {};
    var cell = a[qi]; if (cell && cell.done) return;
    var sel = (cell && cell.sel) ? cell.sel.slice() : [];
    var k = sel.indexOf(oi); if (k >= 0) sel.splice(k, 1); else sel.push(oi);
    a[qi] = { sel: sel, done: false };
    saveAns(); render(true);
  }
  function validateMulti(qid, qi) {
    var a = state.answers[qid] = state.answers[qid] || {};
    var cell = a[qi]; if (!cell || !cell.sel || !cell.sel.length) return;
    cell.done = true;
    saveAns(); syncModulePass(MODULES.find(function (x) { return x.id === qid; })); render(true);
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
    var payload = { name: nm, lang: 'EN', date: new Date().toISOString().slice(0, 10), score: '5/5 modules', employeeId: empId, image: image || '', timeTotal: fmtDur(totalTimeMs()), timeDetail: timeDetailText() };
    try {
      fetch(ATTEST_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function (r) { if (r && r.ok) { try { localStorage.setItem('tms_form_sent', sig); } catch (e) {} } })
        .catch(function () {});
    } catch (e) {}
  }
  /* Détail du temps en texte (envoyé à Airtable, lisible dans la grille). */
  function timeDetailText() {
    var lines = MODULES.map(function (m) {
      var sc = moduleScore(m);
      return '• ' + m.num + ' · ' + m.title + ' — ' + fmtDur(moduleTimeMs(m)) + ' (quiz ' + sc.score + '/' + sc.total + ')';
    });
    return 'Total time: ' + fmtDur(totalTimeMs()) + '\n' + lines.join('\n');
  }
  /* Attestation DÉTAILLÉE (version Airtable) : mêmes en-têtes que la version du
     travailleur + un tableau « temps par section » et le total. Générée hors
     écran : jamais affichée ni imprimée (le @media print ne montre que #certDoc). */
  function certDetailDoc() {
    var d = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
    var th = 'padding:8px 12px;border-bottom:2px solid #d22325;font-family:\'Barlow Condensed\',sans-serif;text-transform:uppercase;letter-spacing:.04em;font-size:.74rem;color:#666';
    var td = 'padding:9px 12px;border-bottom:1px solid #e5e7eb;color:#111;font-size:.86rem';
    var totS = 0, totQ = 0;
    var rows = MODULES.map(function (m) {
      var sc = moduleScore(m); totS += sc.score; totQ += sc.total;
      return '<tr><td style="' + td + ';text-align:left">' + esc(m.num + ' · ' + m.title) + '</td>'
        + '<td style="' + td + ';text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums">' + fmtDur(moduleTimeMs(m)) + '</td>'
        + '<td style="' + td + ';text-align:right;white-space:nowrap">' + sc.score + ' / ' + sc.total + '</td></tr>';
    }).join('');
    return '<div id="certDocDetail" style="background:#fff;color:#111;border-radius:14px;padding:30px 28px;box-shadow:0 10px 30px rgba(0,0,0,.4);width:600px;box-sizing:border-box;font-family:\'Barlow\',sans-serif">'
      + '<div style="text-align:center">'
      + '<img src="images/logo_roger.png" alt="Machines Roger International" style="height:46px;background:#000;border-radius:8px;padding:4px 6px;margin-bottom:12px">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;letter-spacing:.06em;font-size:1.35rem;color:#d22325">TRAINING CERTIFICATE</div>'
      + '<div style="color:#555;font-size:.9rem;margin:4px 0 6px">Prevention of musculoskeletal disorders · Underground mine</div>'
      + '<div style="display:inline-block;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:.72rem;color:#0e7d57;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.45);border-radius:999px;padding:3px 11px;margin-bottom:14px">Detailed time tracking</div>'
      + '<div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.14em;color:#888">Awarded to</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:1.5rem;color:#111;border-bottom:2px solid #d22325;display:inline-block;margin:6px auto 8px;padding:2px 18px 4px">' + (esc(state.certName) || '—') + '</div>'
      + '<div style="color:#333;font-size:.86rem;margin-bottom:16px">On ' + d + '</div></div>'
      + '<table style="width:100%;border-collapse:collapse;margin:0">'
      + '<thead><tr><th style="' + th + ';text-align:left">Section</th><th style="' + th + ';text-align:right">Time spent</th><th style="' + th + ';text-align:right">Quiz</th></tr></thead>'
      + '<tbody>' + rows + '</tbody>'
      + '<tfoot><tr>'
      + '<td style="padding:11px 12px;text-align:left;font-family:\'Barlow Condensed\',sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:.04em;font-size:.9rem;color:#111">Total</td>'
      + '<td style="padding:11px 12px;text-align:right;font-weight:800;font-size:.95rem;color:#d22325;white-space:nowrap;font-variant-numeric:tabular-nums">' + fmtDur(totalTimeMs()) + '</td>'
      + '<td style="padding:11px 12px;text-align:right;font-weight:800;font-size:.95rem;color:#111;white-space:nowrap">' + totS + ' / ' + totQ + '</td>'
      + '</tr></tfoot></table>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;border-top:1px solid #e5e7eb;padding-top:12px">'
      + '<div style="font-weight:700;color:#111;font-size:.82rem">Machines Roger International</div>'
      + '<div style="color:#888;font-size:.72rem">Automatically recorded · Web guided training</div></div></div>';
  }
  function buildCertDetailNode() {
    var wrap = document.createElement('div');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'position:fixed;left:-10000px;top:0;width:600px;pointer-events:none;z-index:-1';
    wrap.innerHTML = certDetailDoc();
    document.body.appendChild(wrap);
    return wrap;
  }
  /* Envoi à Airtable : on téléverse la version DÉTAILLÉE (temps par section).
     Le travailleur, lui, imprime/enregistre la version propre (#certDoc). */
  function sendAttestation() {
    if (!(state.certName || '').trim()) return;
    if (!ATTEST_ENDPOINT) return;
    loadShot(function () {
      var ms = window.modernScreenshot;
      var node = buildCertDetailNode();
      if (!ms || !ms.domToPng || !node) { if (node) node.remove(); postAttest(''); return; }
      ms.domToPng(node, { scale: 2, backgroundColor: '#ffffff' })
        .then(function (u) { node.remove(); postAttest(u || ''); })
        .catch(function () { node.remove(); postAttest(''); });
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
      if (pickedId && input.value.trim().toLowerCase() !== pickedName.toLowerCase()) { pickedId = ''; input.dataset.empId = ''; setHint('Start typing your name, then pick it from the list.'); }
    }
    function hl(name, term) { var t = db(name.toLowerCase()), q = db((term || '').toLowerCase()), i = q ? t.indexOf(q) : -1; if (i < 0) return esc(name); return esc(name.slice(0, i)) + '<b>' + esc(name.slice(i, i + q.length)) + '</b>' + esc(name.slice(i + q.length)); }
    function renderSugg(list, term) {
      if (!sugg) return;
      if (!list.length) { hideSugg(); setHint('No match — your name will be saved as entered.'); return; }
      sugg.innerHTML = '';
      list.forEach(function (it) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'emp-item'; b.innerHTML = hl(it.name, term);
        b.addEventListener('mousedown', function (e) { e.preventDefault(); pickedId = it.id; pickedName = it.name; input.value = it.name; input.dataset.empId = it.id; upd(); setHint('Linked to your employee record ✓'); hideSugg(); });
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
    // Body areas: a 3D marker OR an area button -> opens the detailed card as an overlay (like the knowledge base).
    app.querySelectorAll('.hotspot3d[data-zone], .fg-zone-chip[data-zone]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); openZoneFiche(el.getAttribute('data-zone')); });
    });
    var zmodal = document.getElementById('zoneFiche');
    if (zmodal) zmodal.addEventListener('click', function (e) { if (e.target === zmodal) closeZoneFiche(); });
    updateZonesProgress();
  }
  function currentQuizId() { var st = steps(), cur = st[state.idx]; return cur && cur.kind === 'quiz' ? cur.module.id : null; }

  /* ---------------- INIT ---------------- */
  function init() {
    app = document.getElementById('app');
    if (!app) return;
    load();
    // recalcule les modules réussis à partir des réponses enregistrées
    MODULES.forEach(syncModulePass);
    // suivi du temps : pause quand l'onglet est masqué, flush à la fermeture
    document.addEventListener('visibilitychange', function () { if (document.hidden) timePause(); else timeResume(); });
    window.addEventListener('pagehide', _tFlush);
    window.addEventListener('beforeunload', _tFlush);
    render();
  }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
