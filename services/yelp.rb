require 'sinatra'
require 'yelp'
require 'pry'
require 'instagram'

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

get '/instagram' do

  content_type :json
  response['Access-Control-Allow-Origin'] = "*"

  Instagram.configure do |config|
    config.client_id = "16ad1381a2da4ec29774a9b40b5780b3"
    config.client_secret = "c8507fb33b0f4f4da98ef9a5ddfcaf48"
    # For secured endpoints only
    #config.client_ips = '<Comma separated list of IPs>'
  end

  client = Instagram.client()

  #Get initial set of pictures from Instagram
  lat = (params['lat'].to_f) > 0 ? params['lat'].to_f : 0
  lng = (params['lng'].to_f) > 0 ? params['lng'].to_f : 0
  distance = (params['distance'].to_i) > 0 ? params['distance'].to_i : 1000

  results = client.media_search(params['lat'], params['lng'], {distance: distance})

  #Get upto 100 pictures total
  next_results = results
  until results.count > 100 || next_results.count == 0 do
    next_results = client.media_search(params['lat'],
                                       params['lng'],
                                       {
                                         distance: 2000,
                                         max_timestamp: results.last['created_time'].to_i - 100
                                       })
    results.concat(next_results)
  end

  #binding.pry

  results.sort! { |x, y| y.likes["count"] <=> x.likes["count"] }
  results.to_json

  #html = "Count: " + results.count.to_s + "<br />"
  #
  ##binding.pry
  #
  ##results.each_with_index do |item, index|
  ##  html += "<img src='" + item.images["low_resolution"].url + "' width='320' height='320' />"
  ##  html += "Taken on: " + Time.at(item.created_time.to_i).to_s + "<br />"
  ##
  ##  html += "Number: " + index.to_s + "<br />"
  ##
  ##  html += ("Caption: " + item.caption['text']  + "<br />") unless item.caption.nil?
  ##  html += "Likes: " + item.likes['count'].to_s
  ##  html += "<br />"
  ##end
  ##
  ##html

end

get '/' do
  File.new('public/index.html').readlines
end

get '/test' do
  'this is a test'
end