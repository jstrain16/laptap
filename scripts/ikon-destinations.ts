/**
 * The Ikon Pass destination list, transcribed from ikonpass.com/en/destinations
 * for the 2025/26 season (checked 2026-10-01).
 *
 * `osm` is the first 8 characters of the destination's OpenSkiMap id. Short
 * prefixes keep the list readable; the ETL fails if one matches zero or more
 * than one ski area, so a bad prefix can't slip through. Resolving by id rather
 * than by name is deliberate — fuzzy name matching quietly mapped Tremblant to
 * a cross-country centre and three Japanese resorts to the same wrong hill.
 *
 * Several Ikon entries are groups of mountains rather than single areas. A
 * geography game needs one pin, so each is anchored to its best-known mountain,
 * noted below.
 */
export interface IkonDestination {
  /** The name as Ikon writes it — this is what the player is asked to find. */
  name: string;
  /** 8-char OpenSkiMap id prefix. */
  osm: string;
  /** Expected ISO country, asserted against OpenSkiMap during the build. */
  cc: string;
}

export const IKON_DESTINATIONS: IkonDestination[] = [
  // --- United States ------------------------------------------------------
  { name: 'Jackson Hole Mountain Resort', osm: '2b812055', cc: 'US' },
  { name: 'Winter Park Resort', osm: 'eac3283b', cc: 'US' },
  { name: 'Taos Ski Valley', osm: '8faa21d5', cc: 'US' },
  { name: 'Steamboat', osm: '1b452491', cc: 'US' },
  { name: 'Deer Valley Resort', osm: 'b7a20021', cc: 'US' },
  // Four mountains; anchored on Snowmass, the largest.
  { name: 'Aspen Snowmass', osm: 'ab35349b', cc: 'US' },
  { name: 'Copper Mountain', osm: '0bab3102', cc: 'US' },
  { name: 'Eldora Mountain Resort', osm: '1f25a1ea', cc: 'US' },
  { name: 'Alta Ski Area', osm: '80b43d73', cc: 'US' },
  { name: 'Solitude Mountain Resort', osm: 'b40e9251', cc: 'US' },
  { name: 'Snowbasin', osm: '423504a1', cc: 'US' },
  { name: 'Big Sky Resort', osm: '52fb26d3', cc: 'US' },
  { name: 'Brighton', osm: 'ab2b5807', cc: 'US' },
  { name: 'Arapahoe Basin', osm: '1e281ff3', cc: 'US' },
  { name: 'Snowbird', osm: '3c02f219', cc: 'US' },
  { name: 'June Mountain', osm: '1f94daed', cc: 'US' },
  // Alpental / Summit West / Central / East, mapped as one area.
  { name: 'The Summit at Snoqualmie', osm: '25267c40', cc: 'US' },
  { name: 'Crystal Mountain Resort', osm: '89f555b5', cc: 'US' },
  { name: 'Schweitzer', osm: '13b3d7f0', cc: 'US' },
  { name: 'Sierra-at-Tahoe', osm: '0558a463', cc: 'US' },
  { name: 'Alyeska Resort', osm: 'bb50116e', cc: 'US' },
  // Bald Mountain, not the Dollar Mountain beginner hill next door.
  { name: 'Sun Valley', osm: 'b9ec1edd', cc: 'US' },
  { name: 'Big Bear Mountain Resort', osm: '78bac123', cc: 'US' },
  // Olympic Valley side; Alpine Meadows is a separate OpenSkiMap entry.
  { name: 'Palisades Tahoe', osm: 'fa7bea0b', cc: 'US' },
  { name: 'Snow Valley', osm: '11f2099e', cc: 'US' },
  { name: 'Mammoth Mountain', osm: 'ba4944ec', cc: 'US' },
  { name: 'Mt. Bachelor', osm: 'df0ebcea', cc: 'US' },
  { name: 'Lutsen Mountains', osm: '952dd748', cc: 'US' },
  { name: 'Sunday River', osm: '54bceeb6', cc: 'US' },
  // Blackjack + Indianhead, listed by OpenSkiMap as Jackson Creek Summit.
  { name: 'Snowriver Mountain Resort', osm: 'f2b439be', cc: 'US' },
  { name: 'Snowshoe Mountain', osm: '1facaf3d', cc: 'US' },
  // Formerly Boyne Highlands.
  { name: 'The Highlands', osm: 'd70a38ef', cc: 'US' },
  { name: 'Killington - Pico', osm: 'ac774efd', cc: 'US' },
  { name: 'Stratton', osm: '856ac5fd', cc: 'US' },
  { name: 'Blue Mountain Resort', osm: '4bca16dc', cc: 'US' },
  { name: 'Loon Mountain', osm: '84db6675', cc: 'US' },
  { name: 'Boyne Mountain', osm: '449aa402', cc: 'US' },
  { name: 'Sugarloaf', osm: 'ba6f009c', cc: 'US' },
  { name: 'Camelback Resort', osm: 'f34b05b6', cc: 'US' },
  { name: 'Sugarbush Resort', osm: '51088afb', cc: 'US' },
  { name: 'Granite Peak Resort', osm: '462af608', cc: 'US' },

  // --- Canada -------------------------------------------------------------
  { name: 'Revelstoke Mountain Resort', osm: 'f2df72ab', cc: 'CA' },
  { name: 'Blue Mountain', osm: 'f39fc770', cc: 'CA' },
  // Sunshine + Lake Louise + Norquay; anchored on Banff Sunshine Village.
  { name: 'SkiBig3', osm: '7df6d649', cc: 'CA' },
  { name: 'Sun Peaks Resort', osm: '9f1d7996', cc: 'CA' },
  { name: 'Cypress Mountain', osm: '7599cb6e', cc: 'CA' },
  { name: 'Le Massif de Charlevoix', osm: 'ef6c8dc1', cc: 'CA' },
  { name: 'RED Mountain', osm: 'd43bd0f1', cc: 'CA' },
  { name: 'SilverStar Mountain', osm: 'ca99961a', cc: 'CA' },
  { name: 'Tremblant', osm: 'b7cad93e', cc: 'CA' },
  { name: 'Panorama', osm: '7f0f9748', cc: 'CA' },

  // --- Europe -------------------------------------------------------------
  // Corviglia, the main St. Moritz area.
  { name: 'St. Moritz', osm: 'f9beaf4e', cc: 'CH' },
  // Five Aosta areas; anchored on Courmayeur.
  { name: "Valle d'Aosta", osm: 'f93e7406', cc: 'IT' },
  { name: 'Zermatt Matterhorn', osm: '10811e37', cc: 'CH' },
  { name: 'Kitzbühel', osm: '1eeb56a8', cc: 'AT' },
  // Brévent/Flégère, directly above Chamonix town.
  { name: 'Chamonix Mont-Blanc Valley', osm: 'c2fba992', cc: 'FR' },
  { name: 'Megève Ski Area', osm: '97a14ced', cc: 'FR' },
  { name: 'Ischgl', osm: '7c2f2690', cc: 'AT' },
  { name: 'Grandvalira Resorts Andorra', osm: 'de4f884c', cc: 'AD' },
  // Twelve valleys; anchored on Alta Badia, the largest.
  { name: 'Dolomiti Superski', osm: '04d84a37', cc: 'IT' },

  // --- Asia-Pacific -------------------------------------------------------
  { name: 'Coronet Peak', osm: '8d51d2e1', cc: 'NZ' },
  { name: 'The Remarkables', osm: '976d9a75', cc: 'NZ' },
  { name: 'Mt Hutt', osm: '560383c6', cc: 'NZ' },
  { name: 'Thredbo', osm: 'd02b7dc1', cc: 'AU' },
  { name: 'Mt Buller', osm: 'fa088740', cc: 'AU' },
  { name: 'Mona Yongpyong', osm: 'eeba0704', cc: 'KR' },
  { name: 'Niseko United', osm: '7467b4b9', cc: 'JP' },
  { name: 'Arai Mountain Resort', osm: '9d8adf25', cc: 'JP' },
  { name: 'Zao Onsen Ski Resort', osm: '7cfdd8cc', cc: 'JP' },
  { name: 'Nekoma Mountain', osm: 'e8cdffc4', cc: 'JP' },
  { name: 'Lake Songhua Resort', osm: 'f3baacab', cc: 'CN' },
  { name: 'Mt.T', osm: 'd7645928', cc: 'JP' },
  { name: 'APPI Resort', osm: 'a1014f93', cc: 'JP' },
  { name: 'Beidahu Ski Resort', osm: 'e1a3ef8f', cc: 'CN' },
  { name: 'Yunding Snow Park', osm: '25d31b46', cc: 'CN' },
  { name: 'Madarao Mountain Resort', osm: 'b7e060a1', cc: 'JP' },
  { name: 'Myoko Suginohara Ski Resort', osm: 'f80221da', cc: 'JP' },
  // Linked area; anchored on Yakebitaiyama, near its centre.
  { name: 'Shiga Kogen Mountain Resort', osm: '894ab14e', cc: 'JP' },
  { name: 'Furano Ski Resort', osm: 'e1974296', cc: 'JP' },

  // --- South America ------------------------------------------------------
  { name: 'Valle Nevado', osm: '5599f5c5', cc: 'CL' },
];
