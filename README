San Francisco Parks and Playgrounds Map
=======================================

### BASICS ###
> The App grabs publicly available data from https://data.sfgov.org for public parks and playgrounds in San Francisco and displays it on the google map with additional data from YELP and Instagram API.

### OAUTH in third-party API's ###
> Both YELP and Instagram APIs are implemented with OAuth2 that is hidden in the ruby service (services/oauth.rb), which is deployed to heroku.

### INSTAGRAM API ###
> Instagram API utilizes radius parameter for getting photos within the radius of the lat/lng of the location. That parameter is calculated automatically, based on the size of the park/playground received from data.sfgov.gov

### YELP ###
> Yelp data is approximate to the location and a friendly message is provided, when it is calculated that information for an incorrect location has beed returned from Yelp (based on proximity of the coords of the place returned by yelp to coords of the park/playground that we request the data for).

### CACHING ###
> The data is saved in the localStorage on each request for the purpose of reducing calls to remote resources and improving client experience.