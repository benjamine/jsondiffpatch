"use strict";

if (typeof exports !== "undefined") {
    if (typeof QUnit == 'undefined' && typeof require == 'function') {
        // dirty fix for missing QUnit object on CommonJS env
        var QUnit = require('../node_modules/qunit/support/qunit/qunit.js');
    }
    var jsondiffpatch = require('../src/jsondiffpatch');

    // load google diff_match_patch library for text diff/patch
    jsondiffpatch.config.diff_match_patch = require('../lib/diff_match_patch_uncompressed.js');

}

QUnit.module('main', {

    setup: function(){
    
        jsondiffpatch.config.objectHash = function(obj) {
            return obj.id || obj.name || JSON.stringify(obj);
        };

        // prepare some sample data
        var sa = this.sa = {
            name: 'South America',
            summary: "\
South America (Spanish: América del Sur, Sudamérica or Suramérica; Portuguese: \
América do Sul; Quechua and Aymara: Urin Awya Yala; Guarani: Ñembyamérika; \
Dutch: Zuid-Amerika; French: Amérique du Sud) is a continent situated in the \
Western Hemisphere, mostly in the Southern Hemisphere, with a relatively small \
portion in the Northern Hemisphere. The continent is also considered a \
subcontinent of the Americas.[2][3] It is bordered on the west by the Pacific \
Ocean and on the north and east by the Atlantic Ocean; North America and the \
Caribbean Sea lie to the northwest. It includes twelve countries: Argentina, \
Bolivia, Brazil, Chile, Colombia, Ecuador, Guyana, Paraguay, Peru, Suriname, \
Uruguay, and Venezuela. The South American nations that border the Caribbean \
Sea—including Colombia, Venezuela, Guyana, Suriname, as well as French Guiana, \
which is an overseas region of France—are also known as Caribbean South America. \
\
South America has an area of 17,840,000 square kilometers (6,890,000 sq mi). \
Its population as of 2005 has been estimated at more than 371,090,000. South \
America ranks fourth in area (after Asia, Africa, and North America) and fifth \
in population (after Asia, Africa, Europe, and North America). The word \
America was coined in 1507 by cartographers Martin Waldseemüller and Matthias \
Ringmann, after Amerigo Vespucci, who was the first European to suggest that \
the lands newly discovered by Europeans were not India, but a New World \
unknown to Europeans."            ,
            
            surface: 17840000,
            timezone: [-4, -2],
            demographics: {
                population: 385742554,
                largestCities: ["São Paulo", "Buenos Aires", "Rio de Janeiro", "Lima", "Bogotá"]
            },
            languages: ["spanish", "portuguese", "english", "dutch", "french", "quechua", "guaraní", "aimara", "mapudungun"],
            countries: [{
                name: "Argentina",
                capital: "Buenos Aires",
                independence: new Date(1816, 6, 9),
                unasur: true
            }, {
                name: "Bolivia",
                capital: "La Paz",
                independence: new Date(1825, 7, 6),
                unasur: true
            }, {
                name: "Brazil",
                capital: "Brasilia",
                independence: new Date(1822, 8, 7),
                unasur: true
            }, {
                name: "Chile",
                capital: "Santiago",
                independence: new Date(1818, 1, 12),
                unasur: true
            }, {
                name: "Colombia",
                capital: "Bogotá",
                independence: new Date(1810, 6, 20),
                unasur: true
            }, {
                name: "Ecuador",
                capital: "Quito",
                independence: new Date(1809, 7, 10),
                unasur: true
            }, {
                name: "Guyana",
                capital: "Georgetown",
                independence: new Date(1966, 4, 26),
                unasur: true
            }, {
                name: "Paraguay",
                capital: "Asunción",
                independence: new Date(1811, 4, 14),
                unasur: true
            }, {
                name: "Peru",
                capital: "Lima",
                independence: new Date(1821, 6, 28),
                unasur: true
            }, {
                name: "Suriname",
                capital: "Paramaribo",
                independence: new Date(1975, 10, 25),
                unasur: true
            }, {
                name: "Uruguay",
                capital: "Montevideo",
                independence: new Date(1825, 7, 25),
                unasur: true
            }, {
                name: "Venezuela",
                capital: "Caracas",
                independence: new Date(1811, 6, 5),
                unasur: true
            }]
        };
        
        sa.countries._key = 'name';
        
        var ctx = this;
        
        this.makeCopy = function(){
            ctx.sa2 = JSON.parse(JSON.stringify(ctx.sa), jsondiffpatch.dateReviver);
        };
        
        this.diffPatch = function(){
            ctx.delta = jsondiffpatch.diff(this.sa, this.sa2);
            jsondiffpatch.patch(this.sa, ctx.delta);
            ctx.delta2 = jsondiffpatch.diff(this.sa, this.sa2);
        };
        
        this.diffUnpatch = function(){
            ctx.delta = jsondiffpatch.diff(this.sa, this.sa2);
            jsondiffpatch.unpatch(this.sa2, ctx.delta);
            ctx.delta2 = jsondiffpatch.diff(this.sa, this.sa2);
        };
          
    }
    
});


test("change simple values", 1, function(){

    this.makeCopy();
    
    this.sa2.name = "Sudamérica";
    this.sa2.surface += 9832;
    this.sa2.countries[0].independence = new Date(1816, 6, 19);
    this.sa2.countries[0].unasur = false;
    
    this.diffPatch();
    
    equal(typeof this.delta2, "undefined", 'original equals new');
});

test("change from/to undefined", 1, function(){

    this.makeCopy();
    
    this.sa2.spanishName = "Sudamérica";
    delete this.sa2.surface;
    this.sa2.countries[0].officialName = "República Argentina";
    delete this.sa2.countries[0].unasur;
    
    this.diffPatch();
    
    equal(typeof this.delta2, "undefined", 'original equals new');
});

test("change from/to null", 1, function(){

    this.sa.oceans = null;
    
    this.makeCopy();
    
    this.sa2.oceans = ["Pacific", "Atlantic", "Antartic"];
    this.sa2.demographics.population = null;
    
    this.diffPatch();
    
    equal(typeof this.delta2, "undefined", 'original equals new');
});

test("change simple list", 2, function(){

    this.makeCopy();
    
    this.sa2.languages[0] = "español";
    this.sa2.languages.splice(2, 3);
    this.sa2.languages.unshift("lunfardo");
    this.sa2.languages.push("italian");
    
    this.diffPatch();
    
    deepEqual(this.sa.languages, this.sa2.languages);
    equal(typeof this.delta2, "undefined", 'original equals new');
});

test("change subobject", 1, function(){

    this.makeCopy();
    
    this.sa2.demographics.population += 93113;
    this.sa2.demographics.largestCities.shift();
    this.sa2.demographics.largestCities.push("Santiago");
    
    this.diffPatch();
    
    equal(typeof this.delta2, "undefined", 'original equals new');
});

test("change long string", 3, function(){

    this.makeCopy();
    
    this.sa2.summary = this.sa2.summary.replace("Amerigo Vespucci", "Américo Vespucio").replace(/\[[0-9]+\]/g, '') +
    "\n\nsource: http://en.wikipedia.org/wiki/South_america\n";
    
    this.diffPatch();
    
    var deltaSize = JSON.stringify(this.delta).length;
    var totalSize = this.sa2.summary.length;
    
    equal(JSON.stringify(this.delta).indexOf(this.sa2.summary.substr(5, 40)), -1, 'diff doesn\'t include all text');
    ok(deltaSize < totalSize, 'diff is smaller than whole string (' + Math.round(deltaSize / totalSize * 100) + '%)');
    equal(typeof this.delta2, "undefined", 'original equals new');
});

test("change list, moving items", 2, function(){

    this.makeCopy();
    
    this.sa.countries[2].capital = "Rio de Janeiro";
    this.sa.countries[5].mercosur = true;
    this.sa.countries.pop();
    var toMove = this.sa.countries.pop();
    this.sa2.countries.push({
        name: "French Guiana",
        capital: "Cayenne",
        independence: new Date(2012, 11, 23),
        unasur: true
    });
    this.sa2.countries.splice(3, 0, toMove);

    this.diffPatch();
    
    var deltaSize = JSON.stringify(this.delta).length;
    var totalSize = JSON.stringify(this.sa2.countries).length;
    ok(deltaSize < totalSize, 'diff is smaller than whole list (' + Math.round(deltaSize / totalSize * 100) + '%)');
    equal(typeof this.delta2, "undefined", 'original equals new');
});

test("reverse diff", 1, function(){

    this.makeCopy();
    
    // change simple values    
    this.sa2.name = "Sudamérica";
    this.sa2.surface += 9832;
    this.sa2.countries[0].independence = new Date(1716, 6, 19);
    delete this.sa2.countries[0].unasur;

    this.diffPatch();
    
    var deltaR = jsondiffpatch.reverse(this.delta);

    var expectedDeltaR = { 
        name: ["Sudamérica","South America"],
        surface: [17849832,17840000],
        countries:{
            _t: "a",
            "0": {
                independence: [new Date(1716, 6, 19), new Date(1816, 6, 9)],
                unasur: [true]
            }
        }
    };

    deepEqual(deltaR, expectedDeltaR, 'reversed diff is correct');
});

test("unpatch", 1, function(){

    this.makeCopy();
    
    // change simple values    
    this.sa2.name = "Sudamérica";
    this.sa2.surface += 9832;
    this.sa2.countries[0].independence = new Date(1816, 6, 19);
    delete this.sa2.countries[0].unasur;

    // change subobject
    this.sa2.demographics.population += 93113;
    this.sa2.demographics.largestCities.shift();
    this.sa2.demographics.largestCities.push("Santiago");

    // change long text
    this.sa2.summary = this.sa2.summary.replace("Amerigo Vespucci", "Américo Vespucio").replace(/\[[0-9]+\]/g, '') +
    "\n\nsource: http://en.wikipedia.org/wiki/South_america\n";
    
    // change list with key
    this.sa.countries[2].capital = "Rio de Janeiro";
    this.sa.countries[5].mercosur = true;
    this.sa.countries.pop();
    this.sa2.countries.push({
        name: "French Guiana",
        capital: "Cayenne",
        independence: new Date(2012, 11, 23),
        unasur: true
    });

    this.sa2.countries._key = 'name';

    this.diffUnpatch();    

    equal(typeof this.delta2, "undefined", 'reversed new equals original');
});
