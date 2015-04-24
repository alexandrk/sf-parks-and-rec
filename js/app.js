var App = {};

/**
 * Park Model
 * @param obj - {
 *  parktype,
 *  parkname,
 *  parkid,
 *  location_1 {
 *    longitude,
 *    latitude,
 *    human_address {
 *      address,
 *      city,
 *      state
 *    },
 *    zipcode
 *  },
 *  acreage
 * }
 * @constructor
 */
var Park = function(obj)
{
  this.parktype   = obj.parktype;
  this.parkname   = obj.parkname;
  this.parkid     = obj.parkid;
  this.location   = {
    long:    obj.location_1.longitude,
    lat:     obj.location_1.latitude,
    address: obj.location_1.human_address.address,
    city:    obj.location_1.human_address.city,
    state:   obj.location_1.human_address.state,
    zip:     obj.zipcode
  };
  this.acreage    = obj.acreage;
};

/**
 * Centers Map on the location and adjust the zoom level
 */
Park.prototype.centerMap = function(){
  App.map.setCenter(new google.maps.LatLng(this.location.lat, this.location.long));
  App.map.setZoom(17);
};

/**
 * getParksList
 * Gets parks data from sfgov.org or local copy, if present and recent
 */
App.getParksList = function () {
  App.parksCollection = [];

  // Retrieve list of parks from sfgov.org website
  $.ajax({
    dataType: 'json',
    //async: false,

    // URL for parks data from sfgov API
    url: 'https://data.sfgov.org/resource/z76i-7s65.json',

    success: function(data) {
      data.forEach(function(item) {
        var park,
            content,
            infowindow;

        //Only process results with geo location data
        if (typeof item.location_1 === 'object') {

          // Exclude locations outside of SF
          if (
              item.parkname.toUpperCase() == 'CAMP MATHER' ||
              item.parkname.toUpperCase() == 'SHARP PARK'
          ) {
            return;
          }

          // Create new park object and add it to the list
          park = new Park(item);
          App.parksCollection.push(park);
        }
      });

      $('body').trigger('parksData:loaded');
    },

    error: function (xhr, textStatus, errorThrown) {
      console.log('Failed to get parks data!');
      console.log(errorThrown);
    }

  });
};

/** -----------------------------------| ViewModel |------------------------------ */

var parksVM = function() {

  var that = this;

  /**
   * Function: showList()
   * Description: displays the overflow list of all the parks
   * Note: used in mobile view only
   */
  that.showList = function () {
    $('#resultsWrapper').slideToggle('slow');
  };

  /**
   * Function: prepareResults()
   * Description: processes an array of parks data
   */
  that.prepareData = function() {
    var bounds = new google.maps.LatLngBounds();

    App.parksCollection.forEach(function(park) {

      park.mapMarker = createMarker(park);
      createInfoWindow(park);
      bounds.extend(park.mapMarker.position);

    });

    App.map.fitBounds(bounds);
  };

  /**
   * Function: createMarker()
   * @param park {park-object}
   * @returns {google.maps.Marker}
   * description: helper function, used to create a map marker
   */
  function createMarker(park) {
    return (
        new google.maps.Marker({
          position: new google.maps.LatLng(park.location.lat, park.location.long),
          map: App.map,
          title: park.parkname
        })
    );
  }

  /**
   * Function: createInfoWindow
   * @param park {park-object}
   * description: helper function, used to create info window
   */
  function createInfoWindow(park) {
    var content,
        infowindow;

    // Content for Each park info window
    content = "<h3>" + park.parkname + "</h3><br />"
    + "<div>Type: " + park.parktype + "</div>"
    + "<div>Size: " + park.acreage + " acres</div>"
    + "<div>Zip Code: " + park.location.zip + "</div>";

    // Creating an info window for each marker object,
    // with content coming from the template
    infowindow = new google.maps.InfoWindow({
      content: content,
      maxWidth: 200
    });

    // Adding a marker click event with content for the info window
    google.maps.event.addListener(park.mapMarker, 'mouseup', function() {
      infowindow.open(App.map, park.mapMarker);

      // Get Yelp Data for the park
      getYelpData(park);
    });
  }

  // Observable array of parks data
  that.parks = ko.observableArray(App.parksCollection);

  /**
   * Function: getYelpData(park)
   * @param park {park-object}
   * description: get yelp data for a location
   */
  function getYelpData(park) {
    //debugger;
    $.ajax({
      dataType: 'json',

      // URL for parks data from sfgov API
      url: 'https://sfparksrec.herokuapp.com/services/', //'http://localhost:4567/',
      data: {
        term: park.parkname,
        limit: 1
      },

      success: function(data) {
        console.log(data);
        if (data.businesses.length == 0) {
          console.log('ERROR: ' + "no Yelp data found!");
        }
        else {
          console.log(data.businesses[0].name, " rating: ", data.businesses[0].rating);
          console.log(data.region.center.latitude, " ", data.region.center.longitude);
          console.log(park.location.lat, " ", park.location.long);
          console.log(
              "lat, long [delta]: ",
              Math.abs(data.region.center.latitude - park.location.lat),
              Math.abs(data.region.center.longitude - park.location.long)
          );
          console.log(
              (
              Math.abs(data.region.center.latitude - park.location.lat) > 0.001 ||
              Math.abs(data.region.center.longitude - park.location.long) > 0.001
              ) ? 'false' : 'true'
          );
        }
      },

      error: function (xhr, textStatus, errorThrown) {
        console.log('Failed to get yelp data!');
        console.log(errorThrown);
      }

    });
  }


  /**
   * Function: resetMarkers()
   * @param map
   * description: helper function, resets map for all markers to null,
   *              then sets a map for a given list of parks
   */
  function resetMarkers(map) {
    App.parksCollection.forEach(function (item) {
      item.mapMarker.setMap(null);
    });

    that.parks().forEach(function(park) {
      park.mapMarker.setMap(map);
    });
  };

  /**
   * Function: filter()
   * @param input {string} - user's input
   * description: filters parks list to the ones matching user's input
   */
  that.filter = function(input) {
    if (input == "") {
      that.parks(App.parksCollection);
    }
    else {
      var options = {
        keys: ['parkname'],    // keys to search in
        threshold: 0.3
      };
      var f = new Fuse(App.parksCollection, options);
      that.parks(f.search(input));
    }
    resetMarkers(App.map);
  };
};

/** ----------------------------------| Map Related |----------------------------- */

/**
 * mapInit
 * @param container {string} - id of a map container
 * @param mapOptionsDefault {object} - map options, if empty -> uses default options
 */
function mapInit(container, mapOptionsDefault) {

  mapOptions = mapOptionsDefault || {
    center: new google.maps.LatLng(37.768920, -122.484255)
    , zoom: 15
    , mapTypeId: google.maps.MapTypeId.MAP      //TERRAIN
    //, disableDefaultUI: true
    , zoomControlOptions: {
      //position: google.maps.ControlPosition.BOTTOM_LEFT,
      style: google.maps.ZoomControlStyle.SMALL
    }
  };

  return new google.maps.Map(document.getElementById(container), mapOptions);
}

/** -----------------------------| UI Event Handlers |---------------------------- */
// Using 'keyup' to properly detect empty field event
$('#search-input').on('keyup', function(e)
{
  App.parksVM.filter(e.target.value);
  console.log(App.parksVM.parks().length);

});

/** -------------------------------| Execution Flow |---------------------------- */


// Initialize Google Map
App.map = mapInit('map-canvas');

App.getParksList();
App.parksVM = new parksVM();

// Do steps below only after the data for the parks is done loading
$('body').on('parksData:loaded', function()
{
  console.log('loaded');

  App.parksVM.prepareData();
  ko.applyBindings(App.parksVM);

})

//TODO: connect with yelp
//TODO: add events data (if time permits)