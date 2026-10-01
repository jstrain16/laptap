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
  { name: 'Vail', osm: '88a22ba2', cc: 'US' },
  { name: 'Whistler Blackcomb', osm: '5b0f5970', cc: 'CA' },
  { name: 'Breckenridge', osm: 'e1eb4ed2', cc: 'US' },
  { name: 'Park City', osm: '3dad9d62', cc: 'US' },
  { name: 'Beaver Creek', osm: '7017f6ef', cc: 'US' },
  { name: 'Courchevel (Les 3 Vallées)', osm: '23365b5c', cc: 'FR' },
  // The whole 4 Vallées; its summit, Mont Fort, is Verbier's.
  { name: 'Verbier', osm: 'fa9477e2', cc: 'CH' },
  { name: 'St. Anton (Ski Arlberg)', osm: '66e67247', cc: 'AT' },
  { name: 'Telluride', osm: 'c036edc5', cc: 'US' },
  { name: 'Heavenly', osm: '3f61859b', cc: 'US' },
  { name: 'Stowe', osm: '1688ce1f', cc: 'US' },
  { name: 'Keystone', osm: '7d855b81', cc: 'US' },
  { name: 'Crested Butte', osm: 'c7ba4496', cc: 'US' },
  // Anchored on Val Thorens, the highest of the three.
  { name: 'Méribel / Val Thorens (Les 3 Vallées)', osm: 'b66cd0bd', cc: 'FR' },
  { name: 'Lech Zürs (Ski Arlberg)', osm: 'c5107fc2', cc: 'AT' },

  // --- Well known to anyone who skis --------------------------------------
  { name: 'Northstar', osm: '717fe0e8', cc: 'US' },
  { name: 'Kirkwood', osm: '718db266', cc: 'US' },
  // Ten linked areas; anchored on Happo-One, the flagship.
  { name: 'Hakuba Valley', osm: '2badaaea', cc: 'JP' },
  { name: 'Rusutsu', osm: '24ee5141', cc: 'JP' },
  { name: 'Okemo', osm: 'f6908eab', cc: 'US' },
  { name: 'Mount Snow', osm: '74dd4473', cc: 'US' },
  { name: 'Fernie', osm: 'ecea3ea3', cc: 'CA' },
  { name: 'Kicking Horse', osm: '64e116da', cc: 'CA' },
  { name: 'Perisher', osm: '562a20a6', cc: 'AU' },
  { name: 'Madonna di Campiglio (Skirama Dolomiti)', osm: 'fd830ae8', cc: 'IT' },
  { name: 'Mayrhofen (Zillertal)', osm: '0e7ba1fd', cc: 'AT' },
  { name: 'Crans-Montana', osm: '7764d597', cc: 'CH' },
  // Andermatt+Sedrun+Disentis; its summit, the Gemsstock, is Andermatt's.
  { name: 'Andermatt', osm: 'eeb2093c', cc: 'CH' },
  { name: 'Stevens Pass', osm: '32d8d3bd', cc: 'US' },
  { name: 'Hunter Mountain', osm: '0220b917', cc: 'US' },
  { name: 'Hintertux Glacier', osm: 'fd250230', cc: 'AT' },

  // --- Regional reputations -----------------------------------------------
  { name: 'Mont Sainte-Anne', osm: '3785c88c', cc: 'CA' },
  { name: 'Seven Springs', osm: '7181ee2f', cc: 'US' },
  { name: 'Attitash', osm: '513237f9', cc: 'US' },
  { name: 'Wildcat', osm: '0df6f263', cc: 'US' },
  { name: 'Falls Creek', osm: 'a280690d', cc: 'AU' },
  { name: 'Hotham', osm: 'aea2abf2', cc: 'AU' },
  { name: 'Zillertal Arena', osm: '3db514cc', cc: 'AT' },
  { name: 'Mount Sunapee', osm: '8107ea0d', cc: 'US' },
  { name: 'Kimberley', osm: '14471d68', cc: 'CA' },
  { name: 'Nakiska', osm: '629f4173', cc: 'CA' },
  { name: 'Stoneham', osm: 'baa17f75', cc: 'CA' },
  { name: 'Afton Alps', osm: '37f4ea45', cc: 'US' },
  { name: 'Whitetail', osm: '97655053', cc: 'US' },
  { name: 'Liberty', osm: '6fab99ca', cc: 'US' },
  { name: 'Hochzillertal-Hochfügen', osm: '99cef648', cc: 'AT' },
  { name: 'Spieljoch', osm: '69931ad5', cc: 'AT' },

  // --- Least known nationally ---------------------------------------------
  { name: 'Jack Frost', osm: '4fbb6591', cc: 'US' },
  { name: 'Big Boulder', osm: 'd80406be', cc: 'US' },
  { name: 'Roundtop', osm: '67139981', cc: 'US' },
  { name: 'Hidden Valley (PA)', osm: '04a5001a', cc: 'US' },
  { name: 'Laurel Mountain', osm: 'c4e2d22a', cc: 'US' },
  { name: 'Crotched Mountain', osm: '414efa2c', cc: 'US' },
  { name: 'Mt. Brighton', osm: 'eb223379', cc: 'US' },
  { name: 'Wilmot', osm: '5a1a80c1', cc: 'US' },
  // Epic's Alpine Valley is the Ohio one, not the larger Wisconsin resort.
  { name: 'Alpine Valley', osm: '209437aa', cc: 'US' },
  { name: 'Boston Mills', osm: 'cd7f28de', cc: 'US' },
  { name: 'Brandywine', osm: 'abc97db7', cc: 'US' },
  { name: 'Mad River Mountain', osm: '305c84e4', cc: 'US' },
  { name: 'Paoli Peaks', osm: 'a3712cf8', cc: 'US' },
  { name: 'Hidden Valley (MO)', osm: '05913b1b', cc: 'US' },
  { name: 'Snow Creek', osm: '88471079', cc: 'US' },
];
