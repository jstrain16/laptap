/**
 * The Epic Pass question set, in difficulty order: most famous first, so
 * round 1 draws from the top of this list and round 5 from the bottom. Same
 * conventions as ikon-destinations.ts — `osm` is an 8-char OpenSkiMap id
 * prefix, `cc` the expected country, and the order is the one thing worth
 * arguing about.
 */
import type { IkonDestination } from './ikon-destinations.ts';

export const EPIC_DESTINATIONS: IkonDestination[] = [
  // --- Household names ----------------------------------------------------
  { name: 'Vail', osm: '88a22ba2', cc: 'US', fact: 'Seven legendary Back Bowls and 5,317 acres, among the largest in the US.' },
  { name: 'Whistler Blackcomb', osm: '5b0f5970', cc: 'CA', fact: 'North America\'s biggest resort; the Peak 2 Peak gondola\'s unsupported span is 3 km.' },
  { name: 'Breckenridge', osm: 'e1eb4ed2', cc: 'US', fact: 'Its Imperial Express is the highest chairlift in North America, at 12,840 ft.' },
  { name: 'Park City', osm: '3dad9d62', cc: 'US', fact: 'The biggest ski resort in the US, 7,300 acres, since Park City and Canyons were joined in 2015.' },
  { name: 'Beaver Creek', osm: '7017f6ef', cc: 'US', fact: 'Famous for the warm chocolate-chip cookies handed out at the base every afternoon at 3 pm.' },
  { name: 'Courchevel (Les 3 Vallées)', osm: '23365b5c', cc: 'FR', fact: 'Part of Les 3 Vallées, the largest linked ski area in the world, with 600 km of runs.' },
  // The whole 4 Vallées; its summit, Mont Fort, is Verbier's.
  { name: 'Verbier', osm: 'fa9477e2', cc: 'CH', fact: 'Home of the Xtreme Verbier, the Freeride World Tour final, on the Bec des Rosses.' },
  { name: 'St. Anton (Ski Arlberg)', osm: '66e67247', cc: 'AT', fact: 'The \'cradle of alpine skiing\': the world\'s first ski club was founded here in 1901.' },
  { name: 'Telluride', osm: 'c036edc5', cc: 'US', fact: 'In a box canyon in the San Juans, with a free gondola between the town and Mountain Village.' },
  { name: 'Heavenly', osm: '3f61859b', cc: 'US', fact: 'Straddles California and Nevada, with Lake Tahoe filling the view from 10,000 ft.' },
  { name: 'Stowe', osm: '1688ce1f', cc: 'US', fact: 'Beneath Mount Mansfield, Vermont\'s highest peak, and the East\'s ski capital since the 1930s.' },
  { name: 'Keystone', osm: '7d855b81', cc: 'US', fact: 'The largest night-skiing operation in Colorado.' },
  { name: 'Crested Butte', osm: 'c7ba4496', cc: 'US', fact: 'Some of the steepest lift-served terrain in the US, above a Victorian mining town.' },
  // Anchored on Val Thorens, the highest of the three.
  { name: 'Méribel / Val Thorens (Les 3 Vallées)', osm: 'b66cd0bd', cc: 'FR', fact: 'Val Thorens is the highest resort in Europe, at 2,300 m.' },
  { name: 'Lech Zürs (Ski Arlberg)', osm: 'c5107fc2', cc: 'AT', fact: 'Part of Ski Arlberg, Austria\'s largest connected ski area, and a longtime royal favourite.' },

  // --- Well known to anyone who skis --------------------------------------
  { name: 'Northstar', osm: '717fe0e8', cc: 'US', fact: 'A mid-mountain village near Truckee, on Lake Tahoe\'s north shore.' },
  { name: 'Kirkwood', osm: '718db266', cc: 'US', fact: 'Tahoe\'s snowiest resort, often topping 600 inches a year.' },
  // Ten linked areas; anchored on Happo-One, the flagship.
  { name: 'Hakuba Valley', osm: '2badaaea', cc: 'JP', fact: 'Ten resorts in the Japanese Alps; hosted the alpine events of the 1998 Nagano Olympics.' },
  { name: 'Rusutsu', osm: '24ee5141', cc: 'JP', fact: 'Three peaks of tree-skiing powder 90 minutes from Sapporo, with an amusement park in summer.' },
  { name: 'Okemo', osm: 'f6908eab', cc: 'US', fact: 'Famous for its grooming: some of the most manicured corduroy in the East.' },
  { name: 'Mount Snow', osm: '74dd4473', cc: 'US', fact: 'Home to Carinthia, an entire mountain face given over to terrain parks.' },
  { name: 'Fernie', osm: 'ecea3ea3', cc: 'CA', fact: 'Five alpine bowls and some of the deepest snow in the Canadian Rockies, about 9 m a year.' },
  { name: 'Kicking Horse', osm: '64e116da', cc: 'CA', fact: 'Canada\'s second-biggest vertical, 4,133 ft, and the self-styled \'Champagne Powder Capital of Canada\'.' },
  { name: 'Perisher', osm: '562a20a6', cc: 'AU', fact: 'The largest ski resort in the Southern Hemisphere, in the Snowy Mountains.' },
  { name: 'Madonna di Campiglio (Skirama Dolomiti)', osm: 'fd830ae8', cc: 'IT', fact: '\'The Pearl of the Dolomites\', a favourite of Empress Sisi of Austria in the 1800s.' },
  { name: 'Mayrhofen (Zillertal)', osm: '0e7ba1fd', cc: 'AT', fact: 'Home of the Harakiri, Austria\'s steepest groomed run at 78 percent.' },
  { name: 'Crans-Montana', osm: '7764d597', cc: 'CH', fact: 'On a sunny plateau above the Rhône valley, famous for its views and its golf course.' },
  // Andermatt+Sedrun+Disentis; its summit, the Gemsstock, is Andermatt's.
  { name: 'Andermatt', osm: 'eeb2093c', cc: 'CH', fact: 'Linked over the Oberalp Pass to Sedrun and Disentis, the biggest ski area in central Switzerland.' },
  { name: 'Stevens Pass', osm: '53a4f73e', cc: 'US', fact: 'Sits right on the Pacific Crest Trail, 80 miles east of Seattle.' },
  { name: 'Hunter Mountain', osm: '0220b917', cc: 'US', fact: '\'The snowmaking capital of the world\', a pioneer of man-made snow in the 1960s.' },
  { name: 'Hintertux Glacier', osm: 'fd250230', cc: 'AT', fact: 'Austria\'s only ski area open 365 days a year.' },

  // --- Regional reputations -----------------------------------------------
  { name: 'Mont Sainte-Anne', osm: '3785c88c', cc: 'CA', fact: 'Overlooks the St. Lawrence River near Québec City, and has hosted World Cup races.' },
  { name: 'Seven Springs', osm: '58ebc983', cc: 'US', fact: 'Pennsylvania\'s largest resort, in the Laurel Highlands.' },
  { name: 'Attitash', osm: '513237f9', cc: 'US', fact: 'In New Hampshire\'s White Mountains; its second mountain, Bear Peak, was added in 1994.' },
  { name: 'Wildcat', osm: '0df6f263', cc: 'US', fact: 'Faces Mount Washington across Pinkham Notch, one of the best views in the East.' },
  { name: 'Falls Creek', osm: 'a280690d', cc: 'AU', fact: 'Victoria\'s largest resort, with a ski-in ski-out village in the Australian Alps.' },
  { name: 'Hotham', osm: 'aea2abf2', cc: 'AU', fact: '\'The powder capital of Australia\', and one of few resorts where the village sits above the runs.' },
  { name: 'Zillertal Arena', osm: 'bbbfaa27', cc: 'AT', fact: 'The largest ski area in the Zillertal valley, with about 150 km of runs.' },
  { name: 'Mount Sunapee', osm: '8107ea0d', cc: 'US', fact: 'Inside a New Hampshire state park, an hour and a half from Boston.' },
  { name: 'Kimberley', osm: '14471d68', cc: 'CA', fact: 'Canada\'s \'Bavarian City\': the town centre is styled as an Alpine village.' },
  { name: 'Nakiska', osm: '629f4173', cc: 'CA', fact: 'Built to host the alpine events of the 1988 Calgary Olympics.' },
  { name: 'Stoneham', osm: 'baa17f75', cc: 'CA', fact: 'Twenty minutes from Québec City, with night skiing on most of its runs.' },
  { name: 'Afton Alps', osm: '37f4ea45', cc: 'US', fact: 'Twenty miles from Minneapolis, on the bluffs of the St. Croix River.' },
  { name: 'Whitetail', osm: '97655053', cc: 'US', fact: 'Ninety minutes from Washington, DC, on Pennsylvania\'s South Mountain.' },
  { name: 'Liberty', osm: '6fab99ca', cc: 'US', fact: 'Near Gettysburg, Pennsylvania, an hour from Baltimore.' },
  { name: 'Hochzillertal-Hochfügen', osm: '99cef648', cc: 'AT', fact: 'A linked ski area above Kaltenbach in Austria\'s Zillertal.' },
  { name: 'Spieljoch', osm: '69931ad5', cc: 'AT', fact: 'The first ski area in the Zillertal as you drive up from the Inn valley, above Fügen.' },

  // --- Least known nationally ---------------------------------------------
  { name: 'Jack Frost', osm: '4fbb6591', cc: 'US', fact: 'In the Poconos, and shares a ticket with Big Boulder across the valley.' },
  { name: 'Big Boulder', osm: 'd80406be', cc: 'US', fact: 'Pennsylvania\'s first commercial ski area (1947), and one of the first anywhere to make snow.' },
  { name: 'Roundtop', osm: '67139981', cc: 'US', fact: 'Near Harrisburg, Pennsylvania, with snow tubing and paintball in the off-season.' },
  { name: 'Hidden Valley (PA)', osm: '04a5001a', cc: 'US', fact: 'In the Laurel Highlands, a few miles from Seven Springs.' },
  { name: 'Laurel Mountain', osm: 'c4e2d22a', cc: 'US', fact: 'Opened in 1939, and \'Lower Wildcat\' is the steepest run in Pennsylvania.' },
  { name: 'Crotched Mountain', osm: '414efa2c', cc: 'US', fact: 'The closest New Hampshire ski area to Boston, famous for \'Midnight Madness\' skiing until 3 am.' },
  { name: 'Mt. Brighton', osm: 'eb223379', cc: 'US', fact: 'A ski hill built on a former gravel pit outside Detroit.' },
  { name: 'Wilmot', osm: '5a1a80c1', cc: 'US', fact: 'An hour from Chicago, just over the Wisconsin line.' },
  // Epic's Alpine Valley is the Ohio one, not the larger Wisconsin resort.
  { name: 'Alpine Valley', osm: '209437aa', cc: 'US', fact: 'In Ohio\'s snowbelt east of Cleveland, fed by lake-effect snow off Lake Erie.' },
  { name: 'Boston Mills', osm: 'cd7f28de', cc: 'US', fact: 'Inside Cuyahoga Valley National Park, between Cleveland and Akron.' },
  { name: 'Brandywine', osm: 'abc97db7', cc: 'US', fact: 'Boston Mills\' twin, a few minutes away in the Cuyahoga Valley.' },
  { name: 'Mad River Mountain', osm: '305c84e4', cc: 'US', fact: 'Ohio\'s largest ski area, an hour from Columbus.' },
  { name: 'Paoli Peaks', osm: 'a3712cf8', cc: 'US', fact: 'Southern Indiana\'s ski hill, an hour from Louisville, Kentucky.' },
  { name: 'Hidden Valley (MO)', osm: '05913b1b', cc: 'US', fact: 'Thirty minutes from St. Louis. Yes, Missouri has skiing.' },
  { name: 'Snow Creek', osm: '88471079', cc: 'US', fact: 'Missouri\'s other ski area, thirty minutes north of Kansas City.' },
];
