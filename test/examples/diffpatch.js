var examples = {};

var exampleDate = function() {
  return new Date(2020, 10, 30, 15, 10, 03);
};

/*jshint camelcase: false */
/*jshint multistr: true */

examples.atomic_values = [

  // undefined
  {
    left: undefined,
    right: undefined,
    delta: undefined,
    reverse: undefined
  }, {
    left: undefined,
    right: null,
    delta: [null],
    reverse: [null, 0, 0]
  }, {
    left: undefined,
    right: false,
    delta: [false],
    reverse: [false, 0, 0]
  }, {
    left: undefined,
    right: true,
    delta: [true],
    reverse: [true, 0, 0]
  }, {
    left: undefined,
    right: 42,
    delta: [42],
    reverse: [42, 0, 0]
  }, {
    left: undefined,
    right: 'some text',
    delta: ['some text'],
    reverse: ['some text', 0, 0]
  }, {
    left: undefined,
    right: exampleDate(),
    delta: [exampleDate()],
    reverse: [exampleDate(), 0, 0]
  }, {
    left: undefined,
    right: {
      a: 1,
      b: 2
    },
    delta: [{
      a: 1,
      b: 2
    }],
    reverse: [{
        a: 1,
        b: 2
      },
      0, 0
    ]
  }, {
    left: undefined,
    right: [1, 2, 3],
    delta: [
      [1, 2, 3]
    ],
    reverse: [
      [1, 2, 3], 0, 0
    ]
  }, {
    left: undefined,
    right: function(x) {
      return x * x;
    },
    error: /not supported/,
  },

  // null
  {
    left: null,
    right: null,
    delta: undefined,
    reverse: undefined
  }, {
    left: null,
    right: false,
    delta: [null, false],
    reverse: [false, null]
  }, {
    left: null,
    right: true,
    delta: [null, true],
    reverse: [true, null]
  }, {
    left: null,
    right: 42,
    delta: [null, 42],
    reverse: [42, null]
  }, {
    left: null,
    right: 'some text',
    delta: [null, 'some text'],
    reverse: ['some text', null]
  }, {
    left: null,
    right: exampleDate(),
    delta: [null, exampleDate()],
    reverse: [exampleDate(), null]
  }, {
    left: null,
    right: {
      a: 1,
      b: 2
    },
    delta: [null, {
      a: 1,
      b: 2
    }],
    reverse: [{
        a: 1,
        b: 2
      },
      null
    ]
  }, {
    left: null,
    right: function(x) {
      return x * x;
    },
    error: /not supported/,
  },


  // false
  {
    left: false,
    right: false,
    delta: undefined,
    reverse: undefined
  }, {
    left: false,
    right: true,
    delta: [false, true],
    reverse: [true, false]
  }, {
    left: false,
    right: 42,
    delta: [false, 42],
    reverse: [42, false]
  }, {
    left: false,
    right: 'some text',
    delta: [false, 'some text'],
    reverse: ['some text', false]
  }, {
    left: false,
    right: exampleDate(),
    delta: [false, exampleDate()],
    reverse: [exampleDate(), false]
  }, {
    left: false,
    right: {
      a: 1,
      b: 2
    },
    delta: [false, {
      a: 1,
      b: 2
    }],
    reverse: [{
        a: 1,
        b: 2
      },
      false
    ]
  }, {
    left: false,
    right: [1, 2, 3],
    delta: [false, [1, 2, 3]],
    reverse: [
      [1, 2, 3], false
    ]
  }, {
    left: false,
    right: function(x) {
      return x * x;
    },
    error: /not supported/,
  },



  // true
  {
    left: true,
    right: true,
    delta: undefined,
    reverse: undefined
  }, {
    left: true,
    right: 42,
    delta: [true, 42],
    reverse: [42, true]
  }, {
    left: true,
    right: 'some text',
    delta: [true, 'some text'],
    reverse: ['some text', true]
  }, {
    left: true,
    right: exampleDate(),
    delta: [true, exampleDate()],
    reverse: [exampleDate(), true]
  }, {
    left: true,
    right: {
      a: 1,
      b: 2
    },
    delta: [true, {
      a: 1,
      b: 2
    }],
    reverse: [{
        a: 1,
        b: 2
      },
      true
    ]
  }, {
    left: true,
    right: [1, 2, 3],
    delta: [true, [1, 2, 3]],
    reverse: [
      [1, 2, 3], true
    ]
  }, {
    left: true,
    right: function(x) {
      return x * x;
    },
    error: /not supported/,
  },


  // number
  {
    name: 'number -> same number',
    left: 42,
    right: 42,
    delta: undefined,
    reverse: undefined
  }, {
    left: 42,
    right: -1,
    delta: [42, -1],
    reverse: [-1, 42]
  }, {
    left: 42,
    right: 'some text',
    delta: [42, 'some text'],
    reverse: ['some text', 42]
  }, {
    left: 42,
    right: exampleDate(),
    delta: [42, exampleDate()],
    reverse: [exampleDate(), 42]
  }, {
    left: 42,
    right: {
      a: 1,
      b: 2
    },
    delta: [42, {
      a: 1,
      b: 2
    }],
    reverse: [{
        a: 1,
        b: 2
      },
      42
    ]
  }, {
    left: 42,
    right: [1, 2, 3],
    delta: [42, [1, 2, 3]],
    reverse: [
      [1, 2, 3], 42
    ]
  }, {
    left: 42,
    right: function(x) {
      return x * x;
    },
    error: /not supported/,
  },

  // string
  {
    name: 'string -> same string',
    left: 'some text',
    right: 'some text',
    delta: undefined,
    reverse: undefined
  }, {
    left: 'some text',
    right: 'some fext',
    delta: ['some text', 'some fext'],
    reverse: ['some fext', 'some text']
  }, {
    left: 'some text',
    right: exampleDate(),
    delta: ['some text', exampleDate()],
    reverse: [exampleDate(), 'some text']
  }, {
    left: 'some text',
    right: {
      a: 1,
      b: 2
    },
    delta: ['some text', {
      a: 1,
      b: 2
    }],
    reverse: [{
      a: 1,
      b: 2
    }, 'some text']
  }, {
    left: 'some text',
    right: [1, 2, 3],
    delta: ['some text', [1, 2, 3]],
    reverse: [
      [1, 2, 3], 'some text'
    ]
  }, {
    left: 'some text',
    right: function(x) {
      return x * x;
    },
    error: /not supported/,
  },


  // Date
  {
    name: 'Date -> same Date',
    left: exampleDate(),
    right: exampleDate(),
    delta: undefined,
    reverse: undefined
  }, {
    left: exampleDate(),
    right: new Date(2020, 5, 31, 15, 12, 30),
    delta: [exampleDate(), new Date(2020, 5, 31, 15, 12, 30)],
    reverse: [new Date(2020, 5, 31, 15, 12, 30), exampleDate()]
  }, {
    left: exampleDate(),
    right: {
      a: 1,
      b: 2
    },
    delta: [exampleDate(), {
      a: 1,
      b: 2
    }],
    reverse: [{
        a: 1,
        b: 2
      },
      exampleDate()
    ]
  }, {
    left: exampleDate(),
    right: [1, 2, 3],
    delta: [exampleDate(), [1, 2, 3]],
    reverse: [
      [1, 2, 3], exampleDate()
    ]
  }, {
    left: exampleDate(),
    right: function(x) {
      return x * x;
    },
    error: /not supported/,
  },

  // object
  {
    name: 'object -> same object',
    left: {
      a: 1,
      b: 2
    },
    right: {
      a: 1,
      b: 2
    },
    delta: undefined,
    reverse: undefined
  }, {
    left: {
      a: 1,
      b: 2
    },
    right: [1, 2, 3],
    delta: [{
        a: 1,
        b: 2
      },
      [1, 2, 3]
    ],
    reverse: [
      [1, 2, 3], {
        a: 1,
        b: 2
      }
    ]
  }, {
    left: {
      a: 1,
      b: 2
    },
    right: function(x) {
      return x * x;
    },
    error: /not supported/,
  },

  // array
  {
    name: 'array -> same array',
    left: [1, 2, 3],
    right: [1, 2, 3],
    delta: undefined,
    reverse: undefined
  }, {
    left: [1, 2, 3],
    right: function(x) {
      return x * x;
    },
    error: /not supported/,
  },
  0
];

var shortText = 'Madre,\n\
cuando yo sea grande\n\
quisiera hacer versos';
var largeText = '-Madre,\n\
cuando yo sea grande\n\
seré marinero.\n\
\n\
Ahora estoy jugando\n\
que aquello es un puerto\n\
y que éste es un barco\n\
y éstos son dos remos\n\
y por ese río\n\
navego y navego.\n\
\n\
(Agua, arena, piedras\n\
y dos palos viejos:\n\
un río y un barco,\n\
un puerto y dos remos).\n\
\n\
-Madre,\n\
cuando yo sea grande\n\
seré jardinero.\n\
\n\
Ahora estoy jugando\n\
que esto es un cantero,\n\
aquél un rosal,\n\
éste un jazminero\n\
y ése es un camino\n\
que va por el medio.\n\
\n\
(Tierra, flores, hojas\n\
y unos tallos secos:\n\
cantero, camino,\n\
rosal, jazminero).\n\
\n\
-Madre,\n\
cuando yo sea grande\n\
quisiera hacer versos.\n\
\n\
-¿Con qué estás jugando?\n\
\n\
-Madre, miro el cielo.\n\
\n\
(En dos ojos claros\n\
todo el Universo).';
examples.text = [{
    left: shortText,
    right: largeText,
    delta: [shortText, largeText],
    reverse: [largeText, shortText]
  }, {
    left: largeText,
    right: largeText.replace(/jazminero/g, 'rosal'),
    delta: ['@@ -360,25 +360,21 @@\n %C3%A9ste un \n-jazminero\n+rosal' +
      '\n %0Ay %C3%A9se e\n@@ -479,17 +479,13 @@\n al, \n-jazminero\n+rosal\n ).%0A%0A\n', 0, 2
    ],
    reverse: ['@@ -360,21 +360,25 @@\n %C3%A9ste un \n-rosal\n+jazminero\n %0Ay' +
      ' %C3%A9se e\n@@ -479,21 +479,25 @@\n %0Arosal, \n-rosal\n+jazminero\n ).%0A%0A-Mad\n', 0, 2
    ],
    exactReverse: false
  }, {
    name: 'larger than min length',
    options: {
      textDiff: {
        minLength: 10
      }
    },
    left: largeText.substr(0, 10),
    right: largeText.substr(0, 11).replace(/Madre/g, 'Padre'),
    delta: ['@@ -1,10 +1,11 @@\n -\n-M\n+P\n adre,%0Acu\n+a\n', 0, 2],
    reverse: ['@@ -1,11 +1,10 @@\n -\n-P\n+M\n adre,%0Acu\n-a\n', 0, 2],
    exactReverse: false
  }, {
    name: 'shorter than min length',
    options: {
      textDiff: {
        minLength: 10
      }
    },
    left: largeText.substr(0, 9),
    right: largeText.substr(0, 11).replace(/Madre/g, 'Padre'),
    delta: ['-Madre,\nc', '-Padre,\ncua'],
    reverse: ['-Padre,\ncua', '-Madre,\nc'],
    exactReverse: false
  },
  0
];

examples.objects = [{
    name: 'first level',
    left: {
      a: 1,
      b: 2
    },
    right: {
      a: 42,
      b: 2
    },
    delta: {
      a: [1, 42]
    },
    reverse: {
      a: [42, 1]
    }
  }, {
    name: 'deep level',
    left: {
      a: {
        j: {
          k: {
            l: {
              m: {
                n: {
                  o: 3
                }
              }
            }
          }
        }
      },
      b: 2
    },
    right: {
      a: {
        j: {
          k: {
            l: {
              m: {
                n: {
                  o: true
                }
              }
            }
          }
        }
      },
      b: 2
    },
    delta: {
      a: {
        j: {
          k: {
            l: {
              m: {
                n: {
                  o: [3, true]
                }
              }
            }
          }
        }
      }
    },
    reverse: {
      a: {
        j: {
          k: {
            l: {
              m: {
                n: {
                  o: [true, 3]
                }
              }
            }
          }
        }
      }
    }
  }, {
    name: 'multiple changes',
    left: {
      a: {
        j: {
          k: {
            l: {
              m: {
                n: {
                  o: 3
                }
              }
            }
          }
        }
      },
      b: 2,
      c: 5
    },
    right: {
      a: {
        j: {
          k: {
            l: {
              m: {
                n: {
                  o: 5,
                  w: 12
                }
              }
            }
          }
        }
      },
      b: 2
    },
    delta: {
      a: {
        j: {
          k: {
            l: {
              m: {
                n: {
                  o: [3, 5],
                  w: [12]
                }
              }
            }
          }
        }
      },
      c: [5, 0, 0]
    },
    reverse: {
      a: {
        j: {
          k: {
            l: {
              m: {
                n: {
                  o: [5, 3],
                  w: [12, 0, 0]
                }
              }
            }
          }
        }
      },
      c: [5]
    }
  }, {
    name: 'key removed',
    left: {
      a: 1,
      b: 2
    },
    right: {
      a: 1
    },
    delta: {
      b: [2, 0, 0]
    },
    reverse: {
      b: [2]
    }
  },
  0
];

examples.arrays = [{
    name: 'simple values',
    left: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    right: [1, 3, 4, 5, 8, 9, 9.1, 10],
    delta: {
      _t: 'a',
      _1: [2, 0, 0],
      _5: [6, 0, 0],
      _6: [7, 0, 0],
      6: [9.1]
    },
    reverse: {
      _t: 'a',
      1: [2],
      5: [6],
      6: [7],
      _6: [9.1, 0, 0]
    }
  }, {
    name: 'added block',
    left: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    right: [1, 2, 3, 4, 5, 5.1, 5.2, 5.3, 6, 7, 8, 9, 10],
    delta: {
      _t: 'a',
      5: [5.1],
      6: [5.2],
      7: [5.3]
    },
    reverse: {
      _t: 'a',
      _5: [5.1, 0, 0],
      _6: [5.2, 0, 0],
      _7: [5.3, 0, 0]
    }
  }, {
    name: 'movements',
    left: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    right: [1, 2, 3, 7, 5, 6, 8, 9, 4, 10],
    delta: {
      _t: 'a',
      _3: ['', 8, 3],
      _6: ['', 3, 3]
    },
    reverse: {
      _t: 'a',
      _3: ['', 6, 3],
      _8: ['', 3, 3]
    }
  }, {
    name: 'movements(2)',
    left: [1, 2, 3, 4],
    right: [2, 4, 1, 3],
    delta: {
      _t: 'a',
      _1: ['', 0, 3],
      _3: ['', 1, 3]
    },
    reverse: {
      _t: 'a',
      _2: ['', 0, 3],
      _3: ['', 2, 3]
    },
    exactReverse: false
  }, {
    name: 'nested',
    options: {
      objectHash: function(obj) {
        if (obj && obj.id) {
          return obj.id;
        }
      }
    },
    left: [1, 2, {
        id: 4,
        width: 10
      },
      4, {
        id: 'five',
        width: 4
      },
      6, 7, 8, 9, 10
    ],
    right: [1, 2, {
        id: 4,
        width: 12
      },
      4, {
        id: 'five',
        width: 4
      },
      6, 7, 8, 9, 10
    ],
    delta: {
      _t: 'a',
      2: {
        width: [10, 12]
      }
    },
    reverse: {
      _t: 'a',
      2: {
        width: [12, 10]
      }
    }
  }, {
    name: 'nested with movement',
    options: {
      objectHash: function(obj) {
        if (obj && obj.id) {
          return obj.id;
        }
      }
    },
    left: [1, 2, 4, {
      id: 'five',
      width: 4
    },
    6, 7, 8, {
      id: 4,
      width: 10,
      height: 3
    },
    9, 10
    ],
    right: [1, 2, {
      id: 4,
      width: 12
    },
    4, {
      id: 'five',
      width: 4
    },
    6, 7, 8, 9, 10
    ],
    delta: {
      _t: 'a',
      2: {
        width: [10, 12],
        height: [3, 0, 0]
      },
      _7: ['', 2, 3]
    },
    reverse: {
      _t: 'a',
      7: {
        width: [12, 10],
        height: [3]
      },
      _2: ['', 7, 3]
    }
  }, {
    name: 'nested changes among array insertions and deletions',
    options: {
      objectHash: function(obj) {
        if (obj && obj.id) {
          return obj.id;
        }
      }
    },
    left: [
      {
        id: 1
      },
      {
        id: 2
      },
      {
        id: 4
      },
      {
        id: 5
      },
      {
        id: 6,
        inner: {
          property: 'abc'
        }
      },
      {
        id: 7
      },
      {
        id: 8
      },
      {
        id: 10
      },
      {
        id: 11
      },
      {
        id: 12
      }
      ],
    right: [
      {
        id: 3
      },
      {
        id: 4
      },
      {
        id: 6,
        inner: {
          property: 'abcd'
        }
      },
      {
        id: 9
      }
    ],
    delta: {
      _t: 'a',
      0: [ { id: 3 } ],
      2: {
        inner: {
          property: [ 'abc', 'abcd' ]
        }
      },
      3: [ { id: 9 } ],
      _0: [ { id: 1 }, 0, 0 ],
      _1: [ { id: 2 }, 0, 0 ],
      _3: [ { id: 5 }, 0, 0 ],
      _5: [ { id: 7 }, 0, 0 ],
      _6: [ { id: 8 }, 0, 0 ],
      _7: [ { id: 10 }, 0, 0 ],
      _8: [ { id: 11 }, 0, 0 ],
      _9: [ { id: 12 }, 0, 0 ]
    },
    reverse: {
      _t: 'a',
      0: [ { id: 1 } ],
      1: [ { id: 2 } ],
      3: [ { id: 5 } ],
      4: {
        inner: {
          property: [ 'abcd', 'abc' ]
        }
      },
      5: [ { id: 7 } ],
      6: [ { id: 8 } ],
      7: [ { id: 10 } ],
      8: [ { id: 11 } ],
      9: [ { id: 12 } ],
      _0: [ { id: 3 }, 0, 0 ],
      _3: [ { id: 9 }, 0, 0 ]
    }
  }, {
    name: 'nested change with item moved above',
    options: {
      objectHash: function(obj) {
        if (obj && obj.id) {
          return obj.id;
        }
      }
    },
    left: [
      {
        id: 1
      },
      {
        id: 2
      },
      {
        id: 3,
        inner: {
          property: 'abc'
        }
      },
      {
        id: 4
      },
      {
        id: 5
      },
      {
        id: 6
      }
    ],
    right: [
      {
        id: 1
      },
      {
        id: 2
      },
      {
        id: 6
      },
      {
        id: 3,
        inner: {
          property: 'abcd'
        }
      },
      {
        id: 4
      },
      {
        id: 5
      }
    ],
    delta: {
      _t: 'a',
      3: {
        inner:{
          property:[ 'abc', 'abcd' ]
        }
      },
      _5:['', 2, 3 ]
    },
    reverse: {
      _t: 'a',
      2: {
        inner:{
          property:[ 'abcd', 'abc' ]
        }
      },
      _2:['', 5, 3 ]
    }
  }, {
    name: 'nested change with item moved right above',
    options: {
      objectHash: function(obj) {
        if (obj && obj.id) {
          return obj.id;
        }
      }
    },
    left: [
      {
        id: 1
      },
      {
        id: 2,
        inner: {
          property: 'abc'
        }
      },
      {
        id: 3
      }
    ],
    right: [
      {
        id: 1
      },
      {
        id: 3
      },
      {
        id: 2,
        inner: {
          property: 'abcd'
        }
      }
    ],
    delta: {
      _t: 'a',
      2: {
        inner:{
          property:[ 'abc', 'abcd' ]
        }
      },
      _2:['', 1, 3 ]
    },
    reverse: {
      _t: 'a',
      1: {
        inner:{
          property:[ 'abcd', 'abc' ]
        }
      },
      _2:['', 1, 3 ]
    },
    exactReverse: false
  }, {
    name: 'nested change with item moved right below',
    options: {
      objectHash: function(obj) {
        if (obj && obj.id) {
          return obj.id;
        }
      }
    },
    left: [
      {
        id: 1
      },
      {
        id: 2
      },
      {
        id: 3,
        inner: {
          property: 'abc'
        }
      },
      {
        id: 4
      }
    ],
    right: [
      {
        id: 2
      },
      {
        id: 3,
        inner: {
          property: 'abcd'
        }
      },
      {
        id: 1
      },
      {
        id: 4
      }
    ],
    delta: {
      _t: 'a',
      1: {
        inner:{
          property:[ 'abc', 'abcd' ]
        }
      },
      _0:['', 2, 3 ]
    },
    reverse: {
      _t: 'a',
      2: {
        inner:{
          property:[ 'abcd', 'abc' ]
        }
      },
      _2:['', 0, 3 ]
    }
  }, {
    name: 'nested with movements using custom objectHash',
    options: {
      objectHash: function(obj) {
        if (obj && obj.item_key) {
          return obj.item_key;
        }
      }
    },
    left: [1, 2, 4, {
        item_key: 'five',
        width: 4
      },
      6, 7, 8, {
        item_key: 4,
        width: 10,
        height: 3
      },
      9, 10
    ],
    right: [1, 2, {
        item_key: 4,
        width: 12
      },
      4, {
        item_key: 'five',
        width: 4
      },
      6, 7, 8, 9, 10
    ],
    delta: {
      _t: 'a',
      2: {
        width: [10, 12],
        height: [3, 0, 0]
      },
      _7: ['', 2, 3]
    },
    reverse: {
      _t: 'a',
      7: {
        width: [12, 10],
        height: [3]
      },
      _2: ['', 7, 3]
    }
  },
  {
    name: 'using property filter',
    options: {
      propertyFilter: function(name/*, context */) {
        return name.slice(0, 1) !== '$';
      }
    },
    left: {
      inner: {
        $volatileData: 345,
        $oldVolatileData: 422,
        nonVolatile: 432
      }
    },
    right: {
      inner: {
        $volatileData: 346,
        $newVolatileData: 32,
        nonVolatile: 431
      }
    },
    delta: {
      inner: {
        nonVolatile: [432, 431]
      }
    },
    reverse: {
      inner: {
        nonVolatile: [431, 432]
      }
    },
    noPatch: true
  },
  0
];

module.exports = examples;
