var App = {};

$(function(global) {

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
   * ViewModel
   --------------------------------------------------------------------------------
   */

  var parksVM = function(){

    /**
     * Function: showList
     * Description: displays the overflow list of all the parks
     * Note: used in mobile view only
     */
    this.showList = function(){
      $('#resultsWrapper').slideToggle('slow');
    };

    this.parks = ko.observableArray( App.parksCollection.slice() );
  };

  parksVM.prototype.setMarkerMap = function(map){

    App.parksCollection.forEach(function(item){
      item.mapMarker.setMap(null);
    });

    this.parks().forEach(function(item){
      item.mapMarker.setMap(map);
    })
  };

  parksVM.prototype.filter = function(input)
  {
    if (input == "")
    {
      this.parks(App.parksCollection);
    }
    else {
      var options = {
        keys: ['parkname']    // keys to search in
      };

      var f = new Fuse(App.parksCollection, options);
      this.parks(f.search(input));
    }

    this.setMarkerMap(App.map);
  };

  App.parksVM = new parksVM();
  App.parksVM.setMarkerMap(App.map);
  ko.applyBindings(App.parksVM);

  /**
   * getParksList
   * Gets parks data from sfgov.org or local copy, if present and recent
   */
  function getParksList(){
    App.parksCollection = [];

    $.ajax({
      dataType: 'json',
      //async: false,

      // URL for parks data from sfgov API
      url: 'https://data.sfgov.org/resource/z76i-7s65.json',

      success: function(data){

        var geocoder = new google.maps.Geocoder(),
            count = 0,
            bounds = new google.maps.LatLngBounds();

        data.forEach(function(item)
        {
          var park,
              content,
              infowindow;

          if (typeof item.location_1 === 'object'){

            // Exclude location outside of SF
            if (
              item.parkname.toUpperCase() == 'CAMP MATHER' ||
              item.parkname.toUpperCase() == 'SHARP PARK'
            ){
              return;
            }

            // Parsing address property of the object
            if (item.location_1){
              item.location_1.human_address = JSON.parse(item.location_1.human_address);
            }
            else {
              /**
               * FIX - use delay to get GEO data from google api and save it
               * to the address bit of the park data
               */
                //geocoder.geocode(
                //  { 'address': item.parkname + ', San Francisco, CA' },
                //  function(results, status){
                //    console.log(' status: ' + status);
                //    console.log('results: ' + results);
                //  }
                //);
              item.location_1 = {
                longtitude: "",
                latitude: "",
                human_address: {
                  address: "",
                  city: "",
                  state: ""
                }
              }
            }

            // Creating new Park object
            park = new Park(item);

            // Creating marker for each Park data object
            park.mapMarker = new google.maps.Marker({
              position: new google.maps.LatLng(park.location.lat, park.location.long),
              //map: App.map,
              title: park.parkname
            });

            content = "<h3>" + park.parkname + "</h3><br />"
            +"<div>Type: " + park.parktype + "</div>"
            +"<div>Size: " + park.acreage + " acres</div>"
            +"<div>Zip Code: " + park.location.zip + "</div>";

            // Creating an info window for each marker object,
            // with content coming from the template
            infowindow = new google.maps.InfoWindow({
              content: content,
              maxWidth: 200
            });

            // Add park coords to bounds object (used to zoom out the map to fit all markers)
            bounds.extend(park.mapMarker.position);

            // Adding a marker click event with content for the info window
            google.maps.event.addListener(park.mapMarker, 'mouseup', function(){
              infowindow.open(App.map, park.mapMarker);
            });

            // Adding park data object to collection
            App.parksCollection.push(park);
          }

          App.map.fitBounds(bounds);

        });
      },

      error: function (xhr, textStatus, errorThrown) {
        console.log('Failed to get parks data!');
        console.log(errorThrown);
      },

      complete: function(){
        $('body').trigger('parksData:loaded');
      }

    });
  }

  /**
   * Map Related
   --------------------------------------------------------------------------------
   */

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

  /**
   * UI Event Handlers
   --------------------------------------------------------------------------------
   */

    // Do steps below only after the data for the parks is done loading
    $('body').on('parksData:loaded', function(){


  });

  // UI event handlers
  $('#up-arrow').on('click', function()
  {
    $('#up-arrow').hide();
    $('#down-arrow').show();
    $('#resultsWrapper').animate({
      'top': '20%'
    });
  });

  $('#down-arrow').on('click', function()
  {
    $('#down-arrow').hide();
    $('#up-arrow').show();
    $('#resultsWrapper').animate({
      'top': '200%'
    });
  });

  $('#search-input').on('keypress', function(e)
  {
    App.parksVM.filter(e.target.value);
    console.log(App.parksVM.parks().length);

  });

  /**
   * Execution Flow
   --------------------------------------------------------------------------------
   */

  // Initialize Google Map
  App.map = mapInit('map-canvas');

  // Get Parks Data from sfgov.org website or use local copy, if present
  getParksList();

});