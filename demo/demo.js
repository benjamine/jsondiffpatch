(function demo() {

  var getExampleJson = function() {
    var data = {
      name: 'South America',
      summary: 'South America (Spanish: América del Sur, Sudamérica or  \n' +
        'Suramérica; Portuguese: América do Sul; Quechua and Aymara:  \n' +
        'Urin Awya Yala; Guarani: Ñembyamérika; Dutch: Zuid-Amerika;  \n' +
        'French: Amérique du Sud) is a continent situated in the  \n' +
        'Western Hemisphere, mostly in the Southern Hemisphere, with  \n' +
        'a relatively small portion in the Northern Hemisphere.  \n' +
        'The continent is also considered a subcontinent of the  \n' +
        'Americas.[2][3] It is bordered on the west by the Pacific  \n' +
        'Ocean and on the north and east by the Atlantic Ocean;  \n' +
        'North America and the Caribbean Sea lie to the northwest.  \n' +
        'It includes twelve countries: Argentina, Bolivia, Brazil,  \n' +
        'Chile, Colombia, Ecuador, Guyana, Paraguay, Peru, Suriname,  \n' +
        'Uruguay, and Venezuela. The South American nations that  \n' +
        'border the Caribbean Sea—including Colombia, Venezuela,  \n' +
        'Guyana, Suriname, as well as French Guiana, which is an  \n' +
        'overseas region of France—are also known as Caribbean South  \n' +
        'America. South America has an area of 17,840,000 square  \n' +
        'kilometers (6,890,000 sq mi). Its population as of 2005  \n' +
        'has been estimated at more than 371,090,000. South America  \n' +
        'ranks fourth in area (after Asia, Africa, and North America)  \n' +
        'and fifth in population (after Asia, Africa, Europe, and  \n' +
        'North America). The word America was coined in 1507 by  \n' +
        'cartographers Martin Waldseemüller and Matthias Ringmann,  \n' +
        'after Amerigo Vespucci, who was the first European to  \n' +
        'suggest that the lands newly discovered by Europeans were  \n' +
        'not India, but a New World unknown to Europeans.',

      surface: 17840000,
      timezone: [-4, -2],
      demographics: {
        population: 385742554,
        largestCities: ['São Paulo', 'Buenos Aires', 'Rio de Janeiro', 'Lima', 'Bogotá']
      },
      languages: ['spanish', 'portuguese', 'english', 'dutch',
        'french', 'quechua', 'guaraní', 'aimara', 'mapudungun'
      ],
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

    var json = [JSON.stringify(data, null, 2)];

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

    json.push(JSON.stringify(data, null, 2));

    return json;
  };


  /* global jsondiffpatch */
  var instance = jsondiffpatch.create({
    objectHash: function(obj, index) {
      if (typeof obj._id !== 'undefined') {
        return obj._id;
      }
      if (typeof obj.id !== 'undefined') {
        return obj.id;
      }
      if (typeof obj.name !== 'undefined') {
        return obj.name;
      }
      return '$$index:' + index;
    }
  });

  var dom = {
    addClass: function(el, className) {
      if (el.classList) {
        el.classList.add(className);
      } else {
        el.className += ' ' + className;
      }
    },
    removeClass: function(el, className) {
      if (el.classList) {
        el.classList.remove(className);
      } else {
        el.className = el.className.replace(new RegExp('(^|\\b)' +
          className.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
      }
    },
    text: function(el, text) {
      if (typeof el.textContent !== 'undefined') {
        if (typeof text === 'undefined') {
          return el.textContent;
        }
        el.textContent = text;
      } else {
        if (typeof text === 'undefined') {
          return el.innerText;
        }
        el.innerText = text;
      }
    },
    on: function(el, eventName, handler) {
      if (el.addEventListener) {
        el.addEventListener(eventName, handler);
      } else {
        el.attachEvent('on' + eventName, handler);
      }
    },
    ready: function(fn) {
      if (document.addEventListener) {
        document.addEventListener('DOMContentLoaded', fn);
      } else {
        document.attachEvent('onreadystatechange', function() {
          if (document.readyState === 'interactive') {
            fn();
          }
        });
      }
    },
    getJson: function(url, callback) {
      var request = new XMLHttpRequest();
      request.open('GET', url, true);
      request.onreadystatechange = function() {
        if (this.readyState === 4) {
          var data;
          try {
            data = JSON.parse(this.responseText, jsondiffpatch.dateReviver);
          } catch (parseError) {
            callback('parse error: ' + parseError);
          }
          if (this.status >= 200 && this.status < 400) {
            callback(null, data);
          } else {
            callback(new Error('request failed'), data);
          }
        }
      };
      request.send();
      request = null;
    },
    runScriptTags: function(el) {
      var scripts = el.querySelectorAll('script');
      for (var i = 0; i < scripts.length; i++) {
        var s = scripts[i];
        /* jshint evil: true */
        eval(s.innerHTML);
      }
    }
  };

  var trim = function(str) {
    return str.replace(/^\s+|\s+$/g, '');
  };

  var JsonArea = function JsonArea(element) {
    this.element = element;
    this.container = element.parentNode;
    var self = this;
    var prettifyButton = this.container.querySelector('.prettyfy');
    if (prettifyButton) {
      dom.on(prettifyButton, 'click', function() {
        self.prettyfy();
      });
    }
  };

  JsonArea.prototype.error = function(err) {
    var errorElement = this.container.querySelector('.error-message');
    if (!err) {
      dom.removeClass(this.container, 'json-error');
      errorElement.innerHTML = '';
      return;
    }
    errorElement.innerHTML = err + '';
    dom.addClass(this.container, 'json-error');
  };

  JsonArea.prototype.getValue = function() {
    if (!this.editor) {
      return this.element.value;
    }
    return this.editor.getValue();
  };

  JsonArea.prototype.parse = function() {
    var txt = trim(this.getValue());
    try {
      this.error(false);
      if (/^\d+(.\d+)?(e[\+\-]?\d+)?$/i.test(txt) ||
        /^(true|false)$/.test(txt) ||
        /^["].*["]$/.test(txt) ||
        /^[\{\[](.|\n)*[\}\]]$/.test(txt)) {
        return JSON.parse(txt, jsondiffpatch.dateReviver);
      }
      return this.getValue();
    } catch (err) {
      this.error(err);
      throw err;
    }
  };

  JsonArea.prototype.setValue = function(value) {
    if (!this.editor) {
      this.element.value = value;
      return;
    }
    this.editor.setValue(value);
  };

  JsonArea.prototype.prettyfy = function() {
    var value = this.parse();
    var prettyJson = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    this.setValue(prettyJson);
  };

  /* global CodeMirror */
  JsonArea.prototype.makeEditor = function(readOnly) {
    if (typeof CodeMirror === 'undefined') {
      return;
    }
    this.editor = CodeMirror.fromTextArea(this.element, {
      mode: 'javascript',
      json: true,
      readOnly: readOnly
    });
    if (!readOnly) {
      this.editor.on('change', compare);
    }
  };

  var areas = {
    left: new JsonArea(document.getElementById('json-input-left')),
    right: new JsonArea(document.getElementById('json-input-right')),
    delta: new JsonArea(document.getElementById('json-delta'))
  };

  var compare = function() {
    var left, right, error;
    document.getElementById('results').style.display = 'none';
    try {
      left = areas.left.parse();
    } catch (err) {
      error = err;
    }
    try {
      right = areas.right.parse();
    } catch (err) {
      error = err;
    }
    areas.delta.error(false);
    if (error) {
      areas.delta.setValue('');
      return;
    }
    var selectedType = getSelectedDeltaType();
    var visualdiff = document.getElementById('visualdiff');
    var annotateddiff = document.getElementById('annotateddiff');
    var jsondifflength = document.getElementById('jsondifflength');
    try {
      var delta = instance.diff(left, right);

      if (typeof delta === 'undefined') {
        switch (selectedType) {
          case 'visual':
            visualdiff.innerHTML = 'no diff';
            break;
          case 'annotated':
            annotateddiff.innerHTML = 'no diff';
            break;
          case 'json':
            areas.delta.setValue('no diff');
            jsondifflength.innerHTML = '0';
            break;
        }
      } else {
        switch (selectedType) {
          case 'visual':
            visualdiff.innerHTML = jsondiffpatch.formatters.html.format(delta, left);
            if (!document.getElementById('showunchanged').checked) {
              jsondiffpatch.formatters.html.hideUnchanged();
            }
            dom.runScriptTags(visualdiff);
            break;
          case 'annotated':
            annotateddiff.innerHTML = jsondiffpatch.formatters.annotated.format(delta);
            break;
          case 'json':
            areas.delta.setValue(JSON.stringify(delta, null, 2));
            jsondifflength.innerHTML = (Math.round(JSON.stringify(delta).length / 102.4) / 10.0) + '';
            break;
        }
      }
    } catch (err) {
      jsondifflength.innerHTML = '0';
      visualdiff.innerHTML = '';
      annotateddiff.innerHTML = '';
      areas.delta.setValue('');
      areas.delta.error(err);
      if (typeof console !== 'undefined' && console.error) {
        console.error(err);
        console.error(err.stack);
      }
    }
    document.getElementById('results').style.display = '';
  };

  areas.left.makeEditor();
  areas.right.makeEditor();

  dom.on(areas.left.element, 'change', compare);
  dom.on(areas.right.element, 'change', compare);
  dom.on(areas.left.element, 'keyup', compare);
  dom.on(areas.right.element, 'keyup', compare);

  var getSelectedDeltaType = function() {
    if (document.getElementById('show-delta-type-visual').checked) {
      return 'visual';
    }
    if (document.getElementById('show-delta-type-annotated').checked) {
      return 'annotated';
    }
    if (document.getElementById('show-delta-type-json').checked) {
      return 'json';
    }
  };

  var showSelectedDeltaType = function() {
    var type = getSelectedDeltaType();
    document.getElementById('delta-panel-visual').style.display =
      type === 'visual' ? '' : 'none';
    document.getElementById('delta-panel-annotated').style.display =
      type === 'annotated' ? '' : 'none';
    document.getElementById('delta-panel-json').style.display =
      type === 'json' ? '' : 'none';
    compare();
  };

  dom.on(document.getElementById('show-delta-type-visual'), 'click', showSelectedDeltaType);
  dom.on(document.getElementById('show-delta-type-annotated'), 'click', showSelectedDeltaType);
  dom.on(document.getElementById('show-delta-type-json'), 'click', showSelectedDeltaType);

  dom.on(document.getElementById('swap'), 'click', function() {
    var leftValue = areas.left.getValue();
    areas.left.setValue(areas.right.getValue());
    areas.right.setValue(leftValue);
    compare();
  });

  dom.on(document.getElementById('clear'), 'click', function() {
    areas.left.setValue('');
    areas.right.setValue('');
    compare();
  });

  dom.on(document.getElementById('showunchanged'), 'change', function() {
    jsondiffpatch.formatters.html.showUnchanged(document.getElementById('showunchanged').checked, null, 800);
  });

  dom.ready(function(){
    setTimeout(compare);
  }, 1);

  var load = {};

  load.data = function(data) {
    data = data || {};
    dom.text(document.getElementById('description'), data.description || '');
    if (data.url && trim(data.url).substr(0, 10) !== 'javascript') {
      document.getElementById('external-link').setAttribute('href', data.url);
      document.getElementById('external-link').style.display = '';
    } else {
      document.getElementById('external-link').style.display = 'none';
    }
    var leftValue = data.left ? (data.left.content || data.left) : '';
    areas.left.setValue(leftValue);
    var rightValue = data.right ? (data.right.content || data.right) : '';
    areas.right.setValue(rightValue);

    dom.text(document.getElementById('json-panel-left').querySelector('h2'), (data.left && data.left.name) || 'left.json');
    dom.text(document.getElementById('json-panel-right').querySelector('h2'), (data.right && data.right.name) || 'right.json');

    document.getElementById('json-panel-left').querySelector('h2').setAttribute(
      'title', (data.left && data.left.fullname) || '');
    document.getElementById('json-panel-right').querySelector('h2').setAttribute(
      'title', (data.right && data.right.fullname) || '');

    if (data.error) {
      areas.left.setValue('ERROR LOADING: ' + data.error);
      areas.right.setValue('');
    }
  };

  load.gist = function(id) {
    id = /\d+/.exec(id + '')[0];
    dom.getJson('https://api.github.com/gists/' + id, function(error, data) {
      if (error) {
        var message = error + ((data && data.message) ? data.message : '');
        load.data({
          error: message
        });
        return;
      }
      var filenames = [];
      for (var filename in data.files) {
        var file = data.files[filename];
        if (file.language === 'JSON') {
          filenames.push(filename);
        }
      }
      filenames.sort();
      var files = [
        data.files[filenames[0]],
        data.files[filenames[1]]
      ];
      /*jshint camelcase: false */
      load.data({
        url: data.html_url,
        description: data.description,
        left: {
          name: files[0].filename,
          content: files[0].content
        },
        right: {
          name: files[1].filename,
          content: files[1].content
        }
      });
    });
  };

  load.leftright = function(description, leftValue, rightValue) {
    try {
      description = decodeURIComponent(description || '');
      leftValue = decodeURIComponent(leftValue);
      rightValue = decodeURIComponent(rightValue);
      var urlmatch = /https?:\/\/.*\/([^\/]+\.json)(?:[\?#].*)?/;
      var dataLoaded = {
        description: description,
        left: {},
        right: {}
      };
      var loadIfReady = function() {
        if (typeof dataLoaded.left.content !== 'undefined' &&
          typeof dataLoaded.right.content !== 'undefined') {
          load.data(dataLoaded);
        }
      };
      if (urlmatch.test(leftValue)) {
        dataLoaded.left.name = urlmatch.exec(leftValue)[1];
        dataLoaded.left.fullname = leftValue;
        dom.getJson(leftValue, function(error, data) {
          if (error) {
            dataLoaded.left.content = error + ((data && data.message) ? data.message : '');
          } else {
            dataLoaded.left.content = JSON.stringify(data, null, 2);
          }
          loadIfReady();
        });
      } else {
        dataLoaded.left.content = leftValue;
      }
      if (urlmatch.test(rightValue)) {
        dataLoaded.right.name = urlmatch.exec(rightValue)[1];
        dataLoaded.right.fullname = rightValue;
        dom.getJson(rightValue, function(error, data) {
          if (error) {
            dataLoaded.right.content = error + ((data && data.message) ? data.message : '');
          } else {
            dataLoaded.right.content = JSON.stringify(data, null, 2);
          }
          loadIfReady();
        });
      } else {
        dataLoaded.right.content = rightValue;
      }
      loadIfReady();
    } catch (err) {
      load({
        error: err
      });
    }
  };

  load.key = function(key) {
    var matchers = {
      gist: /^(?:https?:\/\/)?(?:gist\.github\.com\/)?(?:[\w0-9\-]+\/)?(\d+)$/i,
      leftright: /^(?:desc=(.*)?&)?left=(.*)&right=(.*)&?$/i,
    };
    for (var loader in matchers) {
      var match = matchers[loader].exec(key);
      if (match) {
        return load[loader].apply(load, match.slice(1));
      }
    }
    load.data({
      error: 'unsupported source: ' + key
    });
  };

  var urlQuery = /^[^?]*\?([^\#]+)/.exec(document.location.href);
  if (urlQuery) {
    load.key(urlQuery[1]);
  } else {
    var exampleJson = getExampleJson();
    load.data({
      left: exampleJson[0],
      right: exampleJson[1]
    });
  }

  dom.on(document.getElementById('examples'), 'change', function() {
    var example = trim(this.value);
    switch (example) {
      case 'text':
        var exampleJson = getExampleJson();
        load.data({
          left: {
            name: 'left.txt',
            content: JSON.parse(exampleJson[0]).summary
          },
          right: {
            name: 'right.txt',
            content: JSON.parse(exampleJson[1]).summary
          }
        });
        break;
      case 'gist':
        document.location = '?benjamine/9188826';
        break;
      case 'moving':
        document.location = '?desc=moving%20around&left=' +
          encodeURIComponent(JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])) +
          '&right=' +
          encodeURIComponent(JSON.stringify([10, 0, 1, 7, 2, 4, 5, 6, 88, 9, 3]));
        break;
      case 'query':
        document.location = '?desc=encoded%20in%20url&left=' +
        /* jshint quotmark: false */
        encodeURIComponent(JSON.stringify({
          "don't": "abuse",
          "with": ["large", "urls"]
        })) +
          '&right=' +
          encodeURIComponent(JSON.stringify({
            "don't": "use",
            "with": [">", 2, "KB urls"]
          }));
        break;
      case 'urls':
        document.location = '?desc=http%20raw%20file%20urls&left=' +
          encodeURIComponent('https://rawgithub.com/benjamine/JsonDiffPatch/' +
            'c83e942971c627f61ef874df3cfdd50a95f1c5a2/package.json') +
          '&right=' +
          encodeURIComponent('https://rawgithub.com/benjamine/JsonDiffPatch/master/package.json');
        break;
      default:
        document.location = '?';
        break;
    }
  });
})();
