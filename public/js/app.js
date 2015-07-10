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
    lng:    obj.location_1.longitude,
    lat:     obj.location_1.latitude,
    address: obj.location_1.human_address.address,
    city:    obj.location_1.human_address.city,
    state:   obj.location_1.human_address.state,
    zip:     obj.zipcode
  };
  this.acreage    = obj.acreage;
};

/**
 * Function: centerMap
 * description: Centers Map on the location and adjust the zoom level
 */
Park.prototype.centerMap = function(){
  App.map.setCenter(new google.maps.LatLng(this.location.lat, this.location.lng));
  App.map.setZoom(17);
};

/**
 * Function: getParksList
 * Description: Gets parks data from sfgov.org or local copy, if present and recent
 */
App.getParksList = function ()
{
  App.parksSimpleData = [];   //Temporary parks array, is discarded after park objects collection is created
  App.parksObjects = [];      //Resetting global parkCollection array, used to store unfiltered (whole) list of parks

  // If parks collection exists in the localStorage
  if (typeof localStorage['SFParksData'] !== 'undefined')
  {
    App.parksSimpleData = JSON.parse(localStorage['SFParksData']);
    $('body').trigger('parksData:loaded');
  }
  else
  {
    // Retrieve list of parks from sfgov.org website
    $.ajax({
      dataType: 'json',

      // URL for parks data from sfgov API
      url: 'https://data.sfgov.org/resource/z76i-7s65.json',

      success: function(data) {
        data.forEach(function(item)
        {
          //Only process results with geo location data
          if (typeof item.location_1 === 'object')
          {
            // Exclude locations outside of SF
            if (
                item.parkname.toUpperCase() == 'CAMP MATHER' ||
                item.parkname.toUpperCase() == 'SHARP PARK'
            ) {
              return;
            }
            //Push new item into array (easily serializable)
            App.parksSimpleData.push(item);
          }
        });

        //Store pre-processed data in localStorage
        localStorage['SFParksData'] = JSON.stringify(App.parksSimpleData);

        //Fire an event, signaling that parks data has been loaded
        $('body').trigger('parksData:loaded');
      },

      //TODO: update to show user friendly error message
      error: function (xhr, textStatus, errorThrown) {
        console.log('Failed to get parks data!');
        console.log(errorThrown);
      }

    });
  }

};

/** -----------------------------------| ViewModel |------------------------------ */

var parksVM = function() {

  // Creating a reference to parksVM
  var that = this;

  // Creating an observable array
  that.parks = ko.observableArray();

  /**
   * Function: prepareResults
   * Description: processes an array of simple parks data:
   *                - populates a collection with parks objects
   *                - adds items to map bounds collection, to set map zoom level to fit all items on screen
   *                - creates marker and attached event handler for infoWindow to each park object
   */
  that.prepareData = function()
  {
    App.mapBounds = new google.maps.LatLngBounds();

    App.parksSimpleData.forEach(function(item)
    {
      var park       = new Park(item);
      park.mapMarker = createMarker(park);

      google.maps.event.addListener(park.mapMarker, 'mouseup', that.showParkInfo.bind(park));

      App.parksObjects.push(park);
      App.mapBounds.extend(park.mapMarker.position);
    });

    // Removed, since only used only to get simple parks data from either LocalStorage or sfgov.org API
    delete App.parksSimpleData;

    // Setting the map zoom level to fit all locations (GOOGLE Maps API call)
    App.map.fitBounds(App.mapBounds);

    // Initializing observable array of parks data
    that.parks(App.parksObjects);
  };

  /**
   * Function: createMarker
   * Description: helper function, used to create a map marker
   * @param park {park-object}
   * @returns {google.maps.Marker}
   */
  function createMarker(park) {
    return (
        new google.maps.Marker({
          position: new google.maps.LatLng(park.location.lat, park.location.lng),
          map: App.map,
          title: park.parkname
        })
    );
  }

  /**
   * Function: showParkInfo
   * Description: 1. Changes zoom level
                  2. Displays park name / size
                  3. Displays nearby instagram photos
                  4. Displays yelp review and link to more info
   * @param park {park-object}
   */
  that.showParkInfo = function()
  {
    var park = this,
        $body = $('body');
    
    park.centerMap();
    proccessBasicInfo(park);
    $('#current-selection').show();

    // Display nearby instagram data
    getInstagramData(park, {test: true});
    $body.on('instagramData:loaded', function() {
      proccessInstagramData(park);
    });

    // Get Yelp Data (review and rating)
    getYelpData(park, {test: true});
    $body.on('yelpData:loaded', function() {
      processYelpData(park);
    });
  };

  /**
   * Function: resetMarkers
   * Description: helper function, resets map for all markers to null,
   *              then sets a map for a given list of parks
   * @param map
   */
  function resetMarkers(map) {
    App.parksObjects.forEach(function (item) {
      item.mapMarker.setMap(null);
    });

    that.parks().forEach(function(park) {
      park.mapMarker.setMap(map);
    });
  }

  /**
   * Function: filter
   * Description: filters parks list to the ones matching user's input
   * @param input {string} - user's input
   */
  that.filter = function(input) {
    if (input == "") {
      that.parks(App.parksObjects);
    }
    else {
      var options = {
        keys: ['parkname'],    // keys to search in
        threshold: 0.3
      };
      var f = new Fuse(App.parksObjects, options);
      that.parks(f.search(input));
    }
    resetMarkers(App.map);
  };

  /**
   * Function: showList()
   * Description: displays the overflow list of all the parks
   * Note: used in mobile view only (bound to navbar-toggle in the html view by knockout)
   */
  that.showList = function () {
    $('#resultsWrapper').slideToggle('slow');
  };

  /**
   * Computed Observable: parksInRows
   * Description:
   */
  that.parksInRows = ko.computed(function ()
  {
    var parks = that.parks(),
        results = [],
        row = [],
        numberOfCols = 3;

    for(var i = 0; i < parks.length; i += numberOfCols) {

      row = [];
      for (var j = 0; j < numberOfCols; ++j) {
        if (parks[i + j]) {
          row.push(parks[i + j]);
        }
      }
      results.push(row);

    }

    return results;
  });

};

/** -------------------------------| Resources Related |-------------------------- */

/**
 * Function: AppException
 * Description: used to create apps custom exceptions
 * @param message
 * @param name
 * @param type
 */
function AppException(message, source, type)
{
  type = type || 'danger';

  var content =
      '<div class="alert alert-'+ type +' alert-dismissible" role="alert">'
        + message
        + '<button type="button" class="close" aria-label="Close"><span aria-hidden="true">&times;</span></button>'
      +'</div>';

  $(content).hide().appendTo('#messages').fadeIn();
}

/**
 * Function: proccessBasicInfo
 * Description: Process and output basic park info from park-object
 * @param park {park-object}
 */
function proccessBasicInfo(park){
  var content;

  content = "<div class='row'>"
  + "<h3 class='col-xs-10'>" + park.parkname + "</h3>"
  + "<div class='col-xs-2 close'>x</div>"
  +"</div>";

  content += "<div id='breif-info' class='row'>"
  + "<div class='col-xs-4'><div class='table-header'>Type</div>" + park.parktype + "</div>"
  + "<div class='col-xs-4'><div class='table-header'>Size</div>" + park.acreage + " acres</div>"
  + "<div class='col-xs-4'><div class='table-header'>Zip Code</div>" + park.location.zip + "</div>"
  +"</div>";

  $('#current-selection .content').html(content);
}

/**
 * Function:    getInstagramData
 * Description: get's instagram data from instagram, based on park coords,
 *              if not already pooled and stored in the object
 * @param park    {park-object} - also used to pass instagram data back
 * @param params  {Object} - used to passed extra data to the function
 */
function getInstagramData(park, params)
{
  var resource_INSTAGRAM;
  resource_INSTAGRAM = (params.test) ?
      "http://localhost:4567/instagram" :
      "https://sfparksrec.herokuapp.com/instagram";

  var $sliderContainer = $('#slider1_container');

  /**
   * Function: calculateSearchRadius
   * Description: Calculates instagram search radius in meters based on acreage of the park
   * Note: Default >= 30
   * @param acreage {Number} - park size
   * @returns {Number} - radius for instagram search query
   */
  function calculateSearchRadius(acreage){
    var meterRadius = parseInt(Math.sqrt(acreage * 4046.86) / 3.14);
    return (meterRadius > 30) ? meterRadius : 30;
  }

  if (typeof park.instaData === 'undefined') {
    $.ajax({
      dataType: 'json',
      async: true,
      url: resource_INSTAGRAM,
      data: {
        lat: park.location.lat,
        lng: park.location.lng,
        distance: calculateSearchRadius(park.acreage)
      },

      beforeSend: function () {
        $sliderContainer.html(
            '<div class="loading">'
            + '<img src="images/spinner.gif" />'
            + '<h4>Loading Instagram Data</h4>'
            + '</div>');
      },

      success: function (data) {
        var instaData = [];
        //Saving only the minimum instagram data required
        data.forEach(function (item) {
          instaData.push(
              {
                images: {
                  standard_resolution: {
                    url: item.images.standard_resolution.url
                  },
                  thumbnail: {
                    url: item.images.thumbnail.url
                  }
                }
              }
          );
        });
        park.instaData = instaData;
        $('body').trigger('instagramData:loaded');
      },

      error: function (xhr, textStatus, errorThrown) {
        AppException('ERROR: Could not get Instagram data, please check internet connection', 'INSTAGRAM:AJAX');
        $sliderContainer.html('');
      }

    });
  }
}

/**
 * Function:    processInstagramData
 * Description: proccesses instagram data and outputs the final html
 * @param park  {park-object}
 */
function proccessInstagramData(park)
{
  var $sliderContainer = $('#slider1_container');

  //Clearing slides container (to prevent pictures from a different location to be displayed)
  $sliderContainer.html('');

  //Recreating the slideshow scaffolding
  $sliderContainer.html(
      '<div id="insta-slides" u="slides" style="cursor: move; position: absolute; overflow: hidden; left: 0px; top: 0px; width: 500px; height: 500px;"></div>'
      + '<div u="thumbnavigator" class="jssort01" style="left: 0px; bottom: 0px;">'
      +   '<div u="slides" style="cursor: default;">'
      +     '<div u="prototype" class="p">'
      +       '<div class=w><div u="thumbnailtemplate" class="t"></div></div>'
      +       '<div class=c></div>'
      +     '</div>'
      +   '</div>'
      + '</div>'
  );

  //Looping over instagram data to display images and their thumbnails
  park.instaData.forEach(function(item){
    $('#insta-slides').append(
        "<div>" +
        "<img u='image' src='"+ item.images.standard_resolution.url + "' />" +
        "<img u='thumb' src='" + item.images.thumbnail.url + "' />" +
        "</div>"
    );
  });

  //Initializing slideshow
  initializeSlider('slider1_container');
}

/**
 * Function: getYelpData(park)
 * Description: get yelp data for a location
 * @param park {park-object}
 * @param params  {Object} - used to passed extra data to the function
 */
function getYelpData(park, params)
{
  var resource_YELP;
  resource_YELP = (params.test) ?
      "http://localhost:4567/yelp" :
      "https://sfparksrec.herokuapp.com/yelp";
  var $yelpData = $('#current-selection').find('.yelp-data');

    if (typeof park.yelpData === 'undefined') {
      $.ajax({
        dataType: 'json',
        async: true,
        url: resource_YELP,

        data: {
          term: park.parkname,
          limit: 1
        },

        beforeSend: function () {
          $yelpData.html(
              '<div class="loading">'
              + '<img src="images/spinner.gif" />'
              + '<h4>Loading Yelp Data</h4>'
              + '</div>');
        },

        success: function (data) {
          var yelpData;
          if (data.businesses.length == 0) {
            AppException('No YELP data found for this park', 'YELP:AJAX');
          }
          else {
            // Approximating if data received is the data we need, based on proximity to parks given coordinates
            var accuracyTrigger = (Math.abs(data.region.center.latitude - park.location.lat) > 0.0025
                                  || Math.abs(data.region.center.longitude - park.location.lng) > 0.003);

            console.log('yelp lat: ' + data.region.center.latitude +' park lat: '+ park.location.lat);
            console.log('yelp lat: ' + data.region.center.longitude +' park lat: '+ park.location.lng);

            console.log('accuracy lat: '+ Math.abs(data.region.center.latitude - park.location.lat));
            console.log('accuracy lng: '+ Math.abs(data.region.center.longitude - park.location.lng));

            // Display a warning, when accuracy is higher than predefined range.
            if (accuracyTrigger){
              AppException('WARNING: Low Accuracy, YELP result might be for a different entity.', 'YELP:AJAX', 'warning');
            }

            yelpData = data.businesses[0];

            // Filtered park yelp data
            park.yelpData = {
              name: yelpData.name,
              img: yelpData.image_url,
              url: yelpData.url,
              rating: yelpData.rating,
              rating_img: yelpData.rating_img_url,
              review_count: yelpData.review_count,
              example_review: yelpData.snippet_text
            }
          }
          $('body').trigger('yelpData:loaded');
        },

        error: function (xhr, textStatus, errorThrown) {
          AppException('ERROR: Could not get YELP data, please check internet connection.', 'YELP:AJAX');
          $yelpData.html('');
        }

      });
    }
}

/**
 * Function: proccessYelpData
 * @param park
 */
function processYelpData(park){
  var yelpData;
  if (typeof park.yelpData !== 'undefined') {
    yelpData = "<div class='row'>"
    + "<div class='col-xs-4'>" + park.yelpData.name + "</div>"
    +   "<div class='col-xs-4'><img src='" + park.yelpData.rating_img + "' /></div>"
    +   "<div class='col-xs-4'>" + park.yelpData.review_count + " reviews</div>"
    + "</div>"
    + "<div class='example-review'>" + park.yelpData.example_review
    +   "<a href='" + park.yelpData.url + "' target='_blank'> Read More" + "</a>"
    + "</div>";
    $('#current-selection').find('.yelp-data').html(yelpData);
  }
}


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

$('#current-selection').on('click', '.close', function(e)
{
  $('#current-selection').hide();
  App.map.fitBounds(App.mapBounds);
});

$('#messages').on('click', '.close', function(e)
{
  $(e.target).parents('.alert').remove();
});

// Do steps below only after the data for the parks is done loading
$('body').on('parksData:loaded', function()
{
  App.parksVM.prepareData();
  ko.applyBindings(App.parksVM);

});

function initializeSlider(containerId)
{
  var options = {
    $AutoPlay: false,                     //[Optional] To enable slideshow, this option must be set to true, default value is false
    $SlideDuration: 500,                  //[Optional] Specifies default duration (swipe) for slide in milliseconds, default value is 500

    $ThumbnailNavigatorOptions: {         //[Optional] Options to specify and enable thumbnail navigator or not
      $Class: $JssorThumbnailNavigator$,  //[Required] Class to create thumbnail navigator instance
      $ChanceToShow: 2,                   //[Required] 0 Never, 1 Mouse Over, 2 Always

      $ActionMode: 1,                     //[Optional] 0 None, 1 act by click, 2 act by mouse hover, 3 both, default value is 1
      $SpacingX: 8,                       //[Optional] Horizontal space between each thumbnail in pixel, default value is 0
      $DisplayPieces: 7,                  //[Optional] Number of pieces to display, default value is 1
      $ParkingPosition: 220               //[Optional] The offset position to park thumbnail
    }
  };

  var jssor_slider1 = new $JssorSlider$(containerId, options);

  function ScaleSlider() {
    var parentWidth = $('#slider1_container').parent().width();
    if (parentWidth) {
      jssor_slider1.$ScaleWidth(parentWidth);
    }
    else
      window.setTimeout(ScaleSlider, 30);
  }

  //Scale slider after document ready
  ScaleSlider();

  //Setting blnScaleSlider so that events wouldn't be attached multiple times
  //if (typeof window.blnScaleSlider === 'undefined'){
    //Scale slider while window load/resize/orientationchange.
    $(window).bind("load",              ScaleSlider);
    $(window).bind("resize",            ScaleSlider);
    $(window).bind("orientationchange", ScaleSlider);

  //  //window.blnScaleSlider = 1;
  //}

}

/** -------------------------------| Execution Flow |---------------------------- */


// Initialize Google Map
App.map = mapInit('map-canvas');

App.parksVM = new parksVM();
App.getParksList();

//TODO: add events data (if time permits)