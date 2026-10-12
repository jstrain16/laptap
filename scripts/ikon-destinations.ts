/**
 * The question set for the default pool, in difficulty order: most famous
 * first, so round 1 draws from the top of this list and round 5 from the
 * bottom. The order is a curated judgement of how well known each place is —
 * to non-skiers at the top, to nobody outside its region at the bottom — and
 * it is the one thing in this file worth arguing about. Reorder freely.
 *
 * `osm` is the first 8 characters of the destination's OpenSkiMap id, which is
 * where the coordinates come from. Short prefixes keep the list readable; the
 * ETL fails if one matches zero or more than one ski area. Resolving by id
 * rather than by name is deliberate — fuzzy name matching quietly mapped
 * Tremblant to a cross-country centre and three Japanese resorts to the same
 * wrong hill.
 *
 * Pins are summits — the top station of each area's highest lift — not the
 * village below. `at` overrides that for the few places OpenSkiMap maps as one
 * linked area but the list treats as two: Zermatt and Cervinia share a lift
 * system whose highest top, the Klein Matterhorn, sits right on the border.
 */
export interface IkonDestination {
  /** The name as the player sees it. */
  name: string;
  /** 8-char OpenSkiMap id prefix. */
  osm: string;
  /** Expected ISO country, asserted against OpenSkiMap during the build. */
  cc: string;
  /** [lat, lng] to use instead of the OpenSkiMap geometry. */
  at?: [number, number];
  /**
   * One line a player sees after guessing. Written from general knowledge of
   * the resorts and kept to well-known, checkable claims; edit freely.
   */
  fact?: string;
}

export const IKON_DESTINATIONS: IkonDestination[] = [
  // --- Household names, even to non-skiers --------------------------------
  { name: 'Aspen Snowmass', osm: 'ab35349b', cc: 'US', fact: 'Four mountains on one ticket; Snowmass alone drops 4,406 ft, the most vertical in the US.' },
  { name: 'Jackson Hole', osm: '2b812055', cc: 'US', fact: 'Home of Corbet\'s Couloir, and a tram that climbs 4,139 ft in nine minutes.' },
  // Gornergrat — Zermatt's own summit, on the Swiss side of a lift system it
  // shares with Cervinia across the border.
  { name: 'Zermatt', osm: '10811e37', cc: 'CH', at: [45.9836, 7.7853], fact: 'A car-free village under the Matterhorn; Europe\'s highest lift tops out at 3,883 m.' },
  { name: 'Chamonix', osm: 'c2fba992', cc: 'FR', fact: 'Hosted the very first Winter Olympics, in 1924, under Mont Blanc.' },
  { name: 'St. Moritz', osm: 'f9beaf4e', cc: 'CH', fact: 'Hosted the Winter Olympics twice (1928 and 1948) and claims to have invented winter tourism in 1864.' },
  { name: 'Deer Valley', osm: 'b7a20021', cc: 'US', fact: 'Skiers only: snowboards have been banned since it opened in 1981.' },
  { name: 'Palisades Tahoe', osm: 'fa7bea0b', cc: 'US', fact: 'Hosted the 1960 Winter Olympics as Squaw Valley; renamed in 2021.' },
  { name: 'Mammoth', osm: 'ba4944ec', cc: 'US', fact: 'One of the longest seasons in North America, regularly skiing into June and occasionally August.' },
  { name: 'Steamboat', osm: '1b452491', cc: 'US', fact: 'Trademarked the phrase \'Champagne Powder\' for its famously light, dry snow.' },
  { name: 'Big Sky', osm: 'd4086b2e', cc: 'US', fact: 'The Lone Peak tram tops out at 11,166 ft; 5,850 acres makes it one of the biggest in America.' },
  { name: 'Alta', osm: '80b43d73', cc: 'US', fact: 'Skiers only since 1938, and averages over 500 inches of snow a year.' },
  { name: 'Snowbird', osm: '3c02f219', cc: 'US', fact: 'The Aerial Tram rises 2,900 ft to Hidden Peak, and the season often runs into May.' },
  // Bald Mountain, not the Dollar Mountain beginner hill next door.
  { name: 'Sun Valley', osm: 'b9ec1edd', cc: 'US', fact: 'America\'s first destination ski resort (1936), and home of the world\'s first chairlift.' },
  { name: 'Kitzbühel', osm: '1eeb56a8', cc: 'AT', fact: 'Hosts the Hahnenkamm, the most feared downhill race on the World Cup.' },
  { name: 'Lake Louise', osm: 'c6d20c50', cc: 'CA', fact: 'Sits inside Banff National Park, Canada\'s oldest national park.' },
  { name: 'Niseko United', osm: '7467b4b9', cc: 'JP', fact: 'Around 15 metres of snow a year, blown in from Siberia across the Sea of Japan.' },
  { name: 'Killington', osm: 'ac774efd', cc: 'US', fact: '\'The Beast of the East\': six peaks and the longest season on the East Coast.' },
  { name: 'Banff Sunshine', osm: '7df6d649', cc: 'CA', fact: 'Straddles the Continental Divide, so you can ski from Alberta into British Columbia.' },
  { name: 'Tremblant', osm: 'b7cad93e', cc: 'CA', fact: 'Opened in 1939 and is the biggest ski area in eastern Canada.' },
  // Twelve valleys; anchored on Alta Badia, the largest.
  { name: 'Dolomiti Superski', osm: '04d84a37', cc: 'IT', fact: 'Twelve ski areas and 1,200 km of runs in a UNESCO World Heritage mountain range.' },

  // --- Well known to anyone who skis --------------------------------------
  { name: 'Copper Mountain', osm: '0bab3102', cc: 'US', fact: 'The terrain sorts itself naturally: easiest runs on the west side, hardest on the east.' },
  { name: 'Winter Park', osm: 'eac3283b', cc: 'US', fact: 'Owned by the City of Denver, and reachable on the Winter Park Express ski train.' },
  { name: 'Revelstoke', osm: 'f2df72ab', cc: 'CA', fact: 'North America\'s biggest lift-served vertical: 5,620 ft.' },
  { name: 'Taos', osm: '8faa21d5', cc: 'US', fact: 'Skiers-only for decades; snowboarders were finally allowed in 2008.' },
  { name: 'Arapahoe Basin', osm: '1e281ff3', cc: 'US', fact: '\'The Legend\': one of the highest ski areas in the US, with lifts above 13,000 ft.' },
  { name: 'Brighton', osm: 'ab2b5807', cc: 'US', fact: 'Utah\'s oldest ski resort, started in 1936 with a rope tow made from an old elevator cable.' },
  { name: 'Solitude', osm: 'b40e9251', cc: 'US', fact: 'Big Cottonwood Canyon\'s quieter mountain, with over 500 inches of snow a year.' },
  { name: 'Snowbasin', osm: '423504a1', cc: 'US', fact: 'Hosted the downhill and super-G races at the 2002 Winter Olympics.' },
  { name: 'Sugarloaf', osm: 'ba6f009c', cc: 'US', fact: 'The only lift-served above-treeline skiing in the East, on Maine\'s second-highest peak.' },
  { name: 'Sunday River', osm: '54bceeb6', cc: 'US', fact: 'Eight interconnected peaks across three miles of western Maine.' },
  { name: 'Stratton', osm: '856ac5fd', cc: 'US', fact: 'Where Jake Burton tested his boards; in 1983 it became the first major resort to allow snowboarding.' },
  { name: 'Sugarbush', osm: '51088afb', cc: 'US', fact: 'Two mountains, Lincoln Peak and Mount Ellen, joined by the two-mile Slide Brook Express.' },
  { name: 'Crystal Mountain', osm: '89f555b5', cc: 'US', fact: 'Washington\'s largest ski area, with Mount Rainier filling the view from the top.' },
  { name: 'Mt. Bachelor', osm: 'df0ebcea', cc: 'US', fact: 'A volcano: you can ski 360 degrees around the summit cone.' },
  { name: 'Big Bear Mountain Resort', osm: '78bac123', cc: 'US', fact: 'Two mountains, Bear Mountain and Snow Summit, two hours from Los Angeles.' },
  { name: 'Courmayeur', osm: 'f93e7406', cc: 'IT', fact: 'The Italian side of Mont Blanc, linked to Chamonix by a tunnel through the mountain.' },
  // Testa Grigia / Plateau Rosa, the Italian top of the same system.
  { name: 'Cervinia', osm: '10811e37', cc: 'IT', at: [45.9345, 7.7076], fact: 'Shares the Matterhorn\'s lifts with Zermatt; the Swiss border runs across the top.' },
  // Ten linked areas; anchored on Happo-One, the flagship.
  { name: 'Hakuba Valley', osm: '2badaaea', cc: 'JP', fact: 'Ten resorts in the Japanese Alps; hosted the alpine events of the 1998 Nagano Olympics.' },
  { name: 'Thredbo', osm: 'd02b7dc1', cc: 'AU', fact: 'Home to Australia\'s longest ski runs, inside Kosciuszko National Park.' },
  { name: 'Snowshoe', osm: '1facaf3d', cc: 'US', fact: 'An upside-down mountain: the village sits on top and you ski down to the lifts.' },
  { name: 'Red Mountain', osm: 'd43bd0f1', cc: 'CA', fact: 'Skied since 1897, and in 2016 it sold shares in itself to the public.' },
  { name: 'Schweitzer', osm: '13b3d7f0', cc: 'US', fact: 'Idaho\'s largest ski area, looking out over Lake Pend Oreille.' },
  { name: 'Grandvalira', osm: 'de4f884c', cc: 'AD', fact: 'The biggest resort in the Pyrenees, with 210 km of runs across Andorra.' },
  { name: 'Valle Nevado', osm: '5599f5c5', cc: 'CL', fact: 'The largest ski area in South America, 46 km from Santiago; the season is July and August.' },
  // Both above Queenstown; anchored on Coronet Peak.
  { name: 'Coronet Peak / The Remarkables', osm: '8d51d2e1', cc: 'NZ', fact: 'Queenstown\'s two mountains; the Remarkables stood in for Middle-earth in The Lord of the Rings.' },
  { name: 'Loon', osm: '84db6675', cc: 'US', fact: 'New Hampshire\'s busiest mountain, two hours from Boston.' },
  { name: 'June Mountain', osm: '1f94daed', cc: 'US', fact: 'Mammoth\'s quieter sister, twenty minutes up the road.' },
  { name: 'Windham', osm: '9f11458d', cc: 'US', fact: 'In the Catskills, two and a half hours from New York City.' },

  // --- Regional reputations -----------------------------------------------
  { name: 'Mt. Norquay', osm: 'aedc10b0', cc: 'CA', fact: 'Banff\'s local hill since 1926, and home of Canada\'s first chairlift (1948).' },
  { name: 'Sun Peaks', osm: '9f1d7996', cc: 'CA', fact: 'Canada\'s second-largest ski area; Olympic champion Nancy Greene is its director of skiing.' },
  { name: 'Panorama', osm: '7f0f9748', cc: 'CA', fact: 'One of Canada\'s biggest verticals, 4,265 ft, in the Purcell Mountains.' },
  { name: 'SilverStar', osm: 'ca99961a', cc: 'CA', fact: 'A Victorian-style village painted in bright colours, above Vernon, BC.' },
  { name: 'Eldora', osm: '1f25a1ea', cc: 'US', fact: 'Boulder\'s local hill, 21 miles from town and served by a public bus.' },
  { name: 'Summit at Snoqualmie', osm: '25267c40', cc: 'US', fact: 'Four ski areas on one pass, less than an hour from Seattle.' },
  { name: 'Alpental', osm: '2a705bd1', cc: 'US', fact: 'The steep, expert side of Snoqualmie Pass.' },
  { name: 'Mt. Buller', osm: 'fa088740', cc: 'AU', fact: 'Three hours from Melbourne, the closest major resort to a big Australian city.' },
  { name: 'Mt. Hutt', osm: '560383c6', cc: 'NZ', fact: 'One of the longest seasons in the Southern Hemisphere, an hour from Christchurch.' },
  { name: 'Cypress Mountain', osm: '7599cb6e', cc: 'CA', fact: 'Hosted the freestyle skiing and snowboarding at the 2010 Vancouver Olympics.' },
  { name: 'Blue Mountain (Ontario)', osm: 'c5f70b63', cc: 'CA', fact: 'Ontario\'s biggest resort, on the Niagara Escarpment above Georgian Bay.' },
  { name: 'Pico', osm: '5263141e', cc: 'US', fact: 'Opened in 1937, and its 1940 T-bar was the first in America.' },
  { name: 'Boyne Mountain', osm: '449aa402', cc: 'US', fact: 'Michigan\'s first chairlift, bought second-hand from Sun Valley in 1948.' },
  { name: 'The Highlands', osm: 'd70a38ef', cc: 'US', fact: 'Formerly Boyne Highlands, in the lake-effect snowbelt of northern Michigan.' },
  { name: 'Camelback', osm: 'f34b05b6', cc: 'US', fact: 'In the Poconos, 90 minutes from New York, with a water park at the base.' },
  { name: 'Blue Mountain (PA)', osm: '4bca16dc', cc: 'US', fact: 'Pennsylvania\'s biggest vertical drop, 1,082 ft.' },
  { name: 'Lee Canyon', osm: '96ac5982', cc: 'US', fact: 'A ski area 45 minutes from the Las Vegas Strip.' },
  { name: 'Jiminy Peak', osm: 'c72edda7', cc: 'US', fact: 'The first ski resort in North America to power itself with its own wind turbine.' },
  { name: 'Lotte Arai', osm: '9d8adf25', cc: 'JP', fact: 'Reopened in 2017 after a decade shut; famous for deep Niigata powder.' },
  { name: 'Monterosa (Champoluc)', osm: '5ffd86e2', cc: 'IT', fact: 'Three valleys linked beneath Monte Rosa, the Alps\' second-highest massif.' },
  { name: 'Pila', osm: '80f1b9fb', cc: 'IT', fact: 'Reached by gondola straight up from the city of Aosta.' },
  { name: 'La Thuile', osm: '064c2584', cc: 'IT', fact: 'Linked across the French border with La Rosière.' },

  // --- Least known nationally ---------------------------------------------
  { name: 'Lutsen Mountains', osm: '952dd748', cc: 'US', fact: 'The Midwest\'s biggest ski area, on the north shore of Lake Superior.' },
  { name: 'Granite Peak', osm: '462af608', cc: 'US', fact: 'Wisconsin\'s biggest vertical, on Rib Mountain, a state park near Wausau.' },
  { name: 'Snowriver', osm: 'f2b439be', cc: 'US', fact: 'Two former rivals, Blackjack and Indianhead, now one resort in Michigan\'s Upper Peninsula.' },
];
