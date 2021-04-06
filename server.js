'use strict';

const express = require('express');
const cors = require('cors');
const app = express();
const superagent = require('superagent');
const methodOverride = require('method-override');
const pg = require('pg');

require('dotenv').config();
const client = new pg.Client(process.env.DATABASE_URL);
const PORT = process.env.PORT || 3333;

app.use(cors());
app.use(methodOverride('_method'));
app.use(express.static('./public'));
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_KN_API_KEY = process.env.GOOGLE_KN_API_KEY;

//////////////////////////////////////////////ROUTES/////////////////////////////////////////////////////////////////

app.post('/boarding_pass', saveBoarding);
app.get('/boarding', renderBoarding);
app.post('/stamped_pass', saveStamped);
app.get('/stamped', renderStamped);
app.delete('/deleteStamped/:location_id', deleteStamped);
app.delete('/deleteBoarding/:location_id', deleteBoarding);
app.get('/pages/error', renderErrorPage);
app.put('/move/:location_id', moveToStamped);
app.put('/addNotesStamped/:loc_id', addNotesStamped);
app.put('/addNotesBoarding/:loc_id', addNotesBoarding);
app.get('/', (req, res) => {
  res.sendFile('./public/index.html');
});

app.get('/search', getCity);
// app.get('/search', getCountry);
app.get('/getSavedBoarding', getSavedBoarding);
app.get('/getSavedStamped', getSavedStamped);

app.get('*', renderErrorPage);

function getCity(req, res) {
  if (req.query.city === 'speakeasier' || req.query.city === 'Speakeasier' || req.query.city === 'SPEAKEASIER') {
    res.sendFile('./public/about-us.html', { root: __dirname })
  } else {
    let obj = {};
    let city = req.query.city;
    let googleKn = `https://kgsearch.googleapis.com/v1/entities:search?query=${city}&key=${GOOGLE_KN_API_KEY}`;

    superagent.get(googleKn)
      .then(data => {
        let array = [];
        data.body.itemListElement.map(results => {
          array.push(results.result);
        })
        if (!array[0] || !array[0].detailedDescription.articleBody || !array[0].detailedDescription) {
          res.redirect('/pages/error');
        }
        obj.description = array[0].detailedDescription.articleBody;
        obj.name = array[0].name;
      })
      .then(() => {
        let urlPlaceId = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${city}&inputtype=textquery&key=${GOOGLE_API_KEY}`;
        superagent.get(urlPlaceId)
          .then(data => {
            let pocket = data.body.candidates;
            let photoRefs = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${pocket[0].place_id}&key=${GOOGLE_API_KEY}`;

            // Old google places API: AIzaSyAeRkwadPt5w19bYgw4yjW3rc9uJsIADAY, which stopped working without a credit card attached; NRC created a new one on 1 April 2021, which works locally, but not on the Heroku deployed site.

            ////////////////////////// Country Info . . . on hold. //////////////////////////////////
            // superagent.get(photoRefs)
            //   .then(data => {
            //     let formattedAddress = data.body.result.formatted_address;
            //     console.log('Formatted Address:', formattedAddress);
            //     let countryURL = 'https://restcountries.eu/rest/v2/all';

            //     superagent.get(countryURL)
            //       .then(carrot => {
            //         let body = carrot.body;
            //         body.forEach(value => {
            //         })
            //       console.log(body[1].name);
            //         // for (let i=0; i<carrot.length; i++) {
            //         //     if (carrot[i].name = formattedAddress) {
            //         })
            //       })
            ////////////////////////// Country Info . . . on hold. //////////////////////////////////

            superagent.get(photoRefs)
              .then(data => {
                let photoReferenceArray = data.body.result.photos;
                if (photoReferenceArray) {
                  return photoReferenceArray.map(photos => photos.photo_reference)
                } else {
                  res.redirect('/pages/error');
                }
              })
              .then(data => {
                let array = data.map(photoArray => {
                  let url = `https://maps.googleapis.com/maps/api/place/photo?maxheight=400&photoreference=${photoArray}&key=${GOOGLE_API_KEY}`;
                  return url;
                })
                return array;
              })
              .then(banana => {
                let photoArray = [];
                banana.forEach(apple => {
                  photoArray.push(superagent.get(apple));
                })
                Promise.all(photoArray)
                  .then(potatoes => {
                    obj.photo = potatoes;
                    res.render('./pages/details', { render: obj });
                  })
              })
          })
      })
      .catch(err => {
        console.log('ERROR', err);
        res.render('./pages/error', err);
    })
  }
}

function saveBoarding(req, res) {
  let { city_name, city_description, special, images0, images1, images2, images3, images4, images5, images6, images7, images8 } = req.body;
  let SQL = 'INSERT INTO boarding (city_name, city_description, special, images0, images1, images2, images3, images4, images5, images6, images7, images8) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *;';
  let values = [city_name, city_description, special, images0, images1, images2, images3, images4, images5, images6, images7, images8];

  client.query(SQL, values)
    .then(res.redirect('/boarding'))
    .catch(err => console.error(err));
}

function renderBoarding(req, res) {
  let SQL = 'SELECT * FROM boarding;';

  return client.query(SQL)
    .then(dbInfo => {
      res.render('./pages/boarding', { boardingData: dbInfo.rows })
    })
    .catch(err => console.error(err));
}

function saveStamped(req, res) {
  let { city_name, city_description, special, images0, images1, images2, images3, images4, images5, images6, images7, images8 } = req.body;
  let SQL = 'INSERT INTO stamped (city_name, city_description, special, images0, images1, images2, images3, images4, images5, images6, images7, images8) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *;';
  let values = [city_name, city_description, special, images0, images1, images2, images3, images4, images5, images6, images7, images8];

  client.query(SQL, values)
    .then(res.redirect('/stamped'))
    .catch(err => console.error(err));
}

function renderStamped(req, res) {
  let SQL = 'SELECT * FROM stamped;';
  return client.query(SQL)
    .then(dbInfo => {
      res.render('./pages/stamped', { stampedData: dbInfo.rows })
    })
    .catch(err => console.error(err));
}

function deleteStamped(req, res) {
  let SQL = `DELETE FROM stamped WHERE id=${req.params.location_id};`;
  client.query(SQL)
    .then(res.redirect('/stamped'))
    .catch(err => console.error(err));
}

function deleteBoarding(req, res) {
  let SQL = `DELETE FROM boarding WHERE id=${req.params.location_id};`;
  client.query(SQL)
    .then(res.redirect('/boarding'))
    .catch(err => console.error(err));
}

function moveToStamped(req, res) {
  let SQL = 'INSERT INTO stamped (city_name, city_description, special, journal, images0, images1, images2, images3, images4, images5, images6, images7, images8) SELECT city_name, city_description, special, journal, images0, images1, images2, images3, images4, images5, images6, images7, images8 FROM boarding WHERE id=$1;';
  let values = [req.params.location_id];

  client.query(SQL, values)
    .then(() => {
      SQL = 'DELETE FROM boarding WHERE id=$1;';
      client.query(SQL, values)
        .then(res.redirect('/stamped'))
        .catch(err => console.error(err));
    })
    .catch(err => console.error(err));
}

function getSavedBoarding(req, res) {
  let id = req.query.id;
  let SQL = `SELECT * FROM boarding WHERE id=${id}`;
  client.query(SQL)
    .then(drDre => {
      res.render('./pages/detailsBoarding', { beyonce: drDre.rows })
    })
}

function getSavedStamped(req, res) {
  let id = req.query.id;
  let SQL = `SELECT * FROM stamped WHERE id=${id}`;
  client.query(SQL)
    .then(drDre => {
      res.render('./pages/detailsStamped', { beyonce: drDre.rows })
    })
}
function addNotesBoarding(req, res) {
  let awesome = req.body.journaldata;
  let ok = req.params.loc_id;
  let SQL = `UPDATE boarding SET journal='${awesome}' WHERE id=${ok} RETURNING *;`;

  client.query(SQL)
    .then(res.redirect(`/getSavedBoarding?id=${ok}`))
    .catch(err => console.error(err));
}

function addNotesStamped(req, res) {
  let dope = req.body.journaldata;
  let nice = req.params.loc_id;
  let SQL = `UPDATE stamped SET journal='${dope}' WHERE id=${nice} RETURNING *;`;

  client.query(SQL)
    .then(res.redirect(`/getSavedStamped?id=${nice}`))
    .catch(err => console.error(err));
}

function renderErrorPage(req, res) {
  let message = 'No door here. Please look elsewhere.'
  let wack = { error: message };
  res.render('./pages/error', wack);
}

client.connect()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Order Up!: ${PORT}`)
    })
  })
client.on('error', err => console.err(err));