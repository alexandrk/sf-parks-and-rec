require 'sinatra'
require 'yelp'
require 'pry'

enable  :sessions, :logging

get '/yelp' do

  content_type :json
  response['Access-Control-Allow-Origin'] = "*"

  location = params['location'] || 'San Francisco'
  search_term = params['term']
  limit = (params['limit'].to_i == 0) ? '' : params['limit'].to_i

  client = Yelp::Client.new({
    consumer_key:     "rYk9CJ5te33_5eYDmzFzcA",
    consumer_secret:  "2eMKAHyPv17UA-um4gdZrv8IENM",
    token:            "ZfQZX34Qwz43VQvbvgR7LoVhG-birxNK",
    token_secret:     "QNeuLDAPaAwLHWmXe1CIlddCIVw"
  })

  yelp_params = {term: search_term, limit: limit}
  results = client.search(location, yelp_params)
  #binding.pry

  results.to_json
end

get '/' do
  File.new('public/index.html').readlines
end

get '/test' do
  'this is a test'
end