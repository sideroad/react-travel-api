var express = require('express');
var router = express.Router();
var redis = require('redis');
var url = require('url');
var moment = require('moment');
var redisURL = url.parse(process.env.REDISCLOUD_URL);
var client = redis.createClient(redisURL.port, redisURL.hostname, {no_ready_check: true});
var superagent = require('superagent');
var async = require('async');
var _ = require('lodash');
client.auth(redisURL.auth.split(":")[1]); 
client.flushdb();
var crypto = require('crypto');
var get = function(url, callback){
  console.log(url);
  client.get(url, function(data){
    if(data) {
      console.log('from cache');
      callback(data);
    } else {
      superagent
        .get(url)
        .end(function(err, data){
          client.set(url, data);
          client.expire(url, 86400000 * 30);
          callback(data);
        });
    }
  });
};

router.get('/:lang/spots/:place', function(req, res){
  try {
    var url = 'https://maps.googleapis.com/maps/api/place/textsearch/json?'+
              'query='+req.params.place+'&'+
              'language='+req.params.lang+'&'+
              'key='+process.env.GOOGLE_API_KEY;
    console.log(url);
    get(url, function(data){
        var results = data.body.results || [],
            spot = results[0],
            callback = function(json){
              res.set({
                'Access-Control-Allow-Origin': req.get('origin'),
                'Access-Control-Allow-Methods':'POST, GET, OPTIONS',
                'Access-Control-Allow-Headers':'*',
                'Access-Control-Allow-Credentials': true
              });
              res.json(json);
              res.end();
            };

        if(spot){
          get('https://maps.googleapis.com/maps/api/place/details/json?'+
                 'placeid='+spot.place_id+'&'+
                 'key='+process.env.GOOGLE_API_KEY, function(data){
              var detail = data.body.result,
                  photos = (detail.photos || []).map(function(photo){
                    return 'https://maps.googleapis.com/maps/api/place/photo?'+
                                        'photoreference='+photo.photo_reference+'&'+
                                        'maxwidth=242&'+
                                        'maxheight=242&'+
                                        'key='+process.env.GOOGLE_API_KEY;
                  });

              callback([{
                id: detail.place_id,
                name: detail.name,
                address: detail.formatted_address,
                website: detail.website,
                rating: detail.rating,
                geometry: detail.geometry,
                opening_hours: detail.opening_hours,
                photo: photos[0],
                photos: photos
              }]);
            });
        } else {
          callback([]);
        }
      });

  } catch (err){
    console.log(err);
  }
});


router.get('/:lang/nearby/:location/:types', function(req, res){
  try {
    var url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json?'+
              'rankby=distance&'+
              'language='+req.params.lang+'&'+
              'types='+req.params.types+'&'+
              'location='+req.params.location+'&'+
              'key='+process.env.GOOGLE_API_KEY;
    console.log(url);
    superagent
      .get(url)
      .set('Accept', 'application/json')
      .end(function(err, data){
        res.set({
          'Access-Control-Allow-Origin': req.get('origin'),
          'Access-Control-Allow-Methods':'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers':'*',
          'Access-Control-Allow-Credentials': true
        });
        res.json(data.body);
        res.end();
      });

  } catch (err){
    console.log(err);
  }
});

router.get('/:lang/itinerary/', function(req, res){
  try {
    client.get('itinerary', function(err, data){
      res.set({
        'Access-Control-Allow-Origin': req.get('origin'),
        'Access-Control-Allow-Methods':'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers':'*',
        'Access-Control-Allow-Credentials': true
      });
      res.json(JSON.parse(data || '[]'));
      res.end();
    });

  } catch (err){
    console.log(err);
  }
});

router.options('/:lang/itinerary/add', function(req, res){
  res.set({
    'Access-Control-Allow-Origin': req.get('origin'),
    'Access-Control-Allow-Methods':'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers':'*',
    'Access-Control-Allow-Credentials': true
  });
  res.end();
});

router.get('/:lang/itinerary/add', function(req, res){
  try {
    client.get('itinerary', function(err, data){
      var json = JSON.parse(data || '[]');
      console.log(req.query);

      var isExists = _.find(json, {
        id: req.query.id
      });      

      if(!isExists) {
        json.push(req.query);
      }
      client.set('itinerary', JSON.stringify(json), function(err){
        res.set({
          'Access-Control-Allow-Origin': req.get('origin'),
          'Access-Control-Allow-Methods':'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers':'*',
          'Access-Control-Allow-Credentials': true
        });
        res.json({});
        res.end();  
      });
    });

  } catch (err){
    console.log(err);
  }
});

module.exports = router;