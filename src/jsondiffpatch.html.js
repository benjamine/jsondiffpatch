(function(){

    var factory = function(jdp) {
        
        var jdpHtml = {};

        jdpHtml.objectToHtml = function(desc, o){
            var container = document.createElement('div');
            if (desc) {
                var descspan = document.createElement('span');
                descspan.appendChild(document.createTextNode(desc + (o instanceof Array ? ' (array' + (o._key ? ', key=' + o._key : '') + ')' : '')));
                descspan.setAttribute('class', 'jsondiffpatch-property-name');
                container.appendChild(descspan);
            }
            
            if (typeof o == 'object') {
                // a node (object or array)
                var ul = document.createElement('ul');
                
                for (var prop in o) {
                    if (o.hasOwnProperty(prop)) {
                        var li = document.createElement('li');
                        li.appendChild(jdpHtml.objectToHtml(prop, o[prop]));
                        ul.appendChild(li);
                    }
                }
                if (ul.childNodes.length > 0) {
                    container.appendChild(ul);
                }
            }
            else {
                var elem = document.createElement('p');
                // unchanged
                var jsono = typeof JSON != 'undefined' ? JSON.stringify(o) : (o + ' (JSON not found)');

                elem.appendChild(document.createTextNode(jsono));
                container.appendChild(elem);
            }
            return container;
        };
        
        var diffNodeToHtml = function(desc, o, n, d){
        
            var container = document.createElement('div');
            var descspan = document.createElement('span');
            descspan.appendChild(document.createTextNode(desc + (n instanceof Array ? ' (array' + (n._key ? ', key=' + n._key : '') + ')' : '')));
            descspan.setAttribute('class', 'jsondiffpatch-property-name');
            container.appendChild(descspan);
            if (d instanceof Array) {
                // a added/modified/removed value
                var elem = document.createElement('p');
                if (d.length === 1) {
                    // added
                    container.setAttribute('class', 'jsondiffpatch-added');
                    elem.appendChild(jdpHtml.objectToHtml(null, d[0]));
                }
                else 
                    if (d.length == 2) {
                        // modified
                        container.setAttribute('class', 'jsondiffpatch-modified');
                        var d1 = document.createElement('div');
                        d1.setAttribute('class', 'jsondiffpatch-modified-original');
                        d1.appendChild(jdpHtml.objectToHtml(null, d[0]));
                        var d2 = document.createElement('div');
                        d2.setAttribute('class', 'jsondiffpatch-modified-new');
                        d2.appendChild(jdpHtml.objectToHtml(null, d[1]));
                        elem.appendChild(d1);
                        elem.appendChild(d2);
                    }
                    else 
                        if (d[2] === 0) {
                            // deleted
                            container.setAttribute('class', 'jsondiffpatch-deleted');
                            elem.appendChild(jdpHtml.objectToHtml(null, d[0]));
                        }
                        else 
                            if (d[2] === 2) {
                                // text diff
                                container.setAttribute('class', 'jsondiffpatch-textdiff');
                                var lines = d[0].split('\n'), lcount = lines.length;
                                
                                for (var i = 0; i < lcount; i++) {
                                    var lelem = document.createElement('span');
                                    if (lines[i][0] === '+') {
                                        lelem.setAttribute('class', 'jsondiffpatch-added');
                                    }
                                    else 
                                        if (lines[i][0] === '-') {
                                            lelem.setAttribute('class', 'jsondiffpatch-deleted');
                                        }
                                        else 
                                            if (lines[i][0] === '@') {
                                                lelem.setAttribute('class', 'jsondiffpatch-header');
                                            }
                                    
                                    lelem.appendChild(document.createTextNode(lines[i].substring(lines[i][0] !== '@' ? 1 : 0)));
                                    elem.appendChild(lelem);
                                }
                            }
                
                container.appendChild(elem);
            }
            else {
                // a node (object or array)
                var ul = document.createElement('ul');
                
                // only members in diff (skip unchanged members)
                container.setAttribute('class', d._t === 'a' ? 'jsondiffpatch-array' : 'jsondiffpatch-object');
                for (var prop in d) {
                    if (d.hasOwnProperty(prop) && prop !== '_t') {
                        var li = document.createElement('li');
                        li.appendChild(diffNodeToHtml(prop, jdp.getByKey(o, prop), jdp.getByKey(n, prop), d[prop]));
                        ul.appendChild(li);
                    }
                }
                
                // unchanged props
                if (typeof o == 'object') {
                    for (var prop in o) {
                        if (o.hasOwnProperty(prop) && prop !== '_t') {
                            var k = prop;
                            if (o instanceof Array && o._key) {
                                k = o[prop][o._key];
                            }
                            if (!d || !d.hasOwnProperty(k)) {
                                var li = document.createElement('li');
                                li.setAttribute('class', 'jsondiffpatch-unchanged');
                                li.appendChild(jdpHtml.objectToHtml(k, o[prop]));
                                ul.appendChild(li);
                            }
                        }
                    }
                }
                container.appendChild(ul);
            }
            return container;
        };
        
        jdpHtml.diffToHtml = function(o, n, d){
            var elem = diffNodeToHtml('root', o, n, d);
            elem.setAttribute('class', elem.getAttribute('class') + ' jsondiffpatch-visualdiff-root');
            return elem;
        }

        return jdpHtml;

    }
    
    if (typeof require === 'function' && typeof exports === 'object' && typeof module === 'object') {
        // CommonJS, eg: node.js
        module.exports = factory(require('./jsondiffpatch'));
    } else if (typeof define === 'function' && define['amd']) {
        // AMD
        define(['jsondiffpatch'], factory);
    } else {
        // browser global
        if (typeof jsondiffpatch == 'undefined'){
            window.jsondiffpatch = jdp = {};            
        } else {
            jdp = jsondiffpatch;
        }
        jdp.html = factory(jdp);
    }
    
})();
