export interface ReadingQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface ReadingPassage {
  id: string;
  text: string;
  questions: ReadingQuestion[];
}

/**
 * Starter corpus for DichopticReading — the spec calls for 30 passages;
 * this ships 12, each 80-120 words, Flesch-Kincaid ~grade 6-8, and
 * deliberately free of color vocabulary (dichoptic text rendering assigns
 * its own red/cyan per word, so passage content referencing colors would
 * be confusing). Add more entries here to reach the full 30 — the "no
 * repeat within 7 days" rule in DichopticReading.tsx already scales to
 * whatever length this array is.
 */
export const READING_CORPUS: ReadingPassage[] = [
  {
    id: 'honeybees',
    text: "A single honeybee visits about fifty flowers on one trip from the hive. It carries pollen stuck to tiny hairs on its legs and body, and drops some of that pollen on every flower it lands on next. This is how flowers get pollinated. Without bees, many fruits and vegetables would struggle to grow at all. A healthy hive can hold sixty thousand bees, and together they may fly the equivalent distance to the moon and back to gather enough nectar for a single jar of honey. Farmers often rent beehives for a few weeks each spring just to help their crops along.",
    questions: [
      { question: 'About how many flowers does one bee visit per trip?', options: ['Five', 'Fifty', 'Five hundred', 'Five thousand'], correctIndex: 1 },
      { question: 'What do bees carry that pollinates flowers?', options: ['Water', 'Pollen', 'Seeds', 'Wax'], correctIndex: 1 },
      { question: 'Why might farmers rent beehives?', options: ['To sell honey', 'To help pollinate crops', 'To keep pests away', 'To decorate fields'], correctIndex: 1 },
    ],
  },
  {
    id: 'mountain-hike',
    text: 'Reaching the summit took nearly six hours, most of it along a narrow trail cut into the side of the ridge. The air grew thinner with every switchback, and by the final stretch each breath felt like it delivered only half its usual oxygen. At the top, the wind was strong enough to lean into. Clouds drifted below the peak instead of above it, which felt strange after a lifetime of looking up at clouds. The hikers rested for twenty minutes, ate a quick lunch, and began the long descent before the afternoon weather could turn.',
    questions: [
      { question: 'How long did the climb to the summit take?', options: ['Two hours', 'Six hours', 'Ten hours', 'One day'], correctIndex: 1 },
      { question: 'What felt strange at the top?', options: ['The silence', 'Clouds below the peak', 'The heat', 'No wind at all'], correctIndex: 1 },
      { question: 'What did the hikers do before starting down?', options: ['Set up camp', 'Rested and ate lunch', 'Waited for rescue', 'Climbed higher'], correctIndex: 1 },
    ],
  },
  {
    id: 'volcanoes',
    text: 'Not every volcano erupts with dramatic explosions. Many release lava slowly, in flows that creep across the land at walking pace or slower. Scientists monitor these mountains constantly, watching for small earthquakes, changes in gas released from vents, and even slight swelling of the ground, which can signal that magma is rising underneath. Some volcanoes stay quiet for centuries between eruptions, which makes prediction difficult. Communities near active volcanoes often have evacuation plans ready, along with maps marking which valleys would be dangerous if lava or ash began to flow.',
    questions: [
      { question: 'How do all volcanoes erupt, according to the passage?', options: ['Always explosively', 'Sometimes slowly, sometimes explosively', 'Only underground', 'Only near oceans'], correctIndex: 1 },
      { question: 'What is one thing scientists monitor?', options: ['Small earthquakes', 'Ocean tides', 'Bird migration', 'Rainfall totals'], correctIndex: 0 },
      { question: 'Why is prediction difficult for some volcanoes?', options: ['They move location', 'They can stay quiet for centuries', 'They are too small to detect', 'They erupt every year'], correctIndex: 1 },
    ],
  },
  {
    id: 'libraries',
    text: 'The oldest known library was built more than two thousand years ago and held clay tablets instead of paper books. Modern libraries have changed enormously since then, but their core purpose has stayed the same: keeping knowledge available to anyone who wants it. Today a library card can unlock not just shelves of books, but also digital archives, printers, meeting rooms, and sometimes tools like sewing machines or telescopes. Librarians spend much of their time helping people find exactly the resource they need, whether that is a novel, a tax form, or a research paper.',
    questions: [
      { question: 'What did the oldest known library store?', options: ['Paper books', 'Clay tablets', 'Scrolls only', 'Nothing physical'], correctIndex: 1 },
      { question: "What has stayed the same about libraries' purpose?", options: ['Keeping knowledge available', 'Charging for books', 'Only serving scholars', 'Being open at night'], correctIndex: 0 },
      { question: 'What might a library card unlock besides books?', options: ['Free meals', 'Digital archives and tools', 'Bus tickets', 'Concert seats'], correctIndex: 1 },
    ],
  },
  {
    id: 'ocean-tides',
    text: "Tides rise and fall because of the moon's gravity pulling on the ocean, along with a smaller pull from the sun. Most coastlines experience two high tides and two low tides roughly every twenty-four hours. The difference between high and low can be small in some bays and dramatic in others; a few coastal regions see water levels change by more than ten meters between tides. Fishermen and sailors track tide tables carefully, since a boat that seems safely afloat at high tide can end up stuck on exposed mud only hours later.",
    questions: [
      { question: 'What mainly causes tides?', options: ["The moon's gravity", 'Wind alone', 'Ocean currents', 'Earthquakes'], correctIndex: 0 },
      { question: 'How many high tides do most coasts see per day?', options: ['One', 'Two', 'Four', 'None'], correctIndex: 1 },
      { question: 'Why do sailors track tide tables?', options: ['To plan meals', 'To avoid getting stuck at low tide', 'To find fish', 'To measure temperature'], correctIndex: 1 },
    ],
  },
  {
    id: 'baking-bread',
    text: 'Bread dough rises because yeast, a living microorganism, feeds on sugar in the flour and releases carbon dioxide gas as a byproduct. Those tiny bubbles get trapped in the stretchy gluten network formed when flour is mixed with water and kneaded. Bakers often let dough rest for an hour or more so the yeast has time to work. Temperature matters a great deal; dough left in a warm spot rises faster than dough left somewhere cool. Once baked, the same gas bubbles are what give bread its light, airy texture instead of a dense, heavy one.',
    questions: [
      { question: 'What does yeast release as it feeds on sugar?', options: ['Oxygen', 'Carbon dioxide', 'Water vapor', 'Nitrogen'], correctIndex: 1 },
      { question: 'What traps the gas bubbles in dough?', options: ['The gluten network', 'The oven', 'Salt crystals', 'The crust'], correctIndex: 0 },
      { question: 'What happens to dough left in a warm spot?', options: ['It rises faster', 'It stops rising', 'It becomes dense', 'It dries out'], correctIndex: 0 },
    ],
  },
  {
    id: 'migratory-birds',
    text: 'Some birds migrate thousands of miles twice a year, guided by a mix of instinct, the position of the sun and stars, and even the pull of the earth\'s magnetic field. Young birds making their first journey often travel with experienced adults who know the route, though some species migrate entirely alone and still find their way. Scientists track migration using tiny transmitters attached to leg bands, which has revealed routes far longer and more complicated than anyone expected. One small songbird was recorded flying nonstop over open ocean for more than eighty hours straight.',
    questions: [
      { question: "What helps guide migrating birds, besides instinct?", options: ['Sun and star position', 'Radio towers', 'Ocean currents', 'Airplane routes'], correctIndex: 0 },
      { question: 'How do scientists track migration routes?', options: ['Satellite photos only', 'Tiny transmitters on leg bands', 'Counting nests', 'Interviewing birdwatchers'], correctIndex: 1 },
      { question: 'How long did one songbird fly nonstop over ocean?', options: ['Eight hours', 'Twenty hours', 'More than eighty hours', 'One week'], correctIndex: 2 },
    ],
  },
  {
    id: 'the-wheel',
    text: 'The wheel is often called one of the most important inventions in human history, yet it appeared surprisingly late compared to other tools. Early humans had already developed agriculture, pottery, and woven cloth before anyone built a wheel. Historians believe the wheel was first used for pottery-making, spinning clay so a potter could shape it evenly, and only later adapted for transportation. Building a working wheel and axle actually requires precise, matched parts, which is harder to achieve than it might seem, especially without metal tools.',
    questions: [
      { question: 'What was the wheel possibly first used for?', options: ['Transportation', 'Pottery-making', 'Grinding grain', 'Building houses'], correctIndex: 1 },
      { question: 'What had humans developed before the wheel?', options: ['Agriculture and pottery', 'Electricity', 'Writing systems only', 'Metal armor'], correctIndex: 0 },
      { question: 'Why is building a working wheel harder than it seems?', options: ['It needs precise matched parts', 'It requires rare wood', 'It must be very large', 'It needs no tools at all'], correctIndex: 0 },
    ],
  },
  {
    id: 'rainstorm',
    text: 'The storm arrived faster than the forecast had predicted, with wind gusts strong enough to rattle windows and strip leaves from the trees. Within minutes, rain was falling so heavily that the street outside became a shallow, moving river. Streetlights flickered but held. Most people stayed indoors, watching from doorways as gutters overflowed and small branches skittered across the pavement. By the time the worst of it passed, barely forty minutes had gone by, though the cleanup afterward took the rest of the afternoon.',
    questions: [
      { question: 'How did the storm compare to the forecast?', options: ['It arrived late', 'It arrived faster than predicted', 'It never arrived', 'It matched exactly'], correctIndex: 1 },
      { question: 'What happened to the street during the storm?', options: ['It flooded like a shallow river', 'It stayed completely dry', 'It froze', 'It cracked open'], correctIndex: 0 },
      { question: 'About how long did the worst of the storm last?', options: ['Ten minutes', 'Forty minutes', 'Three hours', 'All day'], correctIndex: 1 },
    ],
  },
  {
    id: 'gardening',
    text: 'Starting a vegetable garden from seed takes patience, since most seeds need consistent moisture and warmth before they will sprout at all. Some gardeners begin seeds indoors under grow lights weeks before the outdoor growing season starts, giving young plants a head start. Soil quality matters as much as sunlight; compacted or nutrient-poor soil can stunt even a healthy seedling. Many first-time gardeners are surprised by how much thinning is required, pulling out perfectly healthy young plants simply because they were planted too close together to grow to full size.',
    questions: [
      { question: 'What do most seeds need to sprout?', options: ['Darkness and cold', 'Consistent moisture and warmth', 'Only sunlight', 'Frequent repotting'], correctIndex: 1 },
      { question: 'Why do some gardeners start seeds indoors?', options: ['To avoid pests', 'To give plants a head start', 'Because outdoor soil is unsafe', 'To save money'], correctIndex: 1 },
      { question: 'Why are new gardeners often surprised by thinning?', options: ['It kills all the plants', "It means pulling healthy plants", 'It is unnecessary', 'It only applies to flowers'], correctIndex: 1 },
    ],
  },
  {
    id: 'lighthouses',
    text: 'Before radio and satellite navigation, lighthouses were often the only warning a ship had that land or rocks were near. Keepers lived on site, sometimes for months at a stretch, tending the lamp and making sure it never went dark. Each lighthouse used a distinct pattern of flashes so sailors could identify exactly which one they were seeing and calculate their position from a chart. Many lighthouses have since been automated, and the keepers who once lived in them are largely gone, though the towers themselves still stand along many coastlines today.',
    questions: [
      { question: 'What warned ships about land before modern navigation?', options: ['Radio towers', 'Lighthouses', 'Weather balloons', 'Buoys with bells only'], correctIndex: 1 },
      { question: "What made each lighthouse's signal identifiable?", options: ['Its height', 'A distinct flash pattern', 'Its sound', 'Its location on a map only'], correctIndex: 1 },
      { question: 'What has happened to many lighthouses today?', options: ['They were torn down', 'They have been automated', 'They became museums only', 'They stopped working entirely'], correctIndex: 1 },
    ],
  },
  {
    id: 'sleep-cycles',
    text: 'A full night of sleep is made up of several repeating cycles, each lasting roughly ninety minutes and moving through different stages, from light sleep down into deep sleep and back up into a stage where dreaming is most common. Waking up in the middle of a deep-sleep stage tends to leave people feeling groggy, even after plenty of total sleep, while waking near the end of a cycle usually feels easier. This is part of why the same number of hours can feel very different depending on exactly when someone wakes up.',
    questions: [
      { question: 'About how long does one sleep cycle last?', options: ['Thirty minutes', 'Ninety minutes', 'Four hours', 'All night'], correctIndex: 1 },
      { question: 'When does waking up tend to feel groggy?', options: ['During deep sleep', 'At the very start of sleep', 'During dreaming only', 'It never varies'], correctIndex: 0 },
      { question: 'Why can the same number of hours feel different?', options: ['Room temperature', 'When in the cycle someone wakes', 'What they ate', 'Time of year'], correctIndex: 1 },
    ],
  },
];
