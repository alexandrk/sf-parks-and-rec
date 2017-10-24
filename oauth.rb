require 'sinatra'
require 'yelp'
require 'pry'
require 'instagram'
require 'http'
require 'optparse'

#enable  :sessions, :logging
#set :public_folder, File.dirname(__FILE__) + '../public'

YELP_CLIENT_ID = "E03nRPoHz_LgD-r6VjvhDQ"
YELP_CLIENT_SECRET = "qHY7lSoiU4X80Yg6hOY3S3qQJm1cvziszFaIhyJ20WQl9e9G4wlauH6qqDCtGUah"

# Constants, do not change these
YELP_API_HOST = "https://api.yelp.com"
YELP_SEARCH_PATH = "/v3/businesses/search"
YELP_BUSINESS_PATH = "/v3/businesses/"  # trailing / because we append the business id to the path
YELP_TOKEN_PATH = "/oauth2/token"
YELP_GRANT_TYPE = "client_credentials"

INSTAGRAM_API_HOST = "https://api.instagram.com/"
INSTAGRAM_ACCESS_TOKEN_PATH = "oauth/access_token"
INSTAGRAM_CLIENT_ID = "16ad1381a2da4ec29774a9b40b5780b3"
INSTAGRAM_CLIENT_SECRET = "c8507fb33b0f4f4da98ef9a5ddfcaf48"
INSTAGRAM_GRANT_TYPE = "authorization_code"
INSTAGRAM_REDIRECT_URI = "http://sfparksrec.heroku.com/"
INSTAGRAM_CODE = "CODE"

get '/home' do
  "Hello World"
end

get '/yelp' do

  content_type :json
  response['Access-Control-Allow-Origin'] = "*"

  business_id = params['term'] || "yelp-san-francisco"
  business_location = params['location'] || 'San Francisco, CA'
  search_limit = (params['limit'].to_i == 0) ? '' : params['limit'].to_i

  # Put the url together
  url = "#{YELP_API_HOST}#{YELP_TOKEN_PATH}"

  raise "Please set your CLIENT_ID" if YELP_CLIENT_ID.nil?
  raise "Please set your CLIENT_SECRET" if YELP_CLIENT_SECRET.nil?

  # Build our params hash
  params = {
      client_id: YELP_CLIENT_ID,
      client_secret: YELP_CLIENT_SECRET,
      grant_type: YELP_GRANT_TYPE
  }

  response = HTTP.post(url, params: params)
  parsed = response.parse

  bearer_token = "#{parsed['token_type']} #{parsed['access_token']}"

  # Search API with the token
  url = "#{YELP_API_HOST}#{YELP_SEARCH_PATH}"

  params = {
      term: business_id,
      location: business_location,
      limit: search_limit
  }

  response = HTTP.auth(bearer_token).get(url, params: params)
  parsed = response.parse

  body(parsed.to_json)

  #body("Hello world")
end

get '/instagram' do

  content_type :json
  response['Access-Control-Allow-Origin'] = "*"

  url = INSTAGRAM_API_HOST + INSTAGRAM_ACCESS_TOKEN_PATH
  params = {
      client_id: INSTAGRAM_CLIENT_ID,
      client_secret: INSTAGRAM_CLIENT_SECRET,
      grant_type: INSTAGRAM_GRANT_TYPE,
      redirect_uri: INSTAGRAM_REDIRECT_URI,
      code: INSTAGRAM_CODE
  }

  print(params)

  response = HTTP.post(url, params: params)
  print(response.parse)

  # #Get initial set of pictures from Instagram
  # lat = (params['lat'].to_f) > 0 ? params['lat'].to_f : 0
  # lng = (params['lng'].to_f) > 0 ? params['lng'].to_f : 0
  # distance = (params['distance'].to_i) > 0 ? params['distance'].to_i : 1000
  #
  # results = client.media_search(params['lat'], params['lng'], {distance: distance})
  #
  # #Get upto 30 pictures total
  # next_results = results
  # until results.count > 30 || next_results.count == 0 do
  #   next_results = client.media_search(params['lat'],
  #                                      params['lng'],
  #                                      {
  #                                        distance: distance,
  #                                        max_timestamp: results.last['created_time'].to_i - 100
  #                                      })
  #   results.concat(next_results)
  #end

  #binding.pry

  #results.sort! { |x, y| y.likes["count"] <=> x.likes["count"] }
  #results.to_json

end

get '/' do
  File.new('public/index.html').readlines
end

get '/test' do
  'this is a test'
end