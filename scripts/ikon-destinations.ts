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
 * `at` overrides the pin for the few places OpenSkiMap maps as one linked area
 * but the list treats as two: Zermatt and Cervinia share a lift system across
 * the Swiss–Italian border, and the shared area's centroid sits in Italy.
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
}

export const IKON_DESTINATIONS: IkonDestination[] = [
  // --- Household names, even to non-skiers --------------------------------
  { name: 'Aspen Snowmass', osm: 'ab35349b', cc: 'US' },
  { name: 'Jackson Hole', osm: '2b812055', cc: 'US' },
  { name: 'Zermatt', osm: '10811e37', cc: 'CH', at: [46.0207, 7.7491] },
  { name: 'Chamonix', osm: 'c2fba992', cc: 'FR' },
  { name: 'St. Moritz', osm: 'f9beaf4e', cc: 'CH' },
  { name: 'Deer Valley', osm: 'b7a20021', cc: 'US' },
  { name: 'Palisades Tahoe', osm: 'fa7bea0b', cc: 'US' },
  { name: 'Mammoth', osm: 'ba4944ec', cc: 'US' },
  { name: 'Steamboat', osm: '1b452491', cc: 'US' },
  { name: 'Big Sky', osm: '52fb26d3', cc: 'US' },
  { name: 'Alta', osm: '80b43d73', cc: 'US' },
  { name: 'Snowbird', osm: '3c02f219', cc: 'US' },
  // Bald Mountain, not the Dollar Mountain beginner hill next door.
  { name: 'Sun Valley', osm: 'b9ec1edd', cc: 'US' },
  { name: 'Kitzbühel', osm: '1eeb56a8', cc: 'AT' },
  { name: 'Lake Louise', osm: 'c6d20c50', cc: 'CA' },
  { name: 'Niseko United', osm: '7467b4b9', cc: 'JP' },
  { name: 'Killington', osm: 'ac774efd', cc: 'US' },
  { name: 'Banff Sunshine', osm: '7df6d649', cc: 'CA' },
  { name: 'Tremblant', osm: 'b7cad93e', cc: 'CA' },
  // Twelve valleys; anchored on Alta Badia, the largest.
  { name: 'Dolomiti Superski', osm: '04d84a37', cc: 'IT' },

  // --- Well known to anyone who skis --------------------------------------
  { name: 'Copper Mountain', osm: '0bab3102', cc: 'US' },
  { name: 'Winter Park', osm: 'eac3283b', cc: 'US' },
  { name: 'Revelstoke', osm: 'f2df72ab', cc: 'CA' },
  { name: 'Taos', osm: '8faa21d5', cc: 'US' },
  { name: 'Arapahoe Basin', osm: '1e281ff3', cc: 'US' },
  { name: 'Brighton', osm: 'ab2b5807', cc: 'US' },
  { name: 'Solitude', osm: 'b40e9251', cc: 'US' },
  { name: 'Snowbasin', osm: '423504a1', cc: 'US' },
  { name: 'Sugarloaf', osm: 'ba6f009c', cc: 'US' },
  { name: 'Sunday River', osm: '54bceeb6', cc: 'US' },
  { name: 'Stratton', osm: '856ac5fd', cc: 'US' },
  { name: 'Sugarbush', osm: '51088afb', cc: 'US' },
  { name: 'Crystal Mountain', osm: '89f555b5', cc: 'US' },
  { name: 'Mt. Bachelor', osm: 'df0ebcea', cc: 'US' },
  { name: 'Big Bear Mountain Resort', osm: '78bac123', cc: 'US' },
  { name: 'Courmayeur', osm: 'f93e7406', cc: 'IT' },
  { name: 'Cervinia', osm: '10811e37', cc: 'IT', at: [45.9344, 7.6305] },
  // Ten linked areas; anchored on Happo-One, the flagship.
  { name: 'Hakuba Valley', osm: '2badaaea', cc: 'JP' },
  { name: 'Thredbo', osm: 'd02b7dc1', cc: 'AU' },
  { name: 'Snowshoe', osm: '1facaf3d', cc: 'US' },
  { name: 'Red Mountain', osm: 'd43bd0f1', cc: 'CA' },
  { name: 'Schweitzer', osm: '13b3d7f0', cc: 'US' },
  { name: 'Grandvalira', osm: 'de4f884c', cc: 'AD' },
  { name: 'Valle Nevado', osm: '5599f5c5', cc: 'CL' },
  // Both above Queenstown; anchored on Coronet Peak.
  { name: 'Coronet Peak / The Remarkables', osm: '8d51d2e1', cc: 'NZ' },
  { name: 'Loon', osm: '84db6675', cc: 'US' },
  { name: 'June Mountain', osm: '1f94daed', cc: 'US' },
  { name: 'Windham', osm: '9f11458d', cc: 'US' },

  // --- Regional reputations -----------------------------------------------
  { name: 'Mt. Norquay', osm: 'aedc10b0', cc: 'CA' },
  { name: 'Sun Peaks', osm: '9f1d7996', cc: 'CA' },
  { name: 'Panorama', osm: '7f0f9748', cc: 'CA' },
  { name: 'SilverStar', osm: 'ca99961a', cc: 'CA' },
  { name: 'Eldora', osm: '1f25a1ea', cc: 'US' },
  { name: 'Summit at Snoqualmie', osm: '25267c40', cc: 'US' },
  { name: 'Alpental', osm: '2a705bd1', cc: 'US' },
  { name: 'Mt. Buller', osm: 'fa088740', cc: 'AU' },
  { name: 'Mt. Hutt', osm: '560383c6', cc: 'NZ' },
  { name: 'Cypress Mountain', osm: '7599cb6e', cc: 'CA' },
  { name: 'Blue Mountain (Ontario)', osm: 'f39fc770', cc: 'CA' },
  { name: 'Pico', osm: '5263141e', cc: 'US' },
  { name: 'Boyne Mountain', osm: '449aa402', cc: 'US' },
  { name: 'The Highlands', osm: 'd70a38ef', cc: 'US' },
  { name: 'Camelback', osm: 'f34b05b6', cc: 'US' },
  { name: 'Blue Mountain (PA)', osm: '4bca16dc', cc: 'US' },
  { name: 'Lee Canyon', osm: '96ac5982', cc: 'US' },
  { name: 'Jiminy Peak', osm: 'c72edda7', cc: 'US' },
  { name: 'Lotte Arai', osm: '9d8adf25', cc: 'JP' },
  { name: 'Monterosa (Champoluc)', osm: '5ffd86e2', cc: 'IT' },
  { name: 'Pila', osm: '80f1b9fb', cc: 'IT' },
  { name: 'La Thuile', osm: '064c2584', cc: 'IT' },

  // --- Least known nationally ---------------------------------------------
  { name: 'Lutsen Mountains', osm: '952dd748', cc: 'US' },
  { name: 'Granite Peak', osm: '462af608', cc: 'US' },
  { name: 'Snowriver', osm: 'f2b439be', cc: 'US' },
];
