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
  App.parks = [];
  App.parksCollection = [];

  // If parks collection exists in the localStorage
  if (typeof localStorage['SFParksData'] !== 'undefined')
  {
    App.parks = JSON.parse(localStorage['SFParksData']);
    $('body').trigger('parksData:loaded');
  }
  else
  {
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

            //Push new item into array (easily serializable)
            App.parks.push(item);
          }
        });

        //Store pre-processed data in localStorage
        localStorage['SFParksData'] = JSON.stringify(App.parks);

        //Fire an event, signaling that parks data has been loaded
        $('body').trigger('parksData:loaded');
      },

      error: function (xhr, textStatus, errorThrown) {
        console.log('Failed to get parks data!');
        console.log(errorThrown);
      }

    });
  }

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

    App.parks.forEach(function(item)
    {
      // Create park object and store it in the collection
      var park = new Park(item);
      App.parksCollection.push(park);

      park.mapMarker = createMarker(park);
      createInfoWindow(park);


      bounds.extend(park.mapMarker.position);

    });

    delete App.parks;

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
  function createInfoWindow(park)
  {
    // Adding a marker click event with content for the info window
    google.maps.event.addListener(park.mapMarker, 'mouseup', function()
    {
      //1. Change zoom level
      //2. Display park name / size
      //3. Display nearby instagram photos
      //4. Display yelp review and link to more info

      park.centerMap();
      proccessBasicInfo(park);
      $('#current-selection').show();

      // Display nearby instagram data
      getInstagramData(park, {test: true});
      $('body').on('instagramData:loaded', function() {
        proccessInstagramData(park);
      });

      // Get Yelp Data (review and rating)
      getYelpData(park);
      $('body').on('yelpData:loaded', function() {
        processYelpData(park);
      });

    });
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

    //Calculates Instagram search radius in meters based on acreage of the park
    function calculateSearchRadius(acreage){
      var meterRadius = parseInt(Math.sqrt(acreage * 4046.86) / 3.14);
      return (meterRadius > 30) ? meterRadius : 30;
    }

    $.ajax({
      dataType: 'json',
      async:    true,
      url:      resource_INSTAGRAM,
      data: {
        lat:      park.location.lat,
        lng:      park.location.long,
        distance: calculateSearchRadius(park.acreage)
      },

      beforeSend: function() {
        $('#slider1_container').html(
            '<div class="loading">'
            + '<img src="images/spinner.gif" />'
            + '<h4>Loading Instagram Data</h4>'
            +'</div>');
      },
      complete: function() {
        $('#slider1_container').html();
      },

      success: function(data)
      {
        var instaData = [];
        //Saving only the minimum instagram data required
        data.forEach(function(item){
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
        console.log('Failed to get instagram data!');
        console.log(errorThrown);
      }

    });
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
    $sliderContainer.html();

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

  // Observable array of parks data
  that.parks = ko.observableArray(App.parksCollection);

  /**
   * Function: getYelpData(park)
   * Description: get yelp data for a location
   * @param park {park-object}
   */
  function getYelpData(park) {
    var resource_YELP,
      test = true;

    resource_YELP = (test) ? "http://localhost:4567/yelp" : "https://sfparksrec.herokuapp.com/yelp";

    $.ajax({
      dataType: 'json',
      async: true,

      // URL for YELP service to get the data from
      url: resource_YELP,

      data: {
        term: park.parkname,
        limit: 1
      },

      beforeSend: function() {
        $('#current-selection .yelp-data').html(
            '<div class="loading">'
            + '<img src="images/spinner.gif" />'
            + '<h4>Loading Yelp Data</h4>'
            +'</div>');
      },
      complete: function() {
        $('#current-selection .yelp-data').html();
      },

      success: function(data) {

        var yelpData;

        console.log(data);
        if (data.businesses.length == 0) {
          console.log('ERROR: ' + "no Yelp data found!");
        }
        else {
          console.log(data.businesses[0].name, "rating:", data.businesses[0].rating
            , "based on", data.businesses[0].review_count, "reviews");
          console.log(data.region.center.latitude, " ", data.region.center.longitude);
          console.log(park.location.lat, " ", park.location.long);
          console.log(
              "lat, long [delta]: ",
              Math.abs(data.region.center.latitude - park.location.lat),
              Math.abs(data.region.center.longitude - park.location.long)
          );
          console.log(
              (
              Math.abs(data.region.center.latitude - park.location.lat) > 0.002 ||
              Math.abs(data.region.center.longitude - park.location.long) > 0.003
              ) ? 'false' : 'true'
          );

          //If Yelp match found attach data to the park object, if not already present
          if (typeof park.yelpData === 'undefined')
          {
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
        }
        $('body').trigger('yelpData:loaded');
      },

      error: function (xhr, textStatus, errorThrown) {
        console.log('Failed to get yelp data!');
        console.log(errorThrown);
      }

    });
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
      $('#current-selection .yelp-data').html(yelpData);
    }
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

$('#current-selection').on('click', '.close', function(e)
{
  $('#current-selection').hide();
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
    var parentWidth = $(window).width();  //$('#slider1_container').parent().width();
    var maxWidth = 600;
    if (parentWidth) {

      //Cap max width @ maxWidth
      parentWidth = (parentWidth > maxWidth) ? maxWidth : parentWidth;
      jssor_slider1.$ScaleWidth(parentWidth);
    }
    else
      window.setTimeout(ScaleSlider, 30);
  }

  //Scale slider after document ready
  ScaleSlider();

  //Setting blnScaleSlider so that events wouldn't be attached multiple times
  if (typeof window.blnScaleSlider === 'undefined'){
    //Scale slider while window load/resize/orientationchange.
    $(window).bind("load",              ScaleSlider);
    $(window).bind("resize",            ScaleSlider);
    $(window).bind("orientationchange", ScaleSlider);

    window.blnScaleSlider = 1;
  }

}

/** -------------------------------| Execution Flow |---------------------------- */


// Initialize Google Map
App.map = mapInit('map-canvas');

App.parksVM = new parksVM();
App.getParksList();

//TODO: connect with yelp
//TODO: add events data (if time permits)