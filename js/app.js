$(function(){

  var APP = function() {

    this.init = function() {
      var mapCanvas = document.getElementById('map-canvas');
      var mapOptions = {
        center: new google.maps.LatLng(37.768920, -122.484255)
        , zoom: 15
        , mapTypeId: google.maps.MapTypeId.MAP      //TERRAIN
        , disableDefaultUI: true
        , zoomControlOptions: {
            position: google.maps.ControlPosition.BOTTOM_CENTER
            ,style: google.maps.ZoomControlStyle.SMALL
          }
      };

      // Setting map-canvas width and height elements according to screen dimensions
      //mapCanvas.css('width', window.screenX);
      //mapCanvas.css('height', window.screenY);

      this.map = new google.maps.Map(mapCanvas, mapOptions);

    };

    this.setMapStyles = function() {

      this.map.set('styles', [
        {
          featureType: 'road',
          elementType: 'geometry',
          stylers: [
            //{ color: '#cccccc' },
            { weight: 1.5 }
          ]
        }
        //, {
        //  featureType: 'road',
        //  elementType: 'labels',
        //  stylers: [
        //    { saturation: -100 },
        //    { invert_lightness: true }
        //  ]
        //}, {
        //  featureType: 'landscape',
        //  elementType: 'geometry',
        //  stylers: [
        //    { hue: '#ffff00' },
        //    { gamma: 1.4 },
        //    { saturation: 82 },
        //    { lightness: 96 }
        //  ]
        //}, {
        //  featureType: 'poi.school',
        //  elementType: 'geometry',
        //  stylers: [
        //    { hue: '#fff700' },
        //    { lightness: -15 },
        //    { saturation: 99 }
        //  ]
        //}
      ]);
    };

  return {
    init: this.init(),
    setMapStyles: this.setMapStyles
  };

  }();

  init();
  setMapStyles();

  $('#up-arrow').on('click', function()
  {
    $('#up-arrow').hide();
    $('#down-arrow').show();
    $('#resultsWrapper').animate({
      'top': '25%'
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

  $("div.resultsNav").jPages({
    containerID : "results",
    perPage: 10,
    previous: "← prev"
  });

});