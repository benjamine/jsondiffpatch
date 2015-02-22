var jsondiffpatch = require('../src/main');

var instance = jsondiffpatch.create({
  objectHash: function(obj) {
    return obj._id || obj.id || obj.name || JSON.stringify(obj);
  }
});

var data = {
  name: 'South America',
  summary: 'South America (Spanish: América del Sur, Sudamérica or Suramérica; Portuguese: América do Sul;' +
    ' Quechua and Aymara: Urin Awya Yala; Guarani: Ñembyamérika; Dutch: Zuid-Amerika; French: Amérique' +
    ' du Sud) is a continent situated in the Western Hemisphere, mostly in the Southern Hemisphere,' +
    ' with a relatively small portion in the Northern Hemisphere. The continent is also considered a' +
    ' subcontinent of the Americas.[2][3] It is bordered on the west by the Pacific Ocean and on the ' +
    'north and east by the Atlantic Ocean; North America and the Caribbean Sea lie to the northwest. ' +
    'It includes twelve countries: Argentina, Bolivia, Brazil, Chile, Colombia, Ecuador, Guyana, Paraguay' +
    ', Peru, Suriname, Uruguay, and Venezuela. The South American nations that border the Caribbean ' +
    'Sea—including Colombia, Venezuela, Guyana, Suriname, as well as French Guiana, which is an overseas' +
    ' region of France—are also known as Caribbean South America. South America has an area of 17,840,000' +
    ' square kilometers (6,890,000 sq mi). Its population as of 2005 has been estimated at more than ' +
    '371,090,000. South America ranks fourth in area (after Asia, Africa, and North America) and fifth ' +
    'in population (after Asia, Africa, Europe, and North America). The word America was coined in 1507 by' +
    ' cartographers Martin Waldseemüller and Matthias Ringmann, after Amerigo Vespucci, who was the first ' +
    'European to suggest that the lands newly discovered by Europeans were not India, but a New World ' +
    'unknown to Europeans.',

  surface: 17840000,
  timezone: [-4, -2],
  demographics: {
    population: 385742554,
    largestCities: ['São Paulo', 'Buenos Aires', 'Rio de Janeiro', 'Lima', 'Bogotá']
  },
  languages: ['spanish', 'portuguese', 'english', 'dutch', 'french', 'quechua', 'guaraní', 'aimara', 'mapudungun'],
  countries: [{
    name: 'Argentina',
    capital: 'Buenos Aires',
    independence: new Date(1816, 6, 9),
    unasur: true
  }, {
    name: 'Bolivia',
    capital: 'La Paz',
    independence: new Date(1825, 7, 6),
    unasur: true
  }, {
    name: 'Brazil',
    capital: 'Brasilia',
    independence: new Date(1822, 8, 7),
    unasur: true
  }, {
    name: 'Chile',
    capital: 'Santiago',
    independence: new Date(1818, 1, 12),
    unasur: true
  }, {
    name: 'Colombia',
    capital: 'Bogotá',
    independence: new Date(1810, 6, 20),
    unasur: true
  }, {
    name: 'Ecuador',
    capital: 'Quito',
    independence: new Date(1809, 7, 10),
    unasur: true
  }, {
    name: 'Guyana',
    capital: 'Georgetown',
    independence: new Date(1966, 4, 26),
    unasur: true
  }, {
    name: 'Paraguay',
    capital: 'Asunción',
    independence: new Date(1811, 4, 14),
    unasur: true
  }, {
    name: 'Peru',
    capital: 'Lima',
    independence: new Date(1821, 6, 28),
    unasur: true
  }, {
    name: 'Suriname',
    capital: 'Paramaribo',
    independence: new Date(1975, 10, 25),
    unasur: true
  }, {
    name: 'Uruguay',
    capital: 'Montevideo',
    independence: new Date(1825, 7, 25),
    unasur: true
  }, {
    name: 'Venezuela',
    capital: 'Caracas',
    independence: new Date(1811, 6, 5),
    unasur: true
  }]
};

var left = JSON.parse((JSON.stringify(data)), jsondiffpatch.dateReviver);

data.summary = data.summary.replace('Brazil', 'Brasil').replace('also known as', 'a.k.a.');
data.languages[2] = 'inglés';
data.countries.pop();
data.countries.pop();
data.countries[0].capital = 'Rawson';
data.countries.push({
  name: 'Antártida',
  unasur: false
});

// modify and move
data.countries[4].population = 42888594;
data.countries.splice(11, 0, data.countries.splice(4, 1)[0]);

data.countries.splice(2, 0, data.countries.splice(7, 1)[0]);

delete data.surface;
data.spanishName = 'Sudamérica';
data.demographics.population += 2342;

var right = data;
var delta = instance.diff(left, right);

jsondiffpatch.console.log(delta);
