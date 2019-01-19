(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['video.js'], factory);
  } else if (typeof exports !== "undefined") {
    factory(require('video.js'));
  } else {
    var mod = {
      exports: {}
    };
    factory(global.videojs);
    global.videojsMarkers = mod.exports;
  }
})(this, function (_video) {
  /*! videojs-markers - v1.0.1 - 2018-07-11
  * Copyright (c) 2018 ; Licensed  */
  'use strict';

  var _video2 = _interopRequireDefault(_video);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  };

  // default setting
  var defaultSetting = {
    markerStyle: {
      'width': '7px',
      'border-radius': '30%',
      'background-color': 'red'
    },
    markerTip: {
      display: true,
      text: function text(marker) {
        return "Break: " + marker.text;
      },
      time: function time(marker) {
        return marker.time;
      }
    },
    breakOverlay: {
      display: false,
      displayTime: 3,
      text: function text(marker) {
        return "Break overlay: " + marker.overlayText;
      },
      style: {
        'width': '100%',
        'height': '20%',
        'background-color': 'rgba(0,0,0,0.7)',
        'color': 'white',
        'font-size': '17px'
      }
    },
    onMarkerClick: function onMarkerClick(marker) { },
    onMarkerReached: function onMarkerReached(marker, index) { },
    onMarkerTextKeyPress: function onMarkerTextKeyPress(marker, index) { },
    onMarkerTextClick: function onMarkerTextClick(marker, index) { },
    onMarkerTextDeleted: function onMarkerTextDeleted(marker, index) { },
    markers: [],
    rightThreshold: 80, //percent
    bookmarkPlaceHolder: 'enter bookmark title'
  };

  /**
   * Returns the size of an element and its position
   * a default Object with 0 on each of its properties
   * its return in case there's an error
   * @param  {Element} element  el to get the size and position
   * @return {DOMRect|Object}   size and position of an element
   */
  function getElementBounding(element) {
    var elementBounding;
    var defaultBoundingRect = {
      top: 0,
      bottom: 0,
      left: 0,
      width: 0,
      height: 0,
      right: 0
    };

    try {
      elementBounding = element.getBoundingClientRect();
    } catch (e) {
      elementBounding = defaultBoundingRect;
    }

    return elementBounding;
  }

  var NULL_INDEX = -1;

  function registerVideoJsMarkersPlugin(options) {
    // copied from video.js/src/js/utils/merge-options.js since
    // videojs 4 doens't support it by defualt.
    if (!_video2.default.mergeOptions) {
      var isPlain = function isPlain(value) {
        return !!value && (typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'object' && toString.call(value) === '[object Object]' && value.constructor === Object;
      };

      var mergeOptions = function mergeOptions(source1, source2) {

        var result = {};
        var sources = [source1, source2];
        sources.forEach(function (source) {
          if (!source) {
            return;
          }
          Object.keys(source).forEach(function (key) {
            var value = source[key];
            if (!isPlain(value)) {
              result[key] = value;
              return;
            }
            if (!isPlain(result[key])) {
              result[key] = {};
            }
            result[key] = mergeOptions(result[key], value);
          });
        });
        return result;
      };

      _video2.default.mergeOptions = mergeOptions;
    }

    if (!_video2.default.createEl) {
      _video2.default.createEl = function (tagName, props, attrs) {
        var el = _video2.default.Player.prototype.createEl(tagName, props);
        if (!!attrs) {
          Object.keys(attrs).forEach(function (key) {
            el.setAttribute(key, attrs[key]);
          });
        }
        return el;
      };
    }

    /**
     * register the markers plugin (dependent on jquery)
     */
    var setting = _video2.default.mergeOptions(defaultSetting, options),
      markersMap = {},
      markersList = [],
      // list of markers sorted by time
      currentMarkerIndex = NULL_INDEX,
      player = this,
      markerTip = null,
      breakOverlay = null,
      overlayIndex = NULL_INDEX;

    player.marker_clicked = false;// true when click marker at progress bar of video.

    function sortMarkersList() {
      // sort the list by time in asc order
      markersList.sort(function (a, b) {
        return setting.markerTip.time(a) - setting.markerTip.time(b);
      });
    }

    function addMarkers(newMarkers) {
      newMarkers.forEach(function (marker) {
        player.el().querySelector('.vjs-progress-control').appendChild(createMarkerDiv(marker));

        // store marker in an internal hash map
        markersMap[marker.key] = marker;
        markersList.push(marker);
      });

      sortMarkersList();
    }

    function getPosition(marker) {
      return setting.markerTip.time(marker) / player.duration() * 100;
    }

    function setMarkderDivStyle(marker, markerDiv) {
      markerDiv.className = 'vjs-bookmark ' + (marker.class || "");

      var textarea = _video2.default.createEl('textarea', {
        className: 'marker-content',
        innerText: marker.text,
        'placeholder': setting.bookmarkPlaceHolder,
        name: 'bookmark_title'
      }, {
          'marker-id': marker.key,
          'maxlength': 140
        });

      var deleteIcon = _video2.default.createEl('button', {
        className: 'fa fa-trash',
        id: 'delete-icon-' + marker.key,
        title: 'Delete'
      });

      var checkIcon = _video2.default.createEl('span', {
        className: 'fa fa-check',
        id: 'check-icon-' + marker.key
      });

      var label = _video2.default.createEl('label', {
        className: 'sr-only',
        for: 'bookmark_title',
        innerText: 'Bookmark title'
      });

      var bookmarkIcon = _video2.default.createEl('span', {
        className: 'fa fa-bookmark'
      });

      var textCounter = _video2.default.createEl('span', {
        className: 'vjs-bookmark__content__counter',
        id: 'text-counter-' + marker.key,
        innerText: 140 - textarea.value.length
      });

      var bookMarkContent = _video2.default.createEl('div', {
        className: 'vjs-bookmark__content',
        id: 'marker-tip-' + marker.key
      });

      bookMarkContent.appendChild(bookmarkIcon);
      bookMarkContent.appendChild(label);
      bookMarkContent.appendChild(textarea);
      bookMarkContent.appendChild(textCounter);
      bookMarkContent.appendChild(deleteIcon);
      bookMarkContent.appendChild(checkIcon);

      var container = _video2.default.createEl('div', {});
      container.appendChild(bookMarkContent);

      markerDiv.appendChild(container);

      if (typeof setting.onMarkerTextKeyPress === "function") {
        // if return false, prevent default behavior
        textarea.addEventListener('keydown', function (event) {
          setting.onMarkerTextKeyPress(event, textarea, textCounter);

          setTimeout(function () {
            var el = event.target;
            el.style.cssText = 'word-break:break-word;height:' + (el.scrollHeight - 1) + 'px';
            textCounter.innerText = 140 - textarea.value.length;
          }, 0);
        });
      }

      if (typeof setting.onMarkerTextClick === 'function') {
        textarea.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();

          setting.onMarkerTextClick(event, textarea);
        });
      }

      if (typeof setting.onMarkerTextDeleted === 'function') {
        deleteIcon.addEventListener('click', function (event) {
          setting.onMarkerTextDeleted(event, textarea, textCounter);
        });
      }

      Object.keys(setting.markerStyle).forEach(function (key) {
        markerDiv.style[key] = setting.markerStyle[key];
      });

      // hide out-of-bound markers
      var ratio = marker.time / player.duration();
      if (ratio < 0 || ratio > 1) {
        markerDiv.style.display = 'none';
      }

      // set position
      var leftPercent = getPosition(marker);
      if (leftPercent <= setting.rightThreshold) {
        markerDiv.style.left = getPosition(marker) + '%';
      } else {
        markerDiv.style.right = 100 - getPosition(marker) + '%';
        bookMarkContent.style.right = '100%';
      }

      if (marker.duration) {
        markerDiv.style.width = marker.duration / player.duration() * 100 + '%';
        markerDiv.style.marginLeft = '0px';
      } else {
        var markerDivBounding = getElementBounding(markerDiv);
        markerDiv.style.marginLeft = markerDivBounding.width / 2 + 'px';
      }

      // if marker text have content then calculate height of textarea.
      if (marker.text) {
        var text = marker.text;
        var div = $('<div id="temp"></div>');
        div.css({
          "width": "25.5em",
          "font-size": "1.25em",
          "padding": ".5em 3.75em .5em 1.75em",
          "line-height": "1",
          "display": "none"
        });

        div.text(text);
        $('body').append(div);
        var divOuterHeight = $('#temp').outerHeight();
        div.remove();
        textarea.style.cssText = `height:${divOuterHeight - 1}px;word-wrap: break-word;`
      }
    }

    function createMarkerDiv(marker) {

      var markerDiv = _video2.default.createEl('div', {}, {
        'data-marker-id': marker.key,
        'data-marker-time': setting.markerTip.time(marker)
      });

      setMarkderDivStyle(marker, markerDiv);

      // bind click event to seek to marker time
      markerDiv.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var preventDefault = false;

        if (typeof setting.onMarkerClick === "function") {
          // if return false, prevent default behavior
          preventDefault = setting.onMarkerClick(event, marker) === false;
          player.marker_clicked = true;
          var markerContent = markerDiv.querySelector('.marker-content')
          markerContent.focus();

          markerDiv.addEventListener('mouseover', function (e) {
            markerDiv.classList.add('vjs-bookmark--focus');

            markerDiv.querySelector('.fa-trash').classList.remove('hide');
            markerDiv.querySelector('.vjs-bookmark__content').classList.remove('hide');
            markerDiv.querySelector('.fa-check').classList.remove('show');
          });

          markerDiv.addEventListener('mouseout', function (event) {
            if (player.marker_clicked) {
              markerDiv.classList.add('vjs-bookmark--focus');
            }
          });
          
          markerContent.addEventListener('blur', (event) => {
            event.stopPropagation();
            event.preventDefault();

            if (event.relatedTarget != null) {
              var id = event.relatedTarget.id;

              if (id && id.indexOf('delete-icon') !== -1) {
                return
              }
            }

            markerDiv.classList.remove('vjs-bookmark--focus');
            player.marker_clicked = false;
            player.play();
          })
        }

        if (!preventDefault) {
          var key = this.getAttribute('data-marker-id');
          player.currentTime(setting.markerTip.time(markersMap[key]));
        }
      });

      if (setting.markerTip.display) {
        registerMarkerTipHandler(markerDiv);
      }

      return markerDiv;
    }

    function updateMarkers(force) {
      // update UI for markers whose time changed
      markersList.forEach(function (marker) {
        var markerDiv = player.el().querySelector(".vjs-bookmark[data-marker-id='" + marker.key + "']");
        var markerTime = setting.markerTip.time(marker);

        if (force || markerDiv.getAttribute('data-marker-time') !== markerTime) {
          setMarkderDivStyle(marker, markerDiv);
          markerDiv.setAttribute('data-marker-time', markerTime);
        }
      });
      sortMarkersList();
    }

    function _removeByKey(key) {
      var totalMarkers = markersList.length;
      var indexes = [];
      for (var i = 0; i < totalMarkers; i++) {
        if (markersList[i].key === key) {
          indexes.push(i);
          break;
        }
      }

      if (indexes.length > 0) {
        removeMarkers(indexes);
      }
    }

    function removeMarkers(indexArray) {
      // reset overlay
      if (!!breakOverlay) {
        overlayIndex = NULL_INDEX;
        breakOverlay.style.visibility = "hidden";
      }
      currentMarkerIndex = NULL_INDEX;

      var deleteIndexList = [];
      indexArray.forEach(function (index) {
        var marker = markersList[index];
        if (marker) {
          // delete from memory
          delete markersMap[marker.key];
          deleteIndexList.push(index);

          // delete from dom
          var el = player.el().querySelector(".vjs-bookmark[data-marker-id='" + marker.key + "']");
          el && el.parentNode.removeChild(el);
        }
      });

      // clean up markers array
      deleteIndexList.reverse();
      deleteIndexList.forEach(function (deleteIndex) {
        markersList.splice(deleteIndex, 1);
      });

      // sort again
      sortMarkersList();
    }

    // attach hover event handler
    function registerMarkerTipHandler(markerDiv) {
      markerDiv.addEventListener('mouseover', function (e) {
        // prevent mouseover trigger in child element of current element.
        if (e.target !== this) {
          markerDiv.classList.remove('vjs-bookmark--focus');
          return;
        }

        $('.vjs-bookmark').removeClass('vjs-bookmark--focus');
        markerDiv.classList.add('vjs-bookmark--focus');

        markerDiv.querySelector('.fa-trash').classList.remove('hide');
        markerDiv.querySelector('.vjs-bookmark__content').classList.remove('hide');
        markerDiv.querySelector('.fa-check').classList.remove('show');
      });

      markerDiv.addEventListener('mouseout', function (event) {
        if (!player.marker_clicked) {
          markerDiv.classList.remove('vjs-bookmark--focus');
        }
      });
    }

    // show or hide break overlays
    function updateBreakOverlay() {
      if (!setting.breakOverlay.display || currentMarkerIndex < 0) {
        return;
      }

      var currentTime = player.currentTime();
      var marker = markersList[currentMarkerIndex];
      var markerTime = setting.markerTip.time(marker);

      if (currentTime >= markerTime && currentTime <= markerTime + setting.breakOverlay.displayTime) {
        if (overlayIndex !== currentMarkerIndex) {
          overlayIndex = currentMarkerIndex;
          if (breakOverlay) {
            breakOverlay.querySelector('.vjs-break-overlay-text').innerHTML = setting.breakOverlay.text(marker);
          }
        }

        if (breakOverlay) {
          breakOverlay.style.visibility = "visible";
        }
      } else {
        overlayIndex = NULL_INDEX;
        if (breakOverlay) {
          breakOverlay.style.visibility = "hidden";
        }
      }
    }

    // problem when the next marker is within the overlay display time from the previous marker
    function initializeOverlay() {
      breakOverlay = _video2.default.createEl('div', {
        className: 'vjs-break-overlay',
        innerHTML: "<div class='vjs-break-overlay-text'></div>"
      });
      Object.keys(setting.breakOverlay.style).forEach(function (key) {
        if (breakOverlay) {
          breakOverlay.style[key] = setting.breakOverlay.style[key];
        }
      });
      player.el().appendChild(breakOverlay);
      overlayIndex = NULL_INDEX;
    }

    function onTimeUpdate() {
      onUpdateMarker();
      updateBreakOverlay();
      options.onTimeUpdateAfterMarkerUpdate && options.onTimeUpdateAfterMarkerUpdate();
    }

    function onUpdateMarker() {
      /*
        check marker reached in between markers
        the logic here is that it triggers a new marker reached event only if the player
        enters a new marker range (e.g. from marker 1 to marker 2). Thus, if player is on marker 1 and user clicked on marker 1 again, no new reached event is triggered)
      */
      if (!markersList.length) {
        return;
      }

      var getNextMarkerTime = function getNextMarkerTime(index) {
        if (index < markersList.length - 1) {
          return setting.markerTip.time(markersList[index + 1]);
        }
        // next marker time of last marker would be end of video time
        return player.duration();
      };
      var currentTime = player.currentTime();
      var newMarkerIndex = NULL_INDEX;

      if (currentMarkerIndex !== NULL_INDEX) {
        // check if staying at same marker
        var nextMarkerTime = getNextMarkerTime(currentMarkerIndex);
        if (currentTime >= setting.markerTip.time(markersList[currentMarkerIndex]) && currentTime < nextMarkerTime) {
          return;
        }

        // check for ending (at the end current time equals player duration)
        if (currentMarkerIndex === markersList.length - 1 && currentTime === player.duration()) {
          return;
        }
      }

      // check first marker, no marker is selected
      if (currentTime < setting.markerTip.time(markersList[0])) {
        newMarkerIndex = NULL_INDEX;
      } else {
        // look for new index
        for (var i = 0; i < markersList.length; i++) {
          nextMarkerTime = getNextMarkerTime(i);
          if (currentTime >= setting.markerTip.time(markersList[i]) && currentTime < nextMarkerTime) {
            newMarkerIndex = i;
            break;
          }
        }
      }

      // set new marker index
      if (newMarkerIndex !== currentMarkerIndex) {
        // trigger event if index is not null
        if (newMarkerIndex !== NULL_INDEX && options.onMarkerReached) {
          options.onMarkerReached(markersList[newMarkerIndex], newMarkerIndex);
        }
        currentMarkerIndex = newMarkerIndex;
      }
    }

    // setup the whole thing
    function initialize() {
      // if (setting.markerTip.display) {
      //   initializeMarkerTip();
      // }

      // remove existing markers if already initialized
      player.markers.removeAll();
      addMarkers(setting.markers);

      if (setting.breakOverlay.display) {
        initializeOverlay();
      }
      onTimeUpdate();
      player.on("timeupdate", onTimeUpdate);
      player.off("loadedmetadata");
    }

    // setup the plugin after we loaded video's meta data
    player.on("loadedmetadata", function () {
      initialize();
    });

    // exposed plugin API
    player.markers = {
      getMarkers: function getMarkers() {
        return markersList;
      },
      next: function next() {
        // go to the next marker from current timestamp
        var currentTime = player.currentTime();
        for (var i = 0; i < markersList.length; i++) {
          var markerTime = setting.markerTip.time(markersList[i]);
          if (markerTime > currentTime) {
            player.currentTime(markerTime);
            break;
          }
        }
      },
      prev: function prev() {
        // go to previous marker
        var currentTime = player.currentTime();
        for (var i = markersList.length - 1; i >= 0; i--) {
          var markerTime = setting.markerTip.time(markersList[i]);
          // add a threshold
          if (markerTime + 0.5 < currentTime) {
            player.currentTime(markerTime);
            return;
          }
        }
      },
      add: function add(newMarkers) {
        // add new markers given an array of index
        addMarkers(newMarkers);
      },
      remove: function remove(indexArray) {
        // remove markers given an array of index
        removeMarkers(indexArray);
      },
      removeByKey: function removeByKey(key) {
        _removeByKey(key);
      },
      removeAll: function removeAll() {
        var indexArray = [];
        for (var i = 0; i < markersList.length; i++) {
          indexArray.push(i);
        }
        removeMarkers(indexArray);
      },
      // force - force all markers to be updated, regardless of if they have changed or not.
      updateTime: function updateTime(force) {
        // notify the plugin to update the UI for changes in marker times
        updateMarkers(force);
      },
      reset: function reset(newMarkers) {
        // remove all the existing markers and add new ones
        player.markers.removeAll();
        addMarkers(newMarkers);
      },
      destroy: function destroy() {
        // unregister the plugins and clean up even handlers
        player.markers.removeAll();
        breakOverlay && breakOverlay.remove();
        markerTip && markerTip.remove();
        player.off("timeupdate", updateBreakOverlay);
        delete player.markers;
      }
    };
  }

  _video2.default.plugin('markers', registerVideoJsMarkersPlugin);
});
//# sourceMappingURL=videojs-markers.js.map